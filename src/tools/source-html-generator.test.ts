import assert from "node:assert/strict";
import test from "node:test";
import { generateAlbumSourceHtmlFromPayload } from "./source-html-generator.js";

test("renders apostrophes as readable text in generated album links", async () => {
  const result = await generateAlbumSourceHtmlFromPayload("tws", {
    album: "TWS 5th Mini Album 'NO TRAGEDY'",
    singer: "TWS (투어스)",
    artist_id: "3679688",
    album_id: "13352578",
    createAt: "2026.04.27",
    isWrap: false,
    songs: [{ title: "Back To Strangers", song_id: "601862630", play_coll_id: "28010101" }],
  });

  assert.match(result.html, />TWS 5th Mini Album 'NO TRAGEDY'<\/a>/);
  assert.match(result.html, /title="TWS 5th Mini Album 'NO TRAGEDY' - 페이지 이동"/);
  assert.doesNotMatch(result.html, /&#x27;/);
  assert.doesNotMatch(result.html, /&amp;#x27;/);
});
