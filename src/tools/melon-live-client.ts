import { spawn } from "node:child_process";

export type MelonArtistSearchResult = {
  artistId: string;
  name: string;
};

export type MelonAlbumSummary = {
  albumId: string;
  title: string;
  releaseDate: string;
  totalSongs?: number;
};

export type MelonAlbumPayload = {
  songs: Array<{
    title: string;
    song_id: string;
    play_coll_id: string;
    isTitleTrack?: boolean;
  }>;
  singer: string;
  album: string;
  createAt: string;
  artist_id: string;
  album_id: string;
  isWrap: boolean;
};

export type MelonSongSearchResult = {
  songId: string;
  title: string;
  artist: string;
  albumId?: string;
  album?: string;
  releaseDate?: string;
};

export type MelonSongDetail = {
  songId: string;
  title: string;
  artistId: string;
  artist: string;
  albumId: string;
  album: string;
  coverUrl: string;
  releaseDate?: string;
};

const melonBaseUrl = "https://www.melon.com";
const requestHeaders = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146 Safari/537.36",
  referer: "https://www.melon.com/",
};

export async function fetchLiveAlbumPayload(
  artistQuery: string,
  options: { releaseDate?: string } = {},
): Promise<MelonAlbumPayload | null> {
  const artist = await searchArtist(artistQuery);

  if (!artist) {
    return null;
  }

  const albums = await fetchArtistAlbums(artist.artistId);
  const targetAlbum = pickTargetAlbum(albums, options.releaseDate);

  if (!targetAlbum) {
    return null;
  }

  return fetchAlbumDetail(targetAlbum.albumId);
}

export async function searchArtist(query: string): Promise<MelonArtistSearchResult | null> {
  const url = `${melonBaseUrl}/search/total/index.htm?q=${encodeURIComponent(query)}`;
  const html = await fetchMelonText(url);
  const artist = parseArtistSearchPage(html);

  if (artist) {
    return artist;
  }

  const suggestedKeyword = parseSuggestedSearchKeyword(html);
  if (!suggestedKeyword || normalizedSearchText(suggestedKeyword) === normalizedSearchText(query)) {
    return null;
  }

  const suggestedUrl = `${melonBaseUrl}/search/total/index.htm?q=${encodeURIComponent(suggestedKeyword)}`;
  return parseArtistSearchPage(await fetchMelonText(suggestedUrl));
}

export async function fetchArtistAlbums(artistId: string): Promise<MelonAlbumSummary[]> {
  const url = `${melonBaseUrl}/artist/album.htm?artistId=${encodeURIComponent(artistId)}`;
  return parseArtistAlbumsPage(await fetchMelonText(url));
}

export async function fetchAlbumDetail(albumId: string): Promise<MelonAlbumPayload> {
  const url = `${melonBaseUrl}/album/detail.htm?albumId=${encodeURIComponent(albumId)}`;
  return parseAlbumDetailPage(await fetchMelonText(url), albumId);
}

export async function searchSong(artistQuery: string, songTitle: string): Promise<MelonSongSearchResult | null> {
  const searchPageUrl = `${melonBaseUrl}/search/total/index.htm?q=${encodeURIComponent(`${artistQuery} ${songTitle}`)}`;
  const searchResults = parseSongSearchPage(await fetchMelonText(searchPageUrl));
  const directMatch = pickBestSongMatch(searchResults, artistQuery, songTitle);

  if (directMatch) {
    return enrichSongWithReleaseDate(directMatch);
  }

  return searchSongFromArtistAlbums(artistQuery, songTitle);
}

export async function fetchSongDetail(songId: string): Promise<MelonSongDetail> {
  if (!/^\d{5,12}$/.test(songId)) {
    throw new Error(`Invalid Melon songId: ${songId}`);
  }

  const url = `${melonBaseUrl}/song/detail.htm?songId=${encodeURIComponent(songId)}`;
  return parseSongDetailPage(await fetchMelonText(url), songId);
}

