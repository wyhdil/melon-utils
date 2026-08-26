import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAlbumDetailPage,
  parseArtistAlbumsPage,
  parseArtistSearchPage,
  parseSuggestedSearchKeyword,
  parseSongDetailPage,
  parseSongSearchPage,
  pickTargetAlbum,
} from "./melon-live-client.js";

test("parses the first artist search result", () => {
  const artist = parseArtistSearchPage(`
    <a href="javascript:searchLog('web_tot','ARTIST','AR','tws','3679688');melon.link.goArtistDetail('3679688');" title="TWS&nbsp;(투어스) - 페이지 이동" class="atistname">
      <strong class="fc_serch"><b>TWS</b>&nbsp;(투어스)</strong>
    </a>
    <input type="hidden" name="artistId" value="3679688" />
  `);

  assert.deepEqual(artist, {
    artistId: "3679688",
    name: "TWS (투어스)",
  });
});

test("parses a Melon song detail page", () => {
  const result = parseSongDetailPage(`
    <div class="section_info"><div class="song_name"><strong class="none">곡명</strong>OMG!</div>
    <a href="javascript:melon.link.goArtistDetail('4708940')" title="ALPHA DRIVE ONE (알파드라이브원)" class="artist_name"><span>artist</span></a>
    <dt>앨범</dt><dd><a href="javascript:melon.link.goAlbumDetail('13624538');">UNBREAKABLE&nbsp;:&nbsp;少年BEAST</a></dd>
    <dt>발매일</dt><dd>2026.05.26</dd><div class="section_lyric"></div>
    <script type="application/ld+json">{"image":"https://cdnimg.melon.co.kr/cm2/album/images/136/24/538/13624538_20260824132802.jpg"}</script>
  `, "602070462");

  assert.deepEqual(result, {
    songId: "602070462",
    title: "OMG!",
    artistId: "4708940",
    artist: "ALPHA DRIVE ONE (알파드라이브원)",
    albumId: "13624538",
    album: "UNBREAKABLE : 少年BEAST",
    coverUrl: "https://cdnimg.melon.co.kr/cm2/album/images/136/24/538/13624538_20260824132802.jpg",
    releaseDate: "2026.05.26",
  });
});

test("parses Melon spelling suggestion for artist aliases", () => {
  const suggestedKeyword = parseSuggestedSearchKeyword(`
    <span class="search_speller">혹시 이것을 찾으셨나요?
      <a class="fc_serch" href="javascript:melon.link.goTotalSearch('LE SSERAFIM','total','searchFrm','','','N','SUGGEST')">LE&nbsp;SSERAFIM</a>
      검색결과 보기
    </span>
  `);

  assert.equal(suggestedKeyword, "LE SSERAFIM");
});

test("parses artist album list entries sorted by date", () => {
  const albums = parseArtistAlbumsPage(`
    <li class="album11_li">
      <a href="javascript:melon.link.goAlbumDetail('13352578');" title="TWS&nbsp;5th&nbsp;Mini&nbsp;Album&nbsp;&#x27;NO&nbsp;TRAGEDY&#x27; - 페이지 이동"></a>
      <span class="cnt_view">2026.04.27</span>
      <span class="tot_song">6곡</span>
    </li>
    <li class="album11_li">
      <a href="javascript:melon.link.goAlbumDetail('12938593');" title="YOU&nbsp;LIKE&nbsp;IT&nbsp;I&nbsp;LOVE&nbsp;IT - 페이지 이동"></a>
      <span class="cnt_view">2026.03.23</span>
      <span class="tot_song">2곡</span>
    </li>
  `);

  assert.equal(albums[0]?.albumId, "13352578");
  assert.equal(albums[0]?.title, "TWS 5th Mini Album 'NO TRAGEDY'");
  assert.equal(albums[0]?.releaseDate, "2026.04.27");
});

test("picks a nearby album date when the requested date is one day off", () => {
  const album = pickTargetAlbum(
    [
      { albumId: "13349271", title: "'PUREFLOW' pt.1", releaseDate: "2026.05.22" },
      { albumId: "13300000", title: "Older", releaseDate: "2026.05.06" },
    ],
    "2026.05.23",
  );

  assert.equal(album?.albumId, "13349271");
});

