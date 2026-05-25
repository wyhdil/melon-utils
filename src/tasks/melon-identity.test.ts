import assert from "node:assert/strict";
import test from "node:test";
import { chooseRandomIdentityAuthDate, createMelonIdentityTask, parseIdentityInput } from "./melon-identity.js";

test("chooses identity auth date from four months ago through two months ago", () => {
  const now = new Date(2026, 3, 30);

  assert.equal(chooseRandomIdentityAuthDate(now, () => 0), "2025.12.30");
  assert.equal(chooseRandomIdentityAuthDate(now, () => 0.999999), "2026.02.28");
});

test("outputs identity helper fragments and original name before the html template", async () => {
  const task = createMelonIdentityTask(new Date(2026, 3, 30), () => 0);
  const result = await task.run("test kk,20001010,指定认证日2026.02.02");

  assert.equal(result.status, "ok");

  const codeBlocks = Array.from(result.output.matchAll(/```(?<language>[a-zA-Z0-9_-]*)\n(?<content>[\s\S]*?)```/g), (match) => ({
    language: match.groups?.language,
    content: match.groups?.content.trim(),
  }));

  assert.equal(codeBlocks.length, 4);
  assert.deepEqual(codeBlocks.map((block) => block.language), ["text", "text", "regex", "html"]);
  assert.equal(codeBlocks[0]?.content, "melon-kkt-");
  assert.equal(codeBlocks[1]?.content, "test kk");
  assert.equal(codeBlocks[2]?.content, "[\\s\\S]*");
  assert.match(codeBlocks[3]?.content ?? "", /<dd>TE\*\* KK \(만 25세\)<\/dd>/);
  assert.match(codeBlocks[3]?.content ?? "", /<dd>2026\.02\.02<\/dd>/);
});

test("outputs multiline slash-date identity input with original name as a copy block", async () => {
  const task = createMelonIdentityTask(new Date(2026, 4, 25), () => 0);
  const result = await task.run("TOYOSHIMA YU\n2005/08/17");

  assert.equal(result.status, "ok");

  const codeBlocks = Array.from(result.output.matchAll(/```(?<language>[a-zA-Z0-9_-]*)\n(?<content>[\s\S]*?)```/g), (match) => ({
    language: match.groups?.language,
    content: match.groups?.content.trim(),
  }));

  assert.equal(codeBlocks[1]?.content, "TOYOSHIMA YU");
  assert.match(codeBlocks[3]?.content ?? "", /<dd>TO\*\*\*\*\*\*\* YU \(만 20세\)<\/dd>/);
});

test("parses common birth date formats from identity input", () => {
  assert.deepEqual(parseIdentityInput("SHI YUNLIN, 1991.08.14"), {
    authDate: undefined,
    birthDate: "19910814",
    name: "SHI YUNLIN",
  });
  assert.deepEqual(parseIdentityInput("SHI YUNLIN, 1991-08-14"), {
    authDate: undefined,
    birthDate: "19910814",
    name: "SHI YUNLIN",
  });
  assert.deepEqual(parseIdentityInput("SHI YUNLIN, 1991/8/14"), {
    authDate: undefined,
    birthDate: "19910814",
    name: "SHI YUNLIN",
  });
  assert.deepEqual(parseIdentityInput("SHI YUNLIN 出生日期 1991年8月14日"), {
    authDate: undefined,
    birthDate: "19910814",
    name: "SHI YUNLIN",
  });
  assert.deepEqual(parseIdentityInput("SHI YUNLIN 1991 8 14"), {
    authDate: undefined,
    birthDate: "19910814",
    name: "SHI YUNLIN",
  });
});
