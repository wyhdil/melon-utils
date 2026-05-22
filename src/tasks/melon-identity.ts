import type { AgentTask, AgentTaskResult } from "./types.js";

type IdentityInput = {
  authDate?: string;
  birthDate: string;
  name: string;
};

type IdentityDateToken = {
  normalized: string;
  raw: string;
  index: number;
};

const romanizedSurnames = [
  "huang",
  "zhang",
  "wang",
  "li",
  "zhao",
  "chen",
  "yang",
  "wu",
  "liu",
  "zhou",
  "xu",
  "sun",
  "ma",
  "zhu",
  "hu",
  "guo",
  "he",
  "gao",
  "lin",
  "luo",
  "zheng",
  "liang",
  "xie",
  "song",
  "shen",
  "tang",
  "deng",
  "han",
  "feng",
  "cao",
  "cui",
  "peng",
  "xiao",
  "cai",
  "pan",
  "tian",
  "dong",
  "yuan",
  "ye",
].sort((left, right) => right.length - left.length);

export function createMelonIdentityTask(now: Date = new Date(), random: () => number = Math.random): AgentTask {
  return {
    name: "melon_identity",
    description: "Generate Melon identity verification HTML from a name and birth date.",
    async run(input: string): Promise<AgentTaskResult> {
      const parsed = parseIdentityInput(input);

      if (!parsed) {
        return {
          status: "error",
          output: "请提供名字和出生日期，例如：yeqianwen，20010608 或 SHI YUNLIN，1991.08.14",
        };
      }

      const html = renderMelonIdentityTemplate({
        age: calculateFullAge(parsed.birthDate, now),
        authDate: parsed.authDate ? formatIdentityDate(parsed.authDate) : chooseRandomIdentityAuthDate(now, random),
        maskedName: maskRomanizedName(parsed.name),
      });

      return {
        status: "ok",
        output: [
          "已生成 melon实名模板：",
          "",
          "```text",
          "melon-kkt-",
          "```",
          "```regex",
          "[\\s\\S]*",
          "```",
          "```html",
          html,
          "```",
        ].join("\n"),
      };
    },
  };
}

export function parseIdentityInput(input: string): IdentityInput | null {
  const authDateToken = parseSpecifiedAuthDateToken(input);
  const dateTokens = parseIdentityDateTokens(input);
  const birthDateToken = dateTokens.find((date) => date !== authDateToken && isValidBirthDate(date.normalized));
  const name = birthDateToken
    ? extractIdentityName(input, [...dateTokens, authDateToken].filter((date): date is IdentityDateToken => Boolean(date)))
    : undefined;

  if (
    !birthDateToken ||
    !name ||
    !isValidBirthDate(birthDateToken.normalized) ||
    (authDateToken && !isValidBirthDate(authDateToken.normalized))
  ) {
    return null;
  }

  return { authDate: authDateToken?.normalized, birthDate: birthDateToken.normalized, name };
}

export function maskRomanizedName(name: string): string {
  const explicitParts = name
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[^A-Za-z]/g, "").toUpperCase())
    .filter(Boolean);

  if (explicitParts.length >= 2) {
    return maskExplicitNameParts(explicitParts);
  }

  const normalized = name.replace(/[^A-Za-z]/g, "").toUpperCase();

  if (normalized.length <= 2) {
    return normalized;
  }

  const parts = splitRomanizedChineseName(normalized);

  if (!parts) {
    const hiddenLength = normalized.length - 4;
    return `${normalized.slice(0, 2)} ${"*".repeat(Math.max(0, hiddenLength))}${normalized.slice(-2)}`;
  }

  return `${maskSurname(parts.surname)} ${maskGivenName(parts.givenName)}`;
}

function splitRomanizedChineseName(normalizedName: string): { surname: string; givenName: string } | null {
  const lowerName = normalizedName.toLowerCase();
  const surname = romanizedSurnames.find((candidate) => lowerName.startsWith(candidate));

  if (!surname || surname.length >= normalizedName.length) {
    return null;
  }

  return {
    surname: normalizedName.slice(0, surname.length),
    givenName: normalizedName.slice(surname.length),
  };
}