test("parses album detail metadata and tracks", () => {
  const album = parseAlbumDetailPage(
    `
      <strong class="none">앨범명</strong>
      TWS 5th Mini Album &#x27;NO TRAGEDY&#x27;
      <a href="javascript:melon.link.goArtistDetail('3679688')" title="TWS (투어스)" class="artist_name"><span>TWS (투어스)</span></a>
      <dt>발매일</dt><dd>2026.04.27</dd>
      <tr data-group-items="cd1">
        <input type="checkbox" title="너의 모든 가능성이 되어 줄게 곡 선택" class="input_check " name="input_check" value="601862625">
        <a href="javascript:melon.play.playSong('28010101',601862625);" title="너의 모든 가능성이 되어 줄게 재생">너의 모든 가능성이 되어 줄게</a>
      </tr>
      <tr data-group-items="cd1">
        <input type="checkbox" title="널 따라가 (You, You) 곡 선택" class="input_check " name="input_check" value="601862626">
        <span title="타이틀 곡" class="bullet_icons title"><span class="none">Title</span></span>
        <a href="javascript:melon.play.playSong('28010101',601862626);" title="널 따라가 (You, You) 재생">널 따라가 (You, You)</a>
      </tr>
    `,
    "13352578",
  );

  assert.equal(album.album, "TWS 5th Mini Album 'NO TRAGEDY'");
  assert.equal(album.singer, "TWS (투어스)");
  assert.equal(album.artist_id, "3679688");
  assert.equal(album.createAt, "2026.04.27");
  assert.deepEqual(album.songs, [
    { title: "너의 모든 가능성이 되어 줄게", song_id: "601862625", play_coll_id: "28010101" },
    { title: "널 따라가 (You, You)", song_id: "601862626", play_coll_id: "28010101", isTitleTrack: true },
  ]);
});

test("parses song search results from Melon total search", () => {
  const songs = parseSongSearchPage(`
    <tr>
      <td>
        <a href="javascript:searchLog('web_tot','SONG','SO','tws 널 따라가 (You, You)','601862626');melon.link.goSongDetail('601862626');" title="곡정보 보기" class="btn btn_icon_detail">
          <span class="odd_span">널&nbsp;따라가&nbsp;(You,&nbsp;You) 상세정보 페이지 이동</span>
        </a>
      </td>
      <td>
        <a href="javascript:searchLog('web_tot','SONG','SO','tws 널 따라가 (You, You)','601862626');melon.play.playSong('26020101',601862626);" class="fc_gray" title="널&nbsp;따라가&nbsp;(You,&nbsp;You)">널&nbsp;따라가&nbsp;(You,&nbsp;You)</a>
      </td>
      <td>
        <a href="javascript:melon.link.goArtistDetail('3679688');melon.link.goSearchLog('web_tot','SONG', 'AR', 'tws 널 따라가 (You, You)','601862626');" title="TWS&nbsp;(투어스) - 페이지 이동" class="fc_mgray">TWS&nbsp;(투어스)</a>
      </td>
      <td>
        <a href="javascript:searchLog('web_tot','SONG','AL','tws 널 따라가 (You, You)','601862626');melon.link.goAlbumDetail('13352578');" title="TWS&nbsp;5th&nbsp;Mini&nbsp;Album&nbsp;&#x27;NO&nbsp;TRAGEDY&#x27; - 페이지 이동" class="fc_mgray">TWS&nbsp;5th&nbsp;Mini&nbsp;Album&nbsp;&#x27;NO&nbsp;TRAGEDY&#x27;</a>
      </td>
    </tr>
  `);

  assert.deepEqual(songs, [
    {
      songId: "601862626",
      title: "널 따라가 (You, You)",
      artist: "TWS (투어스)",
      albumId: "13352578",
      album: "TWS 5th Mini Album 'NO TRAGEDY'",
    },
  ]);
});
