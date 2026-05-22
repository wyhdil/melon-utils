import type { MelonAlbum } from "./melon-client.js";

export function formatSourcePayload(album: MelonAlbum): string {
  const tracks = album.tracks
    .map((track) => `${track.trackNumber}. ${track.title} - ${track.artist}`)
    .join("\n");

  return [
    "```melon-source",
    `artist: ${album.artist}`,
    `album: ${album.title}`,
    album.releaseDate ? `releaseDate: ${album.releaseDate}` : undefined,
    "tracks:",
    tracks,
    "```",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}
