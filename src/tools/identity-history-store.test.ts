import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { createFileIdentityHistoryStore } from "./identity-history-store.js";

test("file identity history store keeps only records from the last three days", async () => {
  const directory = await mkdtemp(join(tmpdir(), "melon-identity-history-"));
  const filePath = join(directory, "identity-history.json");
  const store = createFileIdentityHistoryStore(filePath);

  await store.add({
    name: "OLD NAME",
    template: "<div>old</div>",
    createdAt: new Date("2026-05-23T23:59:59.000Z"),
  });
  await store.add({
    name: "WU YANFEI",
    template: "<div>new</div>",
    createdAt: new Date("2026-05-25T00:00:00.000Z"),
  });

  const records = await store.listRecent(new Date("2026-05-27T00:00:00.000Z"));

  assert.deepEqual(
    records.map((record) => record.name),
    ["WU YANFEI"],
  );
  assert.doesNotMatch(await readFile(filePath, "utf8"), /OLD NAME/);
});
