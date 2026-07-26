import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { listMelonAgentModules, runMelonAgent } from "./agent/melon-agent.js";
import { loadLocalEnv } from "./tools/env.js";
import { uploadMelonAvatar, type AvatarUploadFile, type AvatarUploadResult } from "./tools/melon-avatar-client.js";
import {
  createFileIdentityHistoryStore,
  type IdentityHistoryDraft,
  type IdentityHistoryStore,
} from "./tools/identity-history-store.js";

const publicDir = resolve(process.cwd(), "public");
const defaultHost = "127.0.0.1";
const defaultPort = 3100;
const maxAvatarBytes = 5 * 1024 * 1024;

type WebServerOptions = {
  copyText?: (text: string) => Promise<void>;
  identityHistoryStore?: IdentityHistoryStore;
  uploadAvatar?: (file: AvatarUploadFile) => Promise<AvatarUploadResult>;
};

export function createWebServer(options: WebServerOptions = {}): Server {
  const copyText = options.copyText ?? copyTextToSystemClipboard;
  const identityHistoryStore = options.identityHistoryStore ?? createFileIdentityHistoryStore();
  const uploadAvatar = options.uploadAvatar ?? uploadMelonAvatar;

  return createServer(async (request, response) => {
    try {
      await handleRequest(request, response, { copyText, identityHistoryStore, uploadAvatar });
    } catch (error) {
      console.error(error);
      sendJson(response, 500, { error: "Internal server error" });
    }
  });
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  handlers: {
    copyText: (text: string) => Promise<void>;
    identityHistoryStore: IdentityHistoryStore;
    uploadAvatar: (file: AvatarUploadFile) => Promise<AvatarUploadResult>;
  },
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://localhost");

  if (request.method === "POST" && url.pathname === "/api/chat") {
    await handleChat(request, response, handlers.identityHistoryStore);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/modules") {
    sendJson(response, 200, { modules: listMelonAgentModules() });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/identity-history") {
    sendJson(response, 200, { records: await handlers.identityHistoryStore.listRecent() });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/copy") {
    await handleCopy(request, response, handlers.copyText);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/avatar") {
    await handleAvatarUpload(request, response, handlers.uploadAvatar);
    return;
  }

  if (request.method === "GET") {
    await serveStatic(url.pathname, response);
    return;
  }

  sendJson(response, 405, { error: "Method not allowed" });
}

async function handleAvatarUpload(
  request: IncomingMessage,
  response: ServerResponse,
  uploadAvatar: (file: AvatarUploadFile) => Promise<AvatarUploadResult>,
): Promise<void> {
  const contentType = String(request.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();

  if (!contentType.startsWith("image/")) {
    sendJson(response, 400, { error: "avatar upload requires an image content type" });
    return;
  }

  const bytes = await readRawBody(request, maxAvatarBytes);

  if (bytes.length === 0) {
    sendJson(response, 400, { error: "avatar image is required" });
    return;
  }

  try {
    const result = await uploadAvatar({
      bytes,
      contentType,
      filename: getUploadFilename(request, contentType),
    });

    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 502, { error: error instanceof Error ? error.message : "avatar upload failed" });
  }
}

async function handleChat(
  request: IncomingMessage,
  response: ServerResponse,
  identityHistoryStore: IdentityHistoryStore,
): Promise<void> {
  const body = await readJsonBody(request);

  if (!isChatRequest(body)) {
    sendJson(response, 400, { error: "message is required" });
    return;
  }

  const result = await runMelonAgent(body.message, { moduleId: body.moduleId });

  if (body.moduleId === "melon_identity") {
    const historyDraft = extractIdentityHistoryDraft(result.output);

    if (historyDraft) {
      await identityHistoryStore.add(historyDraft);
    }
  }

  sendJson(response, 200, result);
}

async function handleCopy(
  request: IncomingMessage,
  response: ServerResponse,
  copyText: (text: string) => Promise<void>,
): Promise<void> {
  const body = await readJsonBody(request);

  if (!isCopyRequest(body)) {
    sendJson(response, 400, { error: "text is required" });
    return;
  }

  await copyText(body.text);
  sendJson(response, 200, { ok: true });
}

