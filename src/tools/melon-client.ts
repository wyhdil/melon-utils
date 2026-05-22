import type { AppConfig } from "../config.js";

export type MelonTrack = {
  title: string;
  artist: string;
  trackNumber: number;
};

export type MelonAlbum = {
  title: string;
  artist: string;
  releaseDate?: string;
  tracks: MelonTrack[];
};

export type MelonClient = {
  findLatestAlbumByArtist(artistName: string): Promise<MelonAlbum | null>;
};

export function createMelonClient(config: AppConfig): MelonClient {
  return {
    async findLatestAlbumByArtist(_artistName: string): Promise<MelonAlbum | null> {
      if (!config.melonDataProviderUrl) {
        return null;
      }

      throw new Error("MELON_DATA_PROVIDER_URL is configured, but the provider adapter is not implemented yet.");
    },
  };
}
