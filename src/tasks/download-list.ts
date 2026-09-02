import { fetchSongDetail, type MelonSongDetail } from "../tools/melon-live-client.js";
import type { AgentTask, AgentTaskResult } from "./types.js";

type SongDetailResolver = (songId: string) => Promise<MelonSongDetail>;

const downloadPanelPattern = String.raw`<div\s+class=["']inner_cont["'][^>]*\bid=["']tabpanel3["'][^>]*>[\s\S]*?<\/div>\s*<\/div>\s*(?=<div\s+class=["']melon-modal["'])`;

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
          `已生成 ${songs.length} 首歌曲的下载列表模板。将恢复完整控制区，并覆盖空列表或已有歌曲。${warning}`,
          "",
          "```regex",
          downloadPanelPattern,
          "```",
          "```html",
          renderDownloadPanel(songs),
          "```",
        ].join("\n"),
      };
    },
  };
}

export function parseSongIds(input: string): string[] {
  return [...new Set(input.match(/(?<!\d)\d{5,12}(?!\d)/g) ?? [])];
}

export function renderDownloadPanel(songs: MelonSongDetail[]): string {
  return `<div class="inner_cont" id="tabpanel3" role="tabpanel">
 <ul class="switch_toggle col2">
  <li class="switch_cell"><button type="button" class="switch_item is_active" onclick="moveToTab('MP3','');">MP3</button></li>
  <li class="switch_cell"><button type="button" class="switch_item" onclick="moveToTab('DCF','');">DCF</button></li>
 </ul>
 <div class="filter_toggle02">
  <button type="button" class="selected sprite filter" data-button-type="modal" data-target="#bottomsheetSort" data-selected-type="FIRST_DL_DATE">최신순</button>
 </div>
 <div class="service_header">
  <div class="controls">
   <input type="hidden" id="selectAllContsTypeInfo" value="songid" />
   <button type="button" class="check all-btn" id="check_all_btn" onclick="selectAllConts($(this).hasClass('check-btn'),'songid','');"><span class="hide">전체선택</span></button>
   <button type="button" class="sprite play small gray hide" id="play_all_btn" onclick="__appFormContentsFilterPlay(1000000340, '1', 'streamForm'); return false;">전체재생</button>
  </div>
 </div>
 <ul class="info_alert">
  <li class="item">MP3 이용권으로 다운로드, 개별곡 구매, 앨범구매 한 곡은 평생 소유할 수 있으며, 재생 유효기간은 무제한입니다.</li>
  <li class="item">구매목록 보관기간은 최초 구매일로부터 1년입니다.</li>
 </ul>
 <script type="text/javascript">
  var sortVal = 'FIRST_DL_DATE';
  if (listCode != 'SONGST' && listCode != 'MVST') {
   if (sortVal == '' || sortVal == 'FIRST_DL_DATE') {
    $('.selected').text('최신순');
   } else if (sortVal == 'SONG_NAME') {
    $('.selected').text('가나다순');
   } else {
    $('.selected').text('아티스트순');
   }
  }
 </script>
 <form name="streamForm" id="streamForm" method="post">
  <input type="hidden" name="menuId" value="1000000340" />
  <input type="hidden" name="contsType" value="3C0001" />
  <input type="hidden" name="paramsName" value="songid" />
  <input type="hidden" name="buyType" value="5" />
  <ul class="service_list is_check list_music webview_more" id="_mList">
${songs.map(renderDownloadListItem).join("\n\n")}
   <script type="text/javascript">finishedPageLoad(${songs.length},25);</script>
  </ul>
 </form>
</div>
</div>`;
}

export function renderDownloadListItem(song: MelonSongDetail): string {
  const title = escapeHtml(song.title);
  const artist = escapeHtml(song.artist);
  const coverUrl = escapeHtmlAttribute(song.coverUrl);

  return `<li id="${song.songId}" albumId="${song.albumId}" artistId="${song.artistId}" class="list_item" ontouchstart="touchStartHandler(event, 'song', this);" ontouchend="touchEndHandler(event);" ontouchmove="touchMoveHandler(event);" avail-data="true">
 <div class="thumb">
  <div class="inner">
   <span class="img" style="background-image:url('${coverUrl}')"></span>
   <input type="hidden" name="morethumbnail" value="${coverUrl}" />
  </div>
 </div>
 <div class="content" onclick="selectConts($(this), '', 'songid')">
  <div class="inner">
   <p class="title ellipsis">${title}</p>
   <span class="name ellipsis">${artist}</span>
  </div>
 </div>
 <div class="content button">
  <button type="button" class="sprite play small hide play_btn" onclick="__appContentPlayInMyBoxList('1000000340','1','${song.songId}');">재생</button>
 </div>
 <div class="content button more">
  <button type="button" class="sprite more hide" onclick="sidePop(this, 'song');">더보기</button>
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