function maskSurname(surname: string): string {
  if (surname.length <= 2) {
    return surname;
  }

  return `${surname.slice(0, 2)}${"*".repeat(surname.length - 2)}`;
}

function maskGivenName(givenName: string): string {
  if (givenName.length <= 2) {
    return givenName;
  }

  return `${"*".repeat(givenName.length - 2)}${givenName.slice(-2)}`;
}

function maskExplicitGivenNamePart(namePart: string): string {
  if (namePart.length <= 2) {
    return namePart;
  }

  return "*".repeat(namePart.length);
}

function maskExplicitNameParts(parts: string[]): string {
  const [surname, ...nameParts] = parts;

  // User-provided spaces are authoritative: surname, optional middle parts,
  // then final given-name part. Only the final part keeps its last two letters.
  return [
    maskSurname(surname),
    ...nameParts.map((part, index) =>
      index === nameParts.length - 1 ? maskGivenName(part) : maskExplicitGivenNamePart(part),
    ),
  ].join(" ");
}

export function calculateFullAge(birthDate: string, now: Date = new Date()): number {
  const year = Number(birthDate.slice(0, 4));
  const month = Number(birthDate.slice(4, 6));
  const day = Number(birthDate.slice(6, 8));
  const hasBirthdayPassed =
    now.getMonth() + 1 > month || (now.getMonth() + 1 === month && now.getDate() >= day);

  return now.getFullYear() - year - (hasBirthdayPassed ? 0 : 1);
}

