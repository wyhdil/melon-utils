const artistAliases = new Map<string, string>([
  ["芒叉", "MONSTA X"],
  ["monstax", "MONSTA X"],
  ["monsta x", "MONSTA X"],
  ["档", "TWS"],
  ["tws", "TWS"],
  ["吒", "aespa"],
  ["aespa", "aespa"],
  ["lessarafim", "LE SSERAFIM"],
  ["lesserafim", "LE SSERAFIM"],
  ["le sserafim", "LE SSERAFIM"],
  ["李泰容", "TAEYONG"],
  ["泰容", "TAEYONG"],
  ["taeyong", "TAEYONG"],
]);

export function normalizeArtistAlias(value: string): string {
  const trimmed = value.trim();
  const alias = artistAliases.get(normalizeAliasKey(trimmed));
  return alias ?? trimmed;
}

export function extractKnownArtistAlias(input: string): string | null {
  const normalizedInput = normalizeAliasKey(input);
  const aliases = Array.from(artistAliases.entries()).sort((left, right) => right[0].length - left[0].length);

  for (const [alias, artist] of aliases) {
    if (normalizedInput.includes(alias)) {
      return artist;
    }
  }

  return null;
}

function normalizeAliasKey(value: string): string {
  return value.toLowerCase().replace(/[\s\u00a0_\-]+/g, "");
}
