import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadLocalEnv } from "./env.js";

export type AvatarUploadFile = {
  bytes: Buffer;
  contentType: string;
  filename: string;
};

export type AvatarUploadResult = {
  fieldName: string;
  imageUrl: string;
  originalImageUrl: string;
  sleepTime?: string;
};

type MelonAvatarResponse = {
  response?: {
    MYPAGEIMG?: string;
    MYPAGEIMGORG?: string;
    SLEEPTIME?: string;
  };
};

const avatarEndpoint = "https://m2.melon.com/mymusic/updateUserImg.json";
const defaultFieldNames = ["file", "uploadFile", "userImg", "profileImg", "image", "imgFile"];

export async function uploadMelonAvatar(file: AvatarUploadFile): Promise<AvatarUploadResult> {
  loadLocalEnv();
  const cookie = process.env.MELON_COOKIE?.trim();

  if (!cookie) {
    throw new Error("缺少 MELON_COOKIE，请先把 Melon 登录 Cookie 写入本地 .env。");
  }

  const configuredFieldName = process.env.MELON_AVATAR_FIELD_NAME?.trim();
  const fieldNames = configuredFieldName ? [configuredFieldName] : defaultFieldNames;
  const errors: string[] = [];

  for (const fieldName of fieldNames) {
    try {
      const result = await uploadMelonAvatarWithField(file, fieldName, cookie);

      if (result) {
        return result;
      }
    } catch (error) {
      errors.push(`${fieldName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(
    [
      "Melon 头像上传失败。可能是 Cookie 过期，或 multipart 图片字段名不匹配。",
      `已尝试字段名：${fieldNames.join(", ")}`,
      errors.length > 0 ? `错误：${errors.join(" | ")}` : undefined,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

async function uploadMelonAvatarWithField(
  file: AvatarUploadFile,
  fieldName: string,
  cookie: string,
): Promise<AvatarUploadResult | null> {
  try {
    return await uploadMelonAvatarWithFetch(file, fieldName, cookie);
  } catch (error) {
    if (!isFetchNetworkError(error)) {
      throw error;
    }

    return uploadMelonAvatarWithCurl(file, fieldName, cookie);
  }
}

async function uploadMelonAvatarWithFetch(
  file: AvatarUploadFile,
  fieldName: string,
  cookie: string,
): Promise<AvatarUploadResult | null> {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(file.bytes)], { type: file.contentType });
  formData.append(fieldName, blob, file.filename);

  const response = await fetch(avatarEndpoint, {
    method: "POST",
    headers: {
      accept: "*/*",
      "accept-language": "zh-CN,zh-Hans;q=0.9",
      cookie,
      "user-agent": process.env.MELON_USER_AGENT ?? "IS40; iPhone 26.3.1; 6.17.0; iPhone17,1",
    },
    body: formData,
  });

  const bodyText = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${bodyText.slice(0, 200)}`);
  }

  const body = JSON.parse(bodyText) as MelonAvatarResponse;
  const imageUrl = body.response?.MYPAGEIMG;
  const originalImageUrl = body.response?.MYPAGEIMGORG;

  if (!imageUrl || !originalImageUrl) {
    throw new Error(`Melon response did not include avatar URLs: ${bodyText.slice(0, 300)}`);
  }

  return {
    fieldName,
    imageUrl,
    originalImageUrl,
    sleepTime: body.response?.SLEEPTIME,
  };
}

async function uploadMelonAvatarWithCurl(
  file: AvatarUploadFile,
  fieldName: string,
  cookie: string,
): Promise<AvatarUploadResult | null> {
  const tempDir = await mkdtemp(join(tmpdir(), "melon-avatar-"));
  const imagePath = join(tempDir, file.filename);
  const configPath = join(tempDir, "curl.conf");

  try {
    await writeFile(imagePath, file.bytes);
    await writeFile(
      configPath,
      [
        `url = "${escapeCurlConfigValue(avatarEndpoint)}"`,
        `request = "POST"`,
        "silent",
        "show-error",
        "fail-with-body",
        "compressed",
        `header = "Accept: */*"`,
        `header = "Accept-Language: zh-CN,zh-Hans;q=0.9"`,
        `header = "Cookie: ${escapeCurlConfigValue(cookie)}"`,
        `header = "User-Agent: ${escapeCurlConfigValue(
          process.env.MELON_USER_AGENT ?? "IS40; iPhone 26.3.1; 6.17.0; iPhone17,1",
        )}"`,
        `form = "${escapeCurlConfigValue(fieldName)}=@${escapeCurlConfigValue(imagePath)};type=${escapeCurlConfigValue(
          file.contentType,
        )};filename=${escapeCurlConfigValue(file.filename)}"`,
      ].join("\n"),
      { mode: 0o600 },
    );

    const bodyText = await runCurl(configPath);
    const body = JSON.parse(bodyText) as MelonAvatarResponse;
    const imageUrl = body.response?.MYPAGEIMG;
    const originalImageUrl = body.response?.MYPAGEIMGORG;

    if (!imageUrl || !originalImageUrl) {
      throw new Error(`Melon response did not include avatar URLs: ${bodyText.slice(0, 300)}`);
    }

    return {
      fieldName,
      imageUrl,
      originalImageUrl,
      sleepTime: body.response?.SLEEPTIME,
    };
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

function runCurl(configPath: string): Promise<string> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn("curl", ["--config", configPath]);
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => {
      stdout.push(chunk);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr.push(chunk);
    });

    child.on("error", rejectRun);
    child.on("close", (code) => {
      const body = Buffer.concat(stdout).toString("utf8");

      if (code === 0) {
        resolveRun(body);
        return;
      }

      const errorText = Buffer.concat(stderr).toString("utf8").trim();
      rejectRun(new Error(`curl exited ${code}: ${errorText || body.slice(0, 200)}`));
    });
  });
}

function isFetchNetworkError(error: unknown): boolean {
  return error instanceof TypeError && error.message === "fetch failed";
}

function escapeCurlConfigValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
