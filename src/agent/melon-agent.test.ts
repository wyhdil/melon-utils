import assert from "node:assert/strict";
import test from "node:test";
import { listMelonAgentModules, runMelonAgent } from "./melon-agent.js";

process.env.MELON_DISABLE_LIVE = "1";

test("routes latest album source-list requests", async () => {
  const response = await runMelonAgent("给我 aespa 最新一张专辑的音源列表");

  assert.match(response.output, /latest_album_sources/);
  assert.match(response.output, /aespa/);
});

test("generates full source html for a configured TWS album", async () => {
  const response = await runMelonAgent("给我 tws 最新专辑的全曲源码", {
    moduleId: "album_source",
  });

  assert.match(response.output, /```html/);
  assert.match(response.output, /<tbody id="pageList">/);
  assert.match(response.output, /TWS 5th Mini Album 'NO TRAGEDY'/);
  assert.match(response.output, /너의 모든 가능성이 되어 줄게/);
});

test("lists the available feature modules", () => {
  const modules = listMelonAgentModules();

  assert.deepEqual(
    modules.map((module) => module.id),
    ["album_source", "melon_identity", "single_source", "download_list"],
  );
  assert.deepEqual(
    modules.map((module) => module.label),
    ["专辑音源", "melon实名", "单曲音源", "下载列表"],
  );
});

test("routes single source requests to the single song task", async () => {
  const response = await runMelonAgent("帮我处理一下", {
    moduleId: "single_source",
  });

  assert.match(response.output, /歌手名和歌曲名/);
});

test("generates melon identity template from name and birth date", async () => {
  const response = await runMelonAgent("huanglizhi,20050902", {
    moduleId: "melon_identity",
  });

  assert.match(response.output, /```html/);
  assert.match(response.output, /<strong class="tit-layer">이름\/나이 확인<\/strong>/);
  assert.match(response.output, /<dd>HU\*\*\* \*\*\*HI \(만 20세\)<\/dd>/);
  assertIdentityAuthDateInRange(response.output);
});

test("masks melon identity names using the surname boundary", async () => {
  const response = await runMelonAgent("ZHANGSAN,20050902", {
    moduleId: "melon_identity",
  });

  assert.match(response.output, /<dd>ZH\*\*\* \*AN \(만 20세\)<\/dd>/);
});

test("masks shen romanized surname before the given name", async () => {
  const response = await runMelonAgent("shenliuzhen,20010417", {
    moduleId: "melon_identity",
  });

  assert.match(response.output, /<dd>SH\*\* \*\*\*\*\*EN \(만 25세\)<\/dd>/);
});

test("masks cui romanized surname before the given name", async () => {
  const response = await runMelonAgent("cuizhixiu,20010828", {
    moduleId: "melon_identity",
  });

  assert.match(response.output, /<dd>CU\* \*\*\*\*IU \(만 24세\)<\/dd>/);
});

test("respects explicit spaces between surname and given name", async () => {
  const response = await runMelonAgent("CUI ZHIXIU,20010828", {
    moduleId: "melon_identity",
  });

  assert.match(response.output, /<dd>CU\* \*\*\*\*IU \(만 24세\)<\/dd>/);
});

test("preserves explicit name spacing for multiple name parts", async () => {
  const response = await runMelonAgent("HSU HAHA KE,20010828", {
    moduleId: "melon_identity",
  });

  assert.match(response.output, /<dd>HS\* \*\*\*\* KE \(만 24세\)<\/dd>/);
});

test("preserves the final two letters of the last explicit name part", async () => {
  const response = await runMelonAgent("HELLO HWTA,20000101", {
    moduleId: "melon_identity",
  });

  assert.match(response.output, /<dd>HE\*\*\* \*\*TA \(만 26세\)<\/dd>/);
});

test("uses a specified identity auth date instead of a random date", async () => {
  const response = await runMelonAgent("HELLO HWTA,20000101 指定认证日20260209", {
    moduleId: "melon_identity",
  });

  assert.match(response.output, /<dd>2026\.02\.09<\/dd>/);
});

test("uses a dotted specified identity auth date", async () => {
  const response = await runMelonAgent("test kk,20001010,指定认证日2026.02.02", {
    moduleId: "melon_identity",
  });

  assert.match(response.output, /<dd>TE\*\* KK \(만 25세\)<\/dd>/);
  assert.match(response.output, /<dd>2026\.02\.02<\/dd>/);
});

test("accepts dotted birth dates in melon identity input", async () => {
  const response = await runMelonAgent("SHI YUNLIN, 1991.08.14", {
    moduleId: "melon_identity",
  });

  assert.match(response.output, /<dd>SH\* \*\*\*\*IN \(만 34세\)<\/dd>/);
});

test("detects dated full source html requests", async () => {
  const response = await runMelonAgent("给我 tws 2026.04.27 发行的全曲源码");

  assert.match(response.output, /```html/);
  assert.match(response.output, /TWS 5th Mini Album 'NO TRAGEDY'/);
});

test("answers help and greeting prompts with supported examples", async () => {
  const response = await runMelonAgent("你好");

  assert.match(response.output, /我现在可以帮你生成 Melon 全曲源码/);
  assert.match(response.output, /给我 tws 最新专辑的全曲源码/);
});

test("returns unsupported response for unknown requests", async () => {
  const response = await runMelonAgent("今天上海天气怎么样");

  assert.match(response.output, /暂不支持/);
});

function assertIdentityAuthDateInRange(output: string): void {
  const match = output.match(/<dt>본인인증일<\/dt>\s*<dd>(?<date>\d{4}\.\d{2}\.\d{2})<\/dd>/);
  assert.ok(match?.groups?.date);

  const date = parseLocalDottedDate(match.groups.date);
  const now = new Date();
  const start = startOfDay(addMonthsClamped(now, -4));
  const end = startOfDay(addMonthsClamped(now, -2));
  assert.ok(date >= start, `${match.groups.date} should be on or after ${formatDate(start)}`);
  assert.ok(date <= end, `${match.groups.date} should be on or before ${formatDate(end)}`);
}

function addMonthsClamped(date: Date, months: number): Date {
  const targetFirstDay = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDayOfTargetMonth = new Date(
    targetFirstDay.getFullYear(),
    targetFirstDay.getMonth() + 1,
    0,
  ).getDate();
  const result = new Date(date);
  result.setFullYear(targetFirstDay.getFullYear(), targetFirstDay.getMonth(), Math.min(date.getDate(), lastDayOfTargetMonth));
  return result;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join(".");
}

function parseLocalDottedDate(date: string): Date {
  const [year, month, day] = date.split(".").map(Number);
  return new Date(year, month - 1, day);
}
