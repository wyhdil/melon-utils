import assert from "node:assert/strict";
import test from "node:test";
import { createSingleSourceTask, parseSingleSongRequest } from "./single-source.js";
import { normalizeSemanticSingleSourceRequest } from "../tools/deepseek-semantic-parser.js";

test("generates a copyable songId regex for artist and song input", async () => {
  const task = createSingleSourceTask(async (artist, title) => {
    assert.equal(artist, "TWS");
    assert.equal(title, "널 따라가 (You, You)");

    return {
      songId: "601862626",
      title: "널 따라가 (You, You)",
      artist: "TWS (투어스)",
    };
  });

  const result = await task.run("tws，널 따라가 (You, You)");

  assert.equal(result.status, "ok");
  assert.match(result.output, /```regex/);
  assert.match(result.output, /\.\*songId=601862626\\b\.\*\$/);
});

test("generates independent source fragments when stream count is provided", async () => {
  const task = createSingleSourceTask(async (artist, title) => {
    assert.equal(artist, "itzy");
    assert.equal(title, "달라달라");

    return {
      songId: "31606729",
      title: "달라달라",
      artist: "ITZY (있지)",
      releaseDate: "2019.02.12",
    };
  });

  const result = await task.run("itzy, 달라달라，199");

  assert.equal(result.status, "ok");
  assert.match(result.output, /\.\*songId=31606729\\b\.\*\$/);
  assert.match(result.output, /"TOTALLISTENCNT":"199"/);
  assert.match(result.output, /"FIRSTLISTENDATE":"2019\.02\.12"/);
  assert.equal(countCodeBlocks(result.output), 7);
});

test("ignores explanatory prefixes before artist and song", async () => {
  const task = createSingleSourceTask(async (artist, title) => {
    assert.equal(artist, "TWS");
    assert.equal(title, "널 따라가 (You, You)");

    return {
      songId: "601862626",
      title: "널 따라가 (You, You)",
      artist: "TWS (투어스)",
    };
  });

  const result = await task.run("歌手名+歌曲名，tws，널 따라가 (You, You)");

  assert.equal(result.status, "ok");
});

test("asks for artist and song when input is incomplete", async () => {
  const task = createSingleSourceTask();
  const result = await task.run("tws");

  assert.equal(result.status, "needs_data_source");
  assert.match(result.output, /歌手名和歌曲名/);
});

test("resolves Chinese artist alias latest title track requests", async () => {
  const task = createSingleSourceTask(
    async () => {
      throw new Error("explicit song resolver should not run");
    },
    async (artist) => {
      assert.equal(artist, "MONSTA X");

      return {
        songId: "12345678",
        title: "TITLE",
        artist: "MONSTA X (몬스타엑스)",
        album: "LATEST",
        releaseDate: "2026.05.01",
      };
    },
  );

  const result = await task.run("芒叉主打曲");

  assert.equal(result.status, "ok");
  assert.match(result.output, /MONSTA X/);
  assert.match(result.output, /\.\*songId=12345678\\b\.\*\$/);
});

test("passes requested release date to latest title track resolution", async () => {
  const task = createSingleSourceTask(
    async () => {
      throw new Error("explicit song resolver should not run");
    },
    async (artist, releaseDate) => {
      assert.equal(artist, "itzy");
      assert.equal(releaseDate, `${new Date().getFullYear()}.05.18`);

      return {
        songId: "602010541",
        title: "Motto",
        artist: "ITZY (있지)",
        album: "Motto",
        releaseDate: "2026.05.18",
      };
    },
  );

  const result = await task.run("itzy在0518发行的主打曲");

  assert.equal(result.status, "ok");
  assert.match(result.output, /发行日：2026\.05\.18/);
  assert.match(result.output, /\.\*songId=602010541\\b\.\*\$/);
});

test("normalizes Chinese real names and dates for title track requests", () => {
  assert.deepEqual(parseSingleSongRequest("李泰容在0518发行的主打曲"), {
    artist: "TAEYONG",
    intent: "latest_album_title_track",
    streamCount: undefined,
    releaseDate: `${new Date().getFullYear()}.05.18`,
  });
});

test("does not treat compact dates as artist names in title track requests", () => {
  assert.equal(parseSingleSongRequest("某个未知中文名在0518发行的主打曲"), null);
});

test("resolves known debut title track requests through Melon song search", async () => {
  const task = createSingleSourceTask(async (artist, title) => {
    assert.equal(artist, "itzy");
    assert.equal(title, "달라달라");

    return {
      songId: "31606729",
      title: "달라달라",
      artist: "ITZY (있지)",
      releaseDate: "2019.02.12",
    };
  });

  const result = await task.run("itzy出道专的主打曲");

  assert.equal(result.status, "ok");
  assert.match(result.output, /31606729/);
  assert.match(result.output, /2019\.02\.12/);
});

test("resolves known regular album title track requests through Melon song search", async () => {
  const task = createSingleSourceTask(async (artist, title) => {
    assert.equal(artist, "itzy");
    assert.equal(title, "UNTOUCHABLE");

    return {
      songId: "37066916",
      title: "UNTOUCHABLE",
      artist: "ITZY (있지)",
      releaseDate: "2024.01.08",
    };
  });

  const result = await task.run("itzy上一张正规专辑的主打曲");

  assert.equal(result.status, "ok");
  assert.match(result.output, /37066916/);
  assert.match(result.output, /2024\.01\.08/);
});

test("normalizes DeepSeek single source semantic responses", () => {
  const request = normalizeSemanticSingleSourceRequest({
    choices: [
      {
        message: {
          content: JSON.stringify({
            module: "single_source",
            artist: "芒叉",
            intent: "latest_album_title_track",
          }),
        },
      },
    ],
  });

  assert.deepEqual(request, {
    artist: "MONSTA X",
    title: undefined,
    intent: "latest_album_title_track",
    streamCount: undefined,
    releaseDate: undefined,
  });
});

function countCodeBlocks(output: string): number {
  return Array.from(output.matchAll(/```regex[\s\S]*?```/g)).length;
}
