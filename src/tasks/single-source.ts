import { extractKnownArtistAlias, normalizeArtistAlias } from "../tools/artist-aliases.js";
import { parseSingleSourceWithDeepSeek } from "../tools/deepseek-semantic-parser.js";
import { fetchLatestAlbumTitleTrack, searchSong, type MelonSongSearchResult } from "../tools/melon-live-client.js";
import { extractReleaseDate } from "./full-source-html.js";
import type { AgentTask, AgentTaskResult } from "./types.js";

type SingleSongResolver = (artist: string, title: string) => Promise<MelonSongSearchResult | null>;
type LatestTitleTrackResolver = (artist: string, releaseDate?: string) => Promise<MelonSongSearchResult | null>;

type SingleSourceRequest = {
  artist: string;
  title?: string;
  streamCount?: string;
  releaseDate?: string;
  intent: "song" | "latest_album_title_track" | "debut_album_title_track" | "regular_album_title_track";
};

const knownDebutTitleTracks = new Map<string, string>([
  ["itzy", "달라달라"],
]);

const knownRegularAlbumTitleTracks = new Map<string, string>([
  ["itzy", "UNTOUCHABLE"],
]);

export function createSingleSourceTask(
  resolveSong: SingleSongResolver = searchSong,
  resolveLatestTitleTrack: LatestTitleTrackResolver = fetchLatestAlbumTitleTrack,
): AgentTask {
  return {
    name: "single_source",
    description: "Find a Melon songId by artist and song title, then generate a match regex.",
    async run(input: string): Promise<AgentTaskResult> {
      const request = parseSingleSongRequest(input) ?? await parseSingleSourceWithDeepSeek(input);

      if (!request) {
        return {
          status: "needs_data_source",
          output: "请提供歌手名和歌曲名，例如：tws，널 따라가 (You, You)",
        };
      }

      const song = request.intent === "latest_album_title_track"
        ? await resolveLatestTitleTrack(request.artist, request.releaseDate)
        : request.intent === "debut_album_title_track"
          ? await resolveDebutTitleTrack(request, resolveSong)
          : request.intent === "regular_album_title_track"
            ? await resolveRegularAlbumTitleTrack(request, resolveSong)
          : request.title
          ? await resolveSong(request.artist, request.title)
          : null;

      if (!song) {
        return {
          status: "needs_data_source",
          output: [
            request.intent === "latest_album_title_track"
              ? `没有在 Melon 找到 ${request.artist} 最新专辑的主打曲。`
              : request.intent === "debut_album_title_track"
                ? `没有在 Melon 找到 ${request.artist} 出道专辑的主打曲。`
                : request.intent === "regular_album_title_track"
                  ? `没有在 Melon 找到 ${request.artist} 正规专辑的主打曲。`
              : `没有在 Melon 找到 ${request.artist} 的《${request.title ?? ""}》。`,
            "",
            "你可以检查歌手名和歌名是否和 Melon 页面一致，例如：tws，널 따라가 (You, You)，或输入：芒叉主打曲",
          ].join("\n"),
        };
      }

      return {
        status: "ok",
        output: formatSingleSourceOutput(song, request.streamCount),
      };
    },
  };
}

