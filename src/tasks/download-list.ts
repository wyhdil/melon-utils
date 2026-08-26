import { fetchSongDetail, type MelonSongDetail } from "../tools/melon-live-client.js";
import type { AgentTask, AgentTaskResult } from "./types.js";

type SongDetailResolver = (songId: string) => Promise<MelonSongDetail>;

const songListPattern = String.raw`<ul\b(?=[^>]*\bid=["']_mList["'])[^>]*>[\s\S]*?<\/ul>`;

export function createDownloadListTask(resolveSong: SongDetailResolver = fetchSongDetail): AgentTask {
  return {
    name: "download_list",
    description: "Generate Melon purchase-list song HTML from one or more songIds.",
    async run(input: string): Promise<AgentTaskResult> {
      const songIds = parseSongIds(input);

      if (songIds.length === 0) {
        return {
          status: "error",
          output: "请输入一个或多个 Melon songId，可用逗号、空格或换行分隔。",
        };
      }

      if (songIds.length > 20) {
        return { status: "error", output: "一次最多生成 20 首歌曲，请减少 songId 数量后重试。" };
      }

      const songs: MelonSongDetail[] = [];
      const failedIds: string[] = [];

      for (const songId of songIds) {
        try {
          songs.push(await resolveSong(songId));
        } catch {
          failedIds.push(songId);
        }
      }

      if (songs.length === 0) {
        return {
          status: "error",
          output: `没有成功读取歌曲信息，请检查 songId：${failedIds.join(", ")}`,
        };
      }

      const warning = failedIds.length > 0 ? `\n未能读取：${failedIds.join(", ")}` : "";

      return {
        status: "ok",
        output: [
          `已生成 ${songs.length} 首歌曲的下载列表模板。无论原列表为空或已有歌曲，都将整体覆盖。${warning}`,
          "",
          "```regex",
          songListPattern,
          "```",
          "```html",
          renderDownloadList(songs),
          "```",
        ].join("\n"),
      };
    },
  };
}

export function parseSongIds(input: string): string[] {
  return [...new Set(input.match(/(?<!\d)\d{5,12}(?!\d)/g) ?? [])];
}

export function renderDownloadList(songs: MelonSongDetail[]): string {
  return `<ul class="service_list is_check list_music webview_more" id="_mList">
${songs.map(renderDownloadListItem).join("\n\n")}
</ul>`;
}

export function renderDownloadListItem(song: MelonSongDetail): string {
  const title = escapeHtml(song.title);
  const artist = escapeHtml(song.artist);
  const coverUrl = escapeHtmlAttribute(song.coverUrl);

  return `<li id="${song.songId}" albumId="${song.albumId}" artistId="${song.artistId}" class="list_item" avail-data="true">
 <div class="thumb">
  <div class="inner">
   <span class="img" style="background-image:url('${coverUrl}')"></span>
   <input type="hidden" name="morethumbnail" value="${coverUrl}" />
  </div>
 </div>
 <div class="content">
  <div class="inner">
   <p class="title ellipsis">${title}</p>
   <span class="name ellipsis">${artist}</span>
  </div>
 </div>
 <div class="content button more">
  <button type="button" class="sprite more hide">더보기</button>
 </div>
 <input type="checkbox" class="contsName" name="songid" value="${song.songId}" style="display:none;" />
 <input type="checkbox" name="usedDrmFlg" value="MP3" style="display:none;" />
 <input type="hidden" name="songName" value="${escapeHtmlAttribute(song.title)}" />
 <input type="hidden" name="artistName" value="${escapeHtmlAttribute(song.artist)}" />
 <input type="hidden" name="artistId" value="${song.artistId}" />
 <input type="hidden" name="albumId" value="${song.albumId}" />
 <input type="hidden" name="albumName" value="${escapeHtmlAttribute(song.album)}" />
 <input type="hidden" name="adultFlg" value="false" />
 <input type="hidden" name="isMv" value="false" />
</li>`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
