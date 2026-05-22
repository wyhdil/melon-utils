import assert from "node:assert/strict";
import test from "node:test";
import { extractArtistKey, extractReleaseDate } from "./full-source-html.js";

test("extracts artist and compact month-day from natural dated album requests", () => {
  assert.equal(extractArtistKey("给我itzy在0518发行的全专源码"), "itzy");
  assert.equal(extractReleaseDate("给我itzy在0518发行的全专源码"), `${new Date().getFullYear()}.05.18`);
});

test("extracts artist and full dotted release date from spaced requests", () => {
  assert.equal(extractArtistKey("给我 tws 2026.04.27 发行的全曲源码"), "tws");
  assert.equal(extractReleaseDate("给我 tws 2026.04.27 发行的全曲源码"), "2026.04.27");
});

test("extracts compact full release dates", () => {
  assert.equal(extractReleaseDate("给我 itzy 20260518 发行的全专源码"), "2026.05.18");
});
