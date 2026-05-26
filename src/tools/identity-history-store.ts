import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type IdentityHistoryRecord = {
  id: string;
  name: string;
  template: string;
  createdAt: string;
};

export type IdentityHistoryDraft = {
  name: string;
  template: string;
  createdAt?: Date;
};

export type IdentityHistoryStore = {
  add(record: IdentityHistoryDraft): Promise<IdentityHistoryRecord>;
  listRecent(now?: Date): Promise<IdentityHistoryRecord[]>;
  pruneExpired(now?: Date): Promise<void>;
};

const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

export function createFileIdentityHistoryStore(
  filePath = process.env.MELON_IDENTITY_HISTORY_FILE ?? join(process.cwd(), "data/runtime/identity-history.json"),
): IdentityHistoryStore {
  return {
    async add(record) {
      const records = await readRecords(filePath);
      const savedRecord = {
        id: randomUUID(),
        name: record.name,
        template: record.template,
        createdAt: (record.createdAt ?? new Date()).toISOString(),
      };
      const retainedRecords = pruneRecords([savedRecord, ...records], new Date());
      await writeRecords(filePath, retainedRecords);
      return savedRecord;
    },

    async listRecent(now = new Date()) {
      const records = await readRecords(filePath);
      const retainedRecords = pruneRecords(records, now);

      if (retainedRecords.length !== records.length) {
        await writeRecords(filePath, retainedRecords);
      }

      return retainedRecords;
    },

    async pruneExpired(now = new Date()) {
      const records = await readRecords(filePath);
      await writeRecords(filePath, pruneRecords(records, now));
    },
  };
}

function pruneRecords(records: IdentityHistoryRecord[], now: Date): IdentityHistoryRecord[] {
  const cutoffTime = now.getTime() - threeDaysMs;
  return records
    .filter((record) => new Date(record.createdAt).getTime() >= cutoffTime)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

async function readRecords(filePath: string): Promise<IdentityHistoryRecord[]> {
  try {
    const rawRecords = JSON.parse(await readFile(filePath, "utf8"));
    return Array.isArray(rawRecords) ? rawRecords.filter(isIdentityHistoryRecord) : [];
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeRecords(filePath: string, records: IdentityHistoryRecord[]): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
}

function isIdentityHistoryRecord(value: unknown): value is IdentityHistoryRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "template" in value &&
    typeof value.template === "string" &&
    "createdAt" in value &&
    typeof value.createdAt === "string"
  );
}
