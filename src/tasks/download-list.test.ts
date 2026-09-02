import assert from "node:assert/strict";
import test from "node:test";
import { createDownloadListTask, parseSongIds, renderDownloadListItem } from "./download-list.js";

const song = {
  songId: "602070462",
  title: "OMG!",
  artistId: "4708940",
  artist: "ALPHA DRIVE ONE (알파드라이브원)",
  albumId: "13624538",
  album: "UNBREAKABLE : 少年BEAST",
  coverUrl: "https://cdnimg.melon.co.kr/cm2/album/images/136/24/538/13624538_20260824132802.jpg",
};

test("parses and de-duplicates multiple songIds", () => {
  assert.deepEqual(parseSongIds("602070462, 602070463\n602070462"), ["602070462", "602070463"]);
});

test("generates copyable regex and batch list HTML", async () => {
  const task = createDownloadListTask(async (songId) => ({ ...song, songId, title: `Song ${songId}` }));
  const result = await task.run("602070462,602070463");

  assert.equal(result.status, "ok");
  assert.match(result.output, /```regex/);
  assert.match(result.output, /tabpanel3/);
  assert.match(result.output, /```html/);
  assert.match(result.output, /class="switch_toggle col2"/);
  assert.match(result.output, /id="check_all_btn"/);
  assert.match(result.output, /<ul class="service_list is_check list_music webview_more" id="_mList">/);
  assert.match(result.output, /id="602070462"/);
  assert.match(result.output, /id="602070463"/);
});

test("generated regex matches empty and populated Melon download panels", async () => {
  const task = createDownloadListTask(async () => song);
  const result = await task.run(song.songId);
  const pattern = result.output.match(/```regex\n(?<pattern>[\s\S]*?)\n```/)?.groups?.pattern;

  assert.ok(pattern);
  const regex = new RegExp(pattern);
  assert.match('<div class="inner_cont" id="tabpanel3"><ul id="_mList"><div class="empty_list">empty</div></ul></div></div><div class="melon-modal">', regex);
  assert.match('<div class="inner_cont" id="tabpanel3"><ul class="switch_toggle"></ul><ul id="_mList"><li>old song</li></ul></div></div>\n<div class="melon-modal">', regex);
});

test("escapes metadata when rendering list items", () => {
  const html = renderDownloadListItem({ ...song, title: 'A < B & "C"', album: "It's album" });

  assert.match(html, /A &lt; B &amp; "C"/);
  assert.match(html, /value="A &lt; B &amp; &quot;C&quot;"/);
  assert.match(html, /value="It&#39;s album"/);
  assert.match(html, /class="sprite play small hide play_btn"/);
  assert.match(html, /__appContentPlayInMyBoxList\('1000000340','1','602070462'\)/);
});