async function serveStatic(pathname: string, response: ServerResponse): Promise<void> {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(decodeURIComponent(requestedPath)).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const fileStats = await stat(filePath);

    if (!fileStats.isFile()) {
      sendText(response, 404, "Not found");
      return;
    }
  } catch {
    sendText(response, 404, "Not found");
    return;
  }

  response.writeHead(200, {
    "content-type": getContentType(filePath),
    "cache-control": "no-store",
  });
  createReadStream(filePath).pipe(response);
}

function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolveBody, rejectBody) => {
    const chunks: Buffer[] = [];

    request.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    request.on("end", () => {
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        rejectBody(error);
      }
    });

    request.on("error", rejectBody);
  });
}

function readRawBody(request: IncomingMessage, maxBytes: number): Promise<Buffer> {
  return new Promise((resolveBody, rejectBody) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    request.on("data", (chunk: Buffer) => {
      totalBytes += chunk.length;

      if (totalBytes > maxBytes) {
        rejectBody(new Error(`Request body exceeds ${maxBytes} bytes`));
        request.destroy();
        return;
      }

      chunks.push(chunk);
    });

    request.on("end", () => {
      resolveBody(Buffer.concat(chunks));
    });

    request.on("error", rejectBody);
  });
}

function isChatRequest(value: unknown): value is { message: string; moduleId?: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string" &&
    value.message.trim().length > 0 &&
    (!("moduleId" in value) || typeof value.moduleId === "string")
  );
}

function isCopyRequest(value: unknown): value is { text: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "text" in value &&
    typeof value.text === "string"
  );
}

function extractIdentityHistoryDraft(output: string): IdentityHistoryDraft | null {
  const codeBlocks = Array.from(output.matchAll(/```(?<language>[a-zA-Z0-9_-]*)\n(?<content>[\s\S]*?)```/g), (match) => ({
    language: match.groups?.language ?? "",
    content: match.groups?.content.trim() ?? "",
  }));
  const regexIndex = codeBlocks.findIndex((block) => block.language === "regex");
  const name = regexIndex > 0 ? codeBlocks[regexIndex - 1]?.content : codeBlocks[1]?.content;
  const template = codeBlocks.find((block) => block.language === "html")?.content;

  if (!name || !template) {
    return null;
  }

  return { name, template };
}

function getUploadFilename(request: IncomingMessage, contentType: string): string {
  const rawFilename = request.headers["x-file-name"];
  const filename = Array.isArray(rawFilename) ? rawFilename[0] : rawFilename;

  if (filename) {
    return decodeURIComponent(filename).replace(/[^\p{L}\p{N}.\-() ]/gu, "_");
  }

  return `avatar.${contentType.split("/")[1] || "jpg"}`;
}

function copyTextToSystemClipboard(text: string): Promise<void> {
  if (process.platform !== "darwin") {
    return Promise.reject(new Error(`Clipboard copy is not supported on ${process.platform}`));
  }

  return new Promise((resolveCopy, rejectCopy) => {
    const child = spawn("pbcopy");

    child.on("error", rejectCopy);
    child.on("close", (code) => {
      if (code === 0) {
        resolveCopy();
        return;
      }

      rejectCopy(new Error(`pbcopy exited with code ${code}`));
    });

    child.stdin.end(text);
  });
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sendText(response: ServerResponse, statusCode: number, text: string): void {
  response.writeHead(statusCode, { "content-type": "text/plain; charset=utf-8" });
  response.end(text);
}

function getContentType(filePath: string): string {
  switch (extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  loadLocalEnv();
  const port = Number(process.env.PORT ?? defaultPort);
  const host = process.env.HOST ?? defaultHost;
  const server = createWebServer();

  server.listen(port, host, () => {
    console.log(`Melon Agent web UI: http://${host}:${port}`);
  });
}