export function chooseRandomIdentityAuthDate(now: Date = new Date(), random: () => number = Math.random): string {
  const start = addMonthsClamped(now, -4);
  const end = addMonthsClamped(now, -2);
  const totalDays = Math.floor((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86_400_000);
  const offsetDays = Math.floor(clampRandom(random()) * (totalDays + 1));

  return formatDate(addDays(start, offsetDays));
}

function renderMelonIdentityTemplate(data: { age: number; authDate: string; maskedName: string }): string {
  const nameLine = `${escapeHtml(data.maskedName)} (만 ${data.age}세)`;

  return `<div class="modal-dialog modal-myinfo">
\t<div class="modal-layer">
\t <div class="inner-layer">
\t  <div class="layer-head">
\t   <strong class="tit-layer">이름/나이 확인</strong>
\t  </div>
\t  <div class="layer-body">
\t   <div class="inner-body">
\t\t<strong class="tit-popup">등록된 본인인증 정보를<br>확인해주세요.</strong>
\t\t<dl class="info-identity">
\t\t <div class="item-identity">
\t\t  <dt>이름</dt>
\t\t  <dd>${nameLine}</dd>
\t\t </div>
\t\t <div class="item-identity">
\t\t  <dt>본인인증일</dt>
\t\t  <dd>${escapeHtml(data.authDate)}</dd>
\t\t </div>
\t\t</dl>
\t\t<ul class="list-notice">
\t\t <li>본인인증 정보는 서비스 이용을 위한 나이확인 및 본인확인 용도로 활용됩니다. </li>
\t\t <li>개명하셨다면, 본인인증을 통해 개명된 이름으로 변경할 수 있으며, 타인의 정보로는 변경할 수 없습니다.<br><a href=" " class="link-txt">개명하셨나요?</a></li>
\t\t</ul>
\t\t<div class="wrap-btn">
\t\t <button type="button" class="btn-modal" onclick="javascript:accountsJs.closeLayerPopup('setting-sub-layer');">
\t\t  <span class="txt-btn">확인</span>
\t\t </button>
\t\t</div>
\t   </div>
\t  </div>
\t  <button type="button" class="btn-modal btn-close" onclick="javascript:accountsJs.closeLayerPopup('setting-sub-layer');">
\t   <span class="ico-sprite ico-gnb-web-ca-close">닫기</span>
\t   <span class="ico-sprite ico-popup-layer-close">닫기</span>
\t  </button>
\t </div>
\t</div>
</div>`;
}

function isValidBirthDate(birthDate: string): boolean {
  const year = Number(birthDate.slice(0, 4));
  const month = Number(birthDate.slice(4, 6));
  const day = Number(birthDate.slice(6, 8));
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonthsClamped(date: Date, months: number): Date {
  const targetFirstDay = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDayOfTargetMonth = new Date(
    targetFirstDay.getFullYear(),
    targetFirstDay.getMonth() + 1,
    0,
  ).getDate();

  return new Date(
    targetFirstDay.getFullYear(),
    targetFirstDay.getMonth(),
    Math.min(date.getDate(), lastDayOfTargetMonth),
  );
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function clampRandom(value: number): number {
  if (Number.isNaN(value) || value < 0) {
    return 0;
  }

  if (value >= 1) {
    return 0.999999999;
  }

  return value;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function formatIdentityDate(date: string): string {
  return `${date.slice(0, 4)}.${date.slice(4, 6)}.${date.slice(6, 8)}`;
}

function parseSpecifiedAuthDateToken(input: string): IdentityDateToken | undefined {
  return parseIdentityDateTokens(input).find((date) => {
    const beforeDate = input.slice(Math.max(0, date.index - 24), date.index);
    return /指定认证日|认证日|본인인증일/iu.test(beforeDate);
  });
}

function parseIdentityDateTokens(input: string): IdentityDateToken[] {
  const tokens = [
    ...matchSeparatedDateTokens(input),
    ...matchSpacedDateTokens(input),
    ...matchCompactDateTokens(input),
  ];

  return tokens
    .filter((date, index, dates) => dates.findIndex((candidate) => candidate.index === date.index) === index)
    .sort((left, right) => left.index - right.index);
}

function matchSeparatedDateTokens(input: string): IdentityDateToken[] {
  return [...input.matchAll(/(?<!\d)(?<year>\d{4})\s*(?:[.\-/]|年)\s*(?<month>\d{1,2})\s*(?:[.\-/]|月)\s*(?<day>\d{1,2})\s*日?(?!\d)/gu)]
    .map((match) => toIdentityDateToken(match))
    .filter((date): date is IdentityDateToken => date !== null);
}

function matchSpacedDateTokens(input: string): IdentityDateToken[] {
  return [...input.matchAll(/(?<!\d)(?<year>\d{4})\s+(?<month>\d{1,2})\s+(?<day>\d{1,2})(?!\d)/gu)]
    .map((match) => toIdentityDateToken(match))
    .filter((date): date is IdentityDateToken => date !== null);
}

function matchCompactDateTokens(input: string): IdentityDateToken[] {
  return [...input.matchAll(/(?<!\d)(?<year>\d{4})(?<month>\d{2})(?<day>\d{2})(?!\d)/gu)]
    .map((match) => toIdentityDateToken(match))
    .filter((date): date is IdentityDateToken => date !== null);
}

function toIdentityDateToken(match: RegExpMatchArray): IdentityDateToken | null {
  if (match.index === undefined || !match.groups) {
    return null;
  }

  return {
    normalized: `${match.groups.year}${match.groups.month.padStart(2, "0")}${match.groups.day.padStart(2, "0")}`,
    raw: match[0],
    index: match.index,
  };
}

function extractIdentityName(input: string, dateTokens: IdentityDateToken[]): string | undefined {
  const cleaned = dateTokens
    .filter((date): date is IdentityDateToken => Boolean(date))
    .reduce((result, date) => result.replace(date.raw, " "), input)
    .replace(/指定认证日|认证日|본인인증일|出生日期|生日|出生|born|birth(?:day| date)?/giu, " ")
    .replace(/[,，:：]/g, " ");

  return cleaned.match(/[A-Za-z]+(?:\s+[A-Za-z]+)*/)?.[0]?.trim();
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