export function parseSongDetailPage(html: string, songId: string): MelonSongDetail {
  const detail = html.match(/<div class="section_info">[\s\S]*?<div class="section_(?:lyric|prdcr)/)?.[0] ?? html;
  const title = detail.match(
    /<div class="song_name">[\s\S]*?<strong[^>]*>곡명<\/strong>(?<title>[\s\S]*?)<\/div>/,
  )?.groups?.title;
  const artist = detail.match(
    /goArtistDetail\('(?<artistId>\d+)'\)[^>]*title="(?<artist>[^"]+)"[^>]*class="artist_name"/,
  )?.groups;
  const album = detail.match(
    /<dt>앨범<\/dt>\s*<dd><a[^>]*goAlbumDetail\('(?<albumId>\d+)'\)[^>]*>(?<album>[\s\S]*?)<\/a><\/dd>/,
  )?.groups;
  const releaseDate = detail.match(
    /<dt>발매일<\/dt>\s*<dd>(?<date>\d{4}\.\d{2}\.\d{2})<\/dd>/,
  )?.groups?.date;
  const rawCover =
    html.match(/"image"\s*:\s*"(?<url>https:\/\/cdnimg\.melon\.co\.kr\/[^"]+)"/)?.groups?.url ??
    html.match(/<meta property="og:image" content="(?<url>[^"]+)"/)?.groups?.url;

  if (!title || !artist?.artistId || !artist.artist || !album?.albumId || !album.album || !rawCover) {
    throw new Error(`Unable to parse Melon song detail page for ${songId}.`);
  }

  return {
    songId,
    title: cleanTitle(title),
    artistId: artist.artistId,
    artist: cleanTitle(artist.artist),
    albumId: album.albumId,
    album: cleanTitle(album.album),
    coverUrl: rawCover
      .replace(/_500(?=\.jpg(?:$|\?))/, "")
      .replace(/[?].*$/, "")
      .replace(/\/melon\/.*$/, ""),
    ...(releaseDate ? { releaseDate } : {}),
  };
}

export async function fetchLatestAlbumTitleTrack(
  artistQuery: string,
  releaseDate?: string,
): Promise<MelonSongSearchResult | null> {
  const artist = await searchArtist(artistQuery);

  if (!artist) {
    return null;
  }

  const albums = await fetchArtistAlbums(artist.artistId);
  const targetAlbum = pickTargetAlbum(albums, releaseDate);

  if (!targetAlbum) {
    return null;
  }

  const albumDetail = await fetchAlbumDetail(targetAlbum.albumId);
  const titleTrack = albumDetail.songs.find((song) => song.isTitleTrack) ?? albumDetail.songs[0];

  if (!titleTrack) {
    return null;
  }

  return {
    songId: titleTrack.song_id,
    title: titleTrack.title,
    artist: albumDetail.singer,
    albumId: albumDetail.album_id,
    album: albumDetail.album,
    releaseDate: albumDetail.createAt,
  };
}

export function parseArtistSearchPage(html: string): MelonArtistSearchResult | null {
  const artistLink = html.match(
    /melon\.link\.goArtistDetail\('(?<artistId>\d+)'\)[\s\S]{0,300}?class="atistname"[\s\S]*?>(?<name>[\s\S]*?)<\/a>/,
  );

  if (!artistLink?.groups) {
    return null;
  }

  return {
    artistId: artistLink.groups.artistId,
    name: cleanText(artistLink.groups.name),
  };
}

export function parseSuggestedSearchKeyword(html: string): string | null {
  const suggestion =
    html.match(/goTotalSearch\('(?<keyword>[^']+)','total'[\s\S]{0,200}?SUGGEST/) ??
    html.match(/<span class="search_speller">[\s\S]*?<a[^>]*>(?<keyword>[\s\S]*?)<\/a>/);

  if (!suggestion?.groups?.keyword) {
    return null;
  }

  return cleanText(suggestion.groups.keyword);
}

export function parseArtistAlbumsPage(html: string): MelonAlbumSummary[] {
  const albumBlocks = html.split(/<li class="album11_li">/).slice(1);

  const albums: Array<MelonAlbumSummary | null> = albumBlocks.map((block) => {
      const albumId = block.match(/goAlbumDetail\('(?<albumId>\d+)'\)/)?.groups?.albumId;
      const title = block.match(/goAlbumDetail\('\d+'\)[\s\S]*?title="(?<title>[^"]+)"/)?.groups?.title;
      const releaseDate = block.match(/<span class="cnt_view">(?<releaseDate>\d{4}\.\d{2}\.\d{2})<\/span>/)
        ?.groups?.releaseDate;
      const totalSongs = block.match(/<span class="tot_song">(?<totalSongs>\d+)곡<\/span>/)?.groups?.totalSongs;

      if (!albumId || !title || !releaseDate) {
        return null;
      }

      return {
        albumId,
        title: cleanTitle(title),
        releaseDate,
        totalSongs: totalSongs ? Number(totalSongs) : undefined,
      };
    });

  return albums
    .filter((album): album is MelonAlbumSummary => album !== null)
    .sort((left, right) => right.releaseDate.localeCompare(left.releaseDate));
}

export function pickTargetAlbum(albums: MelonAlbumSummary[], releaseDate?: string): MelonAlbumSummary | undefined {
  if (!releaseDate) {
    return albums[0];
  }

  const normalizedReleaseDate = normalizeDate(releaseDate);
  const exactAlbum = albums.find((album) => album.releaseDate === normalizedReleaseDate);

  if (exactAlbum) {
    return exactAlbum;
  }

  return albums
    .map((album) => ({
      album,
      dayDifference: Math.abs(daysBetween(album.releaseDate, normalizedReleaseDate)),
    }))
    .filter(({ dayDifference }) => dayDifference <= 1)
    .sort((left, right) => left.dayDifference - right.dayDifference || right.album.releaseDate.localeCompare(left.album.releaseDate))[0]
    ?.album;
}

