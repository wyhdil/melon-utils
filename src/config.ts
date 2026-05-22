export type AppConfig = {
  openaiApiKey?: string;
  melonDataProviderUrl?: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    openaiApiKey: env.OPENAI_API_KEY,
    melonDataProviderUrl: env.MELON_DATA_PROVIDER_URL,
  };
}
