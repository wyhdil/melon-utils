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
  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  await store.add({
    name: "OLD NAME",
    template: "<div>old</div>",
    createdAt: daysAgo(4),
  });
  await store.add({
    name: "WU YANFEI",
    template: "<div>new</div>",
    createdAt: daysAgo(1),
  });

  const records = await store.listRecent(now);

  assert.deepEqual(
    records.map((record) => record.name),
    ["WU YANFEI"],
  );
  assert.doesNotMatch(await readFile(filePath, "utf8"), /OLD NAME/);
});