export function parseAlbumDetailPage(html: string, albumId: string): MelonAlbumPayload {
  const album = parseAlbumTitle(html);
  const artist = parseAlbumArtist(html);
  const createAt = parseReleaseDate(html);
  const songs = parseAlbumTracks(html);

  if (!album || !artist || !createAt || songs.length === 0) {
    throw new Error("Unable to parse Melon album detail page.");
  }

  return {
    songs,
    singer: artist.name,
    album,
    createAt,
    artist_id: artist.artistId,
    album_id: albumId,
    isWrap: false,
  };
}

export function parseSongSearchPage(html: string): MelonSongSearchResult[] {
  const songList = html.match(/<div class="(?:section_)?(?:song|search_song)[\s\S]*?<\/form>/)?.[0] ?? html;
  const rows = Array.from(songList.matchAll(/<tr[\s\S]*?<\/tr>/g), (match) => match[0]);

  return rows
    .map(parseSongSearchRow)
    .filter((song): song is MelonSongSearchResult => song !== null);
}

async function searchSongFromArtistAlbums(
  artistQuery: string,
  songTitle: string,
): Promise<MelonSongSearchResult | null> {
  const artist = await searchArtist(artistQuery);

  if (!artist) {
    return null;
  }

  const albums = await fetchArtistAlbums(artist.artistId);
  for (const album of albums.slice(0, 20)) {
    const albumDetail = await fetchAlbumDetail(album.albumId);
    const song = albumDetail.songs.find((candidate) => sameNormalizedText(candidate.title, songTitle));

    if (song) {
      return {
        songId: song.song_id,
        title: song.title,
        artist: albumDetail.singer,
        albumId: albumDetail.album_id,
        album: albumDetail.album,
        releaseDate: albumDetail.createAt,
      };
    }
  }

  return null;
}

function parseSongSearchRow(row: string): MelonSongSearchResult | null {
  const songId = row.match(/goSongDetail\('(?<songId>\d+)'\)/)?.groups?.songId ?? row.match(/data-song-no="(?<songId>\d+)"/)
    ?.groups?.songId;
  const title =
    row.match(/class="fc_gray"[^>]*title="(?<title>[^"]+)"/)?.groups?.title ??
    row.match(/goSongDetail\('\d+'\)[\s\S]*?<span[^>]*>(?<title>[\s\S]*?) 상세정보 페이지 이동<\/span>/)?.groups
      ?.title;
  const artist = row.match(/class="fc_mgray"[^>]*>(?<artist>[\s\S]*?)<\/a>/)?.groups?.artist;
  const album =
    row.match(/goAlbumDetail\('\d+'\)[^>]*title="(?<album>[^"]+)"/)?.groups?.album ??
    row.match(/goAlbumDetail\('\d+'\)[^>]*class="fc_mgray"[^>]*>(?<album>[\s\S]*?)<\/a>/)?.groups?.album;
  const albumId = row.match(/goAlbumDetail\('(?<albumId>\d+)'\)/)?.groups?.albumId;

  if (!songId || !title || !artist) {
    return null;
  }

  return {
    songId,
    title: cleanTitle(title),
    artist: cleanTitle(artist),
    albumId,
    album: album ? cleanTitle(album) : undefined,
  };
}

async function enrichSongWithReleaseDate(song: MelonSongSearchResult): Promise<MelonSongSearchResult> {
  if (!song.albumId || song.releaseDate) {
    return song;
  }

  try {
    const album = await fetchAlbumDetail(song.albumId);

    return {
      ...song,
      album: song.album ?? album.album,
      releaseDate: album.createAt,
    };
  } catch {
    return song;
  }
}

function pickBestSongMatch(
  songs: MelonSongSearchResult[],
  artistQuery: string,
  songTitle: string,
): MelonSongSearchResult | null {
  const exactTitle = songs.filter((song) => sameNormalizedText(song.title, songTitle));

  return (
    exactTitle.find((song) => artistMatches(song.artist, artistQuery)) ??
    exactTitle[0] ??
    songs.find((song) => normalizedSearchText(song.title).includes(normalizedSearchText(songTitle))) ??
    null
  );
}

function artistMatches(artist: string, artistQuery: string): boolean {
  const normalizedArtist = normalizedSearchText(artist);
  const normalizedQuery = normalizedSearchText(artistQuery);

  return normalizedArtist.includes(normalizedQuery) || normalizedQuery.includes(normalizedArtist);
}

