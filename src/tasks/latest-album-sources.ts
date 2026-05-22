import { loadConfig } from "../config.js";
import { createMelonClient } from "../tools/melon-client.js";
import { formatSourcePayload } from "../tools/source-formatter.js";
import type { AgentTask, AgentTaskResult } from "./types.js";

export function createLatestAlbumSourcesTask(): AgentTask {
  return {
    name: "latest_album_sources",
    description: "Find the latest album for a group and produce a formatted source list.",
    async run(input: string): Promise<AgentTaskResult> {
      const artistName = extractArtistName(input);
      const config = loadConfig();
      const melonClient = createMelonClient(config);
      const album = await melonClient.findLatestAlbumByArtist(artistName);

      if (!album) {
        return {
          status: "needs_data_source",
          output: [
            "Task: latest_album_sources",
            `Artist: ${artistName}`,
            "",
            "当前项目骨架已经识别到这个任务，但还没有接入 Melon 数据源。",
            "下一步需要确定数据来源，以及最终音源源码的格式。",
          ].join("\n"),
        };
      }

      return {
        status: "ok",
        output: formatSourcePayload(album),
      };
    },
  };
}

function extractArtistName(input: string): string {
  const normalized = input
    .replaceAll("给我", " ")
    .replaceAll("最新一张专辑", " ")
    .replaceAll("最新专辑", " ")
    .replaceAll("的音源列表", " ")
    .replaceAll("音源列表", " ")
    .replaceAll("专辑", " ")
    .trim();

  return normalized || "UNKNOWN_ARTIST";
}
