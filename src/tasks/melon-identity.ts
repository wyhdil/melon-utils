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
          "```text",
          parsed.name,
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

function maskExplicitNameParts(parts: string[]): string {
  const totalLetters = parts.reduce((sum, part) => sum + part.length, 0);
  let letterIndex = 0;

  // User-provided spaces are authoritative, but masking is based on the full
  // name: only the first two and final two letters remain visible.
  return parts
    .map((part) =>
      [...part]
        .map((letter) => {
          const shouldShow = letterIndex < 2 || letterIndex >= totalLetters - 2;
          letterIndex += 1;
          return shouldShow ? letter : "*";
        })
        .join(""),
    )
    .join(" ");
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
  <div class="modal-layer">
   <div class="inner-layer">
    <div class="layer-head">
     <strong class="tit-layer">이름/나이 확인</strong>
    </div>
    <div class="layer-body">
     <div class="inner-body">
      <strong class="tit-popup">등록된 본인인증 정보를<br>확인해주세요.</strong>
      <dl class="info-identity">
       <div class="item-identity">
        <dt>이름</dt>
        
         
      <dd>${nameLine}</dd>
         
         
        
 
       </div>
       <div class="item-identity">
        <dt>본인인증일</dt>
        
         
          <dd>${escapeHtml(data.authDate)}</dd>
         
         
        
       </div>
      </dl>
      <ul class="list-notice">
       
        
         <li>본인인증 정보는 서비스 이용을 위한 나이확인 및 본인확인 용도로 활용됩니다. </li>
         <li>개명하셨다면, 본인인증을 통해 개명된 이름으로 변경할 수 있으며, 타인의 정보로는 변경할 수 없습니다.<br><a href=" " class="link-txt">개명하셨나요?</a ></li>
        
        
       
      </ul>
      <div class="wrap-btn">
       
        
         <button type="button" class="btn-modal" onclick="javascript:accountsJs.closeLayerPopup('setting-sub-layer');">
          <span class="txt-btn">확인</span>
         </button>
        
        
       
      </div>
     </div>
    </div>
    <button type="button" class="btn-modal btn-close" onclick="javascript:accountsJs.closeLayerPopup('setting-sub-layer');">
     <span class="ico-sprite ico-gnb-web-ca-close">닫기</span>
     <span class="ico-sprite ico-popup-layer-close">닫기</span>
    </button>
   </div>
  </div>
 </div>
 
 
 
 <script type="text/javascript">
  function popupAgeauth(){
     // 레이어 팝업 닫기.
     accountsJs.closeLayerPopup('setting-sub-layer');
 
     
     var title = "본인확인";
     // var rnmUrl = httpsMemberDomain + "/ageauth/main_inform.htm?viewType=CHANGENAME&cpId="+POC_ID+"&footer=off&callback=";
     var rnmUrl = httpsAccountsDomain + "/ageauth/main?viewType=CHANGENAME&cpId="+POC_ID+"&footer=off&callback=";
     var cbUrl = httpsAccountsDomain+"/ageauth/accounts_cbChangeName?cpId="+POC_ID;
     var url = "";
 
     if(POC_ID == 'IS40') {
       
       cbUrl = httpsAccountsDomain+"/ageauth/accounts_cbChangeNameIS40";
       url = "meloniphone://webview?close=N&type=CA&title="+encodeURIComponent(title)+"&url="+encodeURIComponent(rnmUrl+cbUrl);
       location.href = url;
     }else if(POC_ID == 'AS40'){
       url = "melonapp://webview?close=N&type=CA&title="+encodeURIComponent(title)+"&url="+encodeURIComponent(rnmUrl+cbUrl);
       location.href = url;
     }else if(POC_ID == 'IT40'){
       url = "melonipad://webview?close=N&type=CA&title="+encodeURIComponent(title)+"&url="+encodeURIComponent(rnmUrl+cbUrl);
       location.href = url;
     }else {
       window.name = "_MYINFO_CHANGE_NAME";
       window.open(rnmUrl+cbUrl, 'ACCOUNT_COMMON_WIN', 'app_,scrollbars=yes,resizable=yes,location=no,menubar=no,toolbar=no,statusbar=no,status=no,width=600,height=640,left=20,top=20');
     }
  }
 </script>`;
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
