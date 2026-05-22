import { fetchLiveAlbumPayload } from "../tools/melon-live-client.js";
import { generateConfiguredAlbumSourceHtml } from "../tools/source-html-generator.js";
import { generateAlbumSourceHtmlFromPayload } from "../tools/source-html-generator.js";
import type { AgentTask, AgentTaskResult } from "./types.js";

export function createFullSourceHtmlTask(): AgentTask {
  return {
    name: "full_source_html",
    description: "Generate full-track Melon source HTML from a configured local album JSON.",
    async run(input: string): Promise<AgentTaskResult> {
      const artistKey = extractArtistKey(input);

      if (!artistKey) {
        return {
          status: "needs_data_source",
          output: "请告诉我要生成哪个团体的全曲源码，例如：给我 tws 最新专辑的全曲源码",
        };
      }

      const releaseDate = extractReleaseDate(input);
      const livePayload = shouldUseLiveLookup() ? await fetchLiveAlbumPayload(artistKey, { releaseDate }) : null;
      const result = livePayload
        ? await generateAlbumSourceHtmlFromPayload(artistKey, livePayload)
        : await generateConfiguredAlbumSourceHtml(artistKey);

      if (!result) {
        return {
          status: "needs_data_source",
          output: [
            `没有找到 ${artistKey}${releaseDate ? ` 在 ${releaseDate}` : " 最新"} 的 Melon 专辑数据。`,
            "",
            "你可以换一个团体名，或指定发行日期，例如：给我 tws 2026.04.27 发行的全曲源码。",
          ].join("\n"),
        };
      }

      return {
        status: "ok",
        output: [
          `已生成 ${result.artistKey} 的全曲源码：${result.albumTitle}`,
          "",
          "```html",
          result.html.trim(),
          "```",
        ].join("\n"),
      };
    },
  };
}

function shouldUseLiveLookup(): boolean {
  return process.env.MELON_DISABLE_LIVE !== "1";
}

export function extractArtistKey(input: string): string {
  const cleaned = input
    .replace(/^(给我|帮我|请|查询|查一下|生成|输出)+/gi, "")
    .replace(/[,，]/g, " ")
    .trim();
  const match = cleaned.match(/^(?<artist>[A-Za-z0-9_.&'()가-힣-]+)/);

  if (match?.groups?.artist) {
    return match.groups.artist.toLowerCase();
  }

  return cleaned
    .replaceAll("最新专辑", " ")
    .replaceAll("最新一张专辑", " ")
    .replaceAll("的全曲源码", " ")
    .replaceAll("全曲源码", " ")
    .replaceAll("全专源码", " ")
    .replaceAll("源码", " ")
    .replaceAll("专辑", " ")
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase() ?? "";
}

export function extractReleaseDate(input: string): string | undefined {
  const fullDateMatch = input.match(/(?<year>\d{4})[.\-/年](?<month>\d{1,2})[.\-/月](?<day>\d{1,2})日?/);

  if (fullDateMatch?.groups) {
    return `${fullDateMatch.groups.year}.${fullDateMatch.groups.month.padStart(2, "0")}.${fullDateMatch.groups.day.padStart(2, "0")}`;
  }

  const compactFullDateMatch = input.match(/(?<!\d)(?<year>\d{4})(?<month>\d{2})(?<day>\d{2})(?!\d)/);

  if (compactFullDateMatch?.groups) {
    return `${compactFullDateMatch.groups.year}.${compactFullDateMatch.groups.month}.${compactFullDateMatch.groups.day}`;
  }

  const monthDayMatch = input.match(/(?<!\d)(?<month>\d{2})(?<day>\d{2})(?!\d)/);

  if (!monthDayMatch?.groups) {
    return undefined;
  }

  return `${new Date().getFullYear()}.${monthDayMatch.groups.month}.${monthDayMatch.groups.day}`;
}
