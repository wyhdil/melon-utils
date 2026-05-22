import { normalizeArtistAlias } from "./artist-aliases.js";

export type SemanticSingleSourceRequest = {
  artist: string;
  title?: string;
  intent: "song" | "latest_album_title_track" | "debut_album_title_track" | "regular_album_title_track";
  streamCount?: string;
  releaseDate?: string;
};

type DeepSeekChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export async function parseSingleSourceWithDeepSeek(input: string): Promise<SemanticSingleSourceRequest | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat",
        response_format: { type: "json_object" },
        temperature: 0,
        messages: [
          {
            role: "system",
            content: [
              "你是 Melon 音源任务的语义解析器，只输出 JSON。",
              "任务是把用户口语输入解析为单曲音源查询。",
              "如果用户说主打曲、最新主打、最新专辑主打，intent 用 latest_album_title_track。",
              "如果用户说出道专、出道曲、出道主打，intent 用 debut_album_title_track。",
              "如果用户说正规专辑、正专、full album、studio album、정규，intent 用 regular_album_title_track。",
              "如果用户给了明确歌曲名，intent 用 song，并填写 title。",
              "artist 可以把中文花名转换为官方艺人名，例如 芒叉=MONSTA X。",
              "不要编 songId、发行日或 Melon 数据。",
              "If the user specifies a release date, output releaseDate as YYYY.MM.DD.",
              'JSON schema: {"module":"single_source","artist":"string","title":"string optional","intent":"song|latest_album_title_track|debut_album_title_track|regular_album_title_track","streamCount":"string optional","releaseDate":"YYYY.MM.DD optional"}',
            ].join("\n"),
          },
          {
            role: "user",
            content: input,
          },
        ],
      }),
    });

    if (!response.ok) {
      return null;
    }

    return normalizeSemanticSingleSourceRequest(await response.json() as DeepSeekChatResponse);
  } catch {
    return null;
  }
}

export function normalizeSemanticSingleSourceRequest(
  response: DeepSeekChatResponse,
): SemanticSingleSourceRequest | null {
  const content = response.choices?.[0]?.message?.content;

  if (!content) {
    return null;
  }

  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;

    if (parsed.module !== "single_source" || typeof parsed.artist !== "string") {
      return null;
    }

    const intent = parsed.intent === "latest_album_title_track" ||
      parsed.intent === "debut_album_title_track" ||
      parsed.intent === "regular_album_title_track"
      ? parsed.intent
      : "song";
    const title = typeof parsed.title === "string" ? parsed.title.trim() : undefined;

    if (intent === "song" && !title) {
      return null;
    }

    return {
      artist: normalizeArtistAlias(parsed.artist),
      title,
      intent,
      streamCount: typeof parsed.streamCount === "string" && /^\d+$/.test(parsed.streamCount) ? parsed.streamCount : undefined,
      releaseDate: typeof parsed.releaseDate === "string" && /^\d{4}\.\d{2}\.\d{2}$/.test(parsed.releaseDate)
        ? parsed.releaseDate
        : undefined,
    };
  } catch {
    return null;
  }
}