function sameNormalizedText(left: string, right: string): boolean {
  return normalizedSearchText(left) === normalizedSearchText(right);
}

function normalizedSearchText(value: string): string {
  return cleanText(value).toLowerCase().replace(/[\s\u00a0]+/g, "");
}

function parseAlbumTitle(html: string): string {
  const title = html.match(/<strong class="none">앨범명<\/strong>\s*(?<title>[^<]+)/)?.groups?.title;
  return cleanTitle(title ?? "");
}

function parseAlbumArtist(html: string): { artistId: string; name: string } | null {
  const artist = html.match(
    /melon\.link\.goArtistDetail\('(?<artistId>\d+)'\)[^>]*title="(?<name>[^"]+)"[^>]*class="artist_name"/,
  );

  if (!artist?.groups) {
    return null;
  }

  return {
    artistId: artist.groups.artistId,
    name: cleanText(artist.groups.name),
  };
}

function parseReleaseDate(html: string): string {
  const releaseDate = html.match(/<dt>발매일<\/dt>\s*<dd>(?<releaseDate>\d{4}\.\d{2}\.\d{2})<\/dd>/)
    ?.groups?.releaseDate;
  return releaseDate ?? "";
}

function parseAlbumTracks(html: string): MelonAlbumPayload["songs"] {
  return matchAll(html, /<tr data-group-items="cd\d+">([\s\S]*?)<\/tr>/g)
    .map((row) => {
      const songId = row.match(/name="input_check" value="(?<songId>\d+)"/)?.groups?.songId;
      const playSong = row.match(/melon\.play\.playSong\('(?<playCollId>\d+)',\s*(?<playSongId>\d+)\)/)?.groups;
      const title =
        row.match(/melon\.play\.playSong\('\d+',\s*\d+\);" title="(?<title>[^"]+) 재생"/)?.groups?.title ??
        row.match(/name="input_check" value="\d+"[^>]*title="(?<title>[^"]+) 곡 선택"/)?.groups?.title;

      if (!songId || !playSong?.playCollId || !title) {
        return null;
      }

      const isTitleTrack = /bullet_icons\s+title/.test(row) || /title="타이틀 곡"/.test(row);

      const parsedSong: MelonAlbumPayload["songs"][number] = {
        title: cleanText(title),
        song_id: songId,
        play_coll_id: playSong.playCollId,
        ...(isTitleTrack ? { isTitleTrack } : {}),
      };

      return parsedSong;
    })
    .filter((song): song is MelonAlbumPayload["songs"][number] => song !== null);
}

function normalizeDate(date: string): string {
  const parts = date.match(/(?<year>\d{4})[.\-/](?<month>\d{1,2})[.\-/](?<day>\d{1,2})/)?.groups;

  if (!parts) {
    return date;
  }

  return `${parts.year}.${parts.month.padStart(2, "0")}.${parts.day.padStart(2, "0")}`;
}

function daysBetween(left: string, right: string): number {
  const leftDate = parseDateAsUtc(left);
  const rightDate = parseDateAsUtc(right);

  if (!leftDate || !rightDate) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.round((leftDate.getTime() - rightDate.getTime()) / 86_400_000);
}

function parseDateAsUtc(date: string): Date | null {
  const parts = date.match(/(?<year>\d{4})\.(?<month>\d{2})\.(?<day>\d{2})/)?.groups;

  if (!parts) {
    return null;
  }

  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
}

async function fetchMelonText(url: string): Promise<string> {
  try {
    const response = await fetch(url, { headers: requestHeaders });

    if (!response.ok) {
      throw new Error(`Melon request failed: ${response.status} ${url}`);
    }

    return response.text();
  } catch (error) {
    if (!isFetchNetworkError(error)) {
      throw error;
    }

    return fetchMelonTextWithCurl(url);
  }
}

function fetchMelonTextWithCurl(url: string): Promise<string> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn("curl", [
      "-L",
      "-s",
      "--compressed",
      url,
      "-H",
      `user-agent: ${requestHeaders["user-agent"]}`,
      "-H",
      `referer: ${requestHeaders.referer}`,
    ]);
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

      if (code === 0 && body.trim()) {
        resolveRun(body);
        return;
      }

      rejectRun(new Error(`curl failed for Melon request: ${Buffer.concat(stderr).toString("utf8").trim()}`));
    });
  });
}

function isFetchNetworkError(error: unknown): boolean {
  return error instanceof TypeError && error.message === "fetch failed";
}

function matchAll(input: string, pattern: RegExp): string[] {
  return Array.from(input.matchAll(pattern), (match) => match[1] ?? "");
}

function cleanTitle(value: string): string {
  return cleanText(value.replace(/\s+-\s*페이지 이동\s*$/, ""));
}

function cleanText(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, number: string) => String.fromCodePoint(Number.parseInt(number, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
