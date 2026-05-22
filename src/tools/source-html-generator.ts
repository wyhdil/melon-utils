import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import type { MelonAlbumPayload } from "./melon-live-client.js";

const execFileAsync = promisify(execFile);

export type SourceHtmlResult = {
  artistKey: string;
  albumTitle: string;
  html: string;
};

type AlbumConfig = {
  album?: string;
  singer?: string;
};

export async function generateConfiguredAlbumSourceHtml(artistKey: string): Promise<SourceHtmlResult | null> {
  const normalizedArtistKey = normalizeArtistKey(artistKey);
  const albumConfigPath = resolve(process.cwd(), "data", "albums", `${normalizedArtistKey}.json`);
  const scriptPath = resolve(process.cwd(), "scripts", "build_row.py");
  const tempDir = await mkdtemp(join(tmpdir(), "melon-agent-"));
  const outputPath = join(tempDir, `${normalizedArtistKey}.html`);

  try {
    const albumConfig = JSON.parse(await readFile(albumConfigPath, "utf8")) as AlbumConfig;
    await execFileAsync("python3", [scriptPath, albumConfigPath, outputPath], {
      cwd: process.cwd(),
    });

    return {
      artistKey: normalizedArtistKey,
      albumTitle: albumConfig.album ?? normalizedArtistKey,
      html: await readFile(outputPath, "utf8"),
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    throw error;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function generateAlbumSourceHtmlFromPayload(
  artistKey: string,
  albumPayload: MelonAlbumPayload,
): Promise<SourceHtmlResult> {
  const normalizedArtistKey = normalizeArtistKey(artistKey);
  const scriptPath = resolve(process.cwd(), "scripts", "build_row.py");
  const tempDir = await mkdtemp(join(tmpdir(), "melon-agent-"));
  const inputPath = join(tempDir, `${normalizedArtistKey}.json`);
  const outputPath = join(tempDir, `${normalizedArtistKey}.html`);

  try {
    await writeFile(inputPath, JSON.stringify(albumPayload, null, 2), "utf8");
    await execFileAsync("python3", [scriptPath, inputPath, outputPath], {
      cwd: process.cwd(),
    });

    return {
      artistKey: normalizedArtistKey,
      albumTitle: albumPayload.album,
      html: await readFile(outputPath, "utf8"),
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function normalizeArtistKey(artistKey: string): string {
  return artistKey.trim().toLowerCase();
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "MODULE_NOT_FOUND")
  );
}