export function parseSingleSongRequest(input: string): SingleSourceRequest | null {
  const titleTrackRequest = parseLatestTitleTrackRequest(input);

  if (titleTrackRequest) {
    return titleTrackRequest;
  }

  const parts = splitDelimitedInput(input)
    .map((part) => cleanInstructionText(part))
    .filter(Boolean)
    .filter((part) => !/歌手名|歌曲名|歌名/.test(part));

  const streamCount = parts.at(-1)?.match(/^\d+$/)?.[0];

  if (parts.length >= 3 && streamCount) {
    return {
      artist: normalizeArtistAlias(parts[parts.length - 3]),
      title: parts[parts.length - 2],
      streamCount,
      intent: "song",
    };
  }

  if (parts.length >= 2) {
    return {
      artist: normalizeArtistAlias(parts[parts.length - 2]),
      title: parts[parts.length - 1],
      intent: "song",
    };
  }

  const compactInput = cleanInstructionText(input);
  const fallback = compactInput.match(/^(?<artist>[A-Za-z0-9_.&'() -]{2,40})\s+(?<title>.+)$/);

  if (!fallback?.groups?.artist || !fallback.groups.title) {
    return null;
  }

  return {
    artist: normalizeArtistAlias(fallback.groups.artist.trim()),
    title: fallback.groups.title.trim(),
    intent: "song",
  };
}

function parseLatestTitleTrackRequest(input: string): SingleSourceRequest | null {
  if (!/(主打曲|主打歌|最新主打|最新专辑主打|title\s*track)/iu.test(input)) {
    return null;
  }

  const streamCount = input.match(/[,，\s](?<count>\d+)\s*$/)?.groups?.count;
  const releaseDate = extractReleaseDate(input);
  const intent = /(出道专|出道曲|出道主打|debut)/iu.test(input)
    ? "debut_album_title_track"
    : /(正规专辑|正专|正规|full\s*album|studio\s*album|정규)/iu.test(input)
      ? "regular_album_title_track"
    : "latest_album_title_track";
  const knownArtist = extractKnownArtistAlias(input);

  if (knownArtist) {
    return {
      artist: knownArtist,
      intent,
      streamCount,
      releaseDate,
    };
  }

  const cleaned = cleanInstructionText(input)
    .replace(/最新专辑的?|最新|主打曲|主打歌|title\s*track/giu, " ")
    .replace(/[,，]/g, " ")
    .trim();
  const artist = cleaned.match(/[A-Za-z0-9_.&'() -]{2,40}/)?.[0]?.trim();

  if (!artist || /^\d+$/.test(artist)) {
    return null;
  }

  return {
    artist: normalizeArtistAlias(artist),
    intent,
    streamCount,
    releaseDate,
  };
}

async function resolveDebutTitleTrack(
  request: SingleSourceRequest,
  resolveSong: SingleSongResolver,
): Promise<MelonSongSearchResult | null> {
  const debutTitle = request.title ?? knownDebutTitleTracks.get(normalizeKnownKey(request.artist));

  if (!debutTitle) {
    return null;
  }

  return resolveSong(request.artist, debutTitle);
}

async function resolveRegularAlbumTitleTrack(
  request: SingleSourceRequest,
  resolveSong: SingleSongResolver,
): Promise<MelonSongSearchResult | null> {
  const regularTitle = request.title ?? knownRegularAlbumTitleTracks.get(normalizeKnownKey(request.artist));

  if (!regularTitle) {
    return null;
  }

  return resolveSong(request.artist, regularTitle);
}

function formatSingleSourceOutput(song: MelonSongSearchResult, streamCount: string | undefined): string {
  const fragments = [`.*songId=${song.songId}\\b.*$`];

  if (streamCount) {
    fragments.push(
      `"TOTALLISTENCNT":".*?\\"`,
      `"TOTALLISTENCNT":"${streamCount}"`,
      `"FIRSTLISTENDATE":".*?\\"`,
      `"FIRSTLISTENDATE":"${song.releaseDate ?? ""}"`,
      `"SONGID":".*?\\"`,
      `"MYSTREAMCOUNT":".*?\\"`,
    );
  }

  return [
    `已找到 ${song.artist} - ${song.title} 的 songId：${song.songId}`,
    song.releaseDate ? `发行日：${song.releaseDate}` : undefined,
    "",
    ...fragments.map((fragment) => ["```regex", fragment, "```"].join("\n")),
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n");
}

function splitDelimitedInput(input: string): string[] {
  const parts: string[] = [];
  let buffer = "";
  let depth = 0;

  for (const character of input) {
    if (character === "(" || character === "（") {
      depth += 1;
    } else if ((character === ")" || character === "）") && depth > 0) {
      depth -= 1;
    }

    if ((character === "," || character === "，") && depth === 0) {
      parts.push(buffer);
      buffer = "";
      continue;
    }

    buffer += character;
  }

  parts.push(buffer);
  return parts;
}

function cleanInstructionText(value: string): string {
  return value
    .replace(/^(请|帮我|给我|查一下|搜索|查询|输出|生成)+/g, "")
    .replace(/(的)?单曲音源(源码|规则)?/g, "")
    .replace(/songId/gi, "")
    .trim();
}

function normalizeKnownKey(value: string): string {
  return value.toLowerCase().replace(/[\s\u00a0_\-]+/g, "");
}
