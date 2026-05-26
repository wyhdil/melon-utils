import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type { IdentityHistoryRecord, IdentityHistoryStore } from "./tools/identity-history-store.js";
import { createWebServer } from "./server.js";

test("serves the chat page", async () => {
  const server = createWebServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const baseUrl = getBaseUrl(server.address() as AddressInfo);
    const response = await fetch(baseUrl);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /Melon Agent/);
    assert.match(html, /id="chat-form"/);
    assert.match(html, /id="module-list"/);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => (error ? reject(error) : resolve()));
    });
  }
});

test("posts chat messages to the agent", async () => {
  const server = createWebServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const baseUrl = getBaseUrl(server.address() as AddressInfo);
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "给我 aespa 最新一张专辑的音源列表" }),
    });
    const body = (await response.json()) as { output: string };

    assert.equal(response.status, 200);
    assert.match(body.output, /latest_album_sources/);
    assert.match(body.output, /aespa/);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => (error ? reject(error) : resolve()));
    });
  }
});

test("serves the feature modules", async () => {
  const server = createWebServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const baseUrl = getBaseUrl(server.address() as AddressInfo);
    const response = await fetch(`${baseUrl}/api/modules`);
    const body = (await response.json()) as { modules: Array<{ id: string; label: string }> };

    assert.equal(response.status, 200);
    assert.deepEqual(
      body.modules.map((module) => module.id),
      ["album_source", "melon_identity", "single_source"],
    );
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => (error ? reject(error) : resolve()));
    });
  }
});

test("posts chat messages with an explicit module", async () => {
  const server = createWebServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const baseUrl = getBaseUrl(server.address() as AddressInfo);
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ moduleId: "single_source", message: "开始" }),
    });
    const body = (await response.json()) as { output: string };

    assert.equal(response.status, 200);
    assert.match(body.output, /歌手名和歌曲名/);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => (error ? reject(error) : resolve()));
    });
  }
});

test("stores melon identity history after successful generation", async () => {
  const identityHistoryStore = createFakeIdentityHistoryStore();
  const server = createWebServer({ identityHistoryStore });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const baseUrl = getBaseUrl(server.address() as AddressInfo);
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ moduleId: "melon_identity", message: "WU YANFEI,19870918" }),
    });

    assert.equal(response.status, 200);
    assert.equal(identityHistoryStore.records.length, 1);
    assert.equal(identityHistoryStore.records[0]?.name, "WU YANFEI");
    assert.match(identityHistoryStore.records[0]?.template ?? "", /modal-dialog modal-myinfo/);
    assert.match(identityHistoryStore.records[0]?.template ?? "", /WU \*\*\*\*EI/);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => (error ? reject(error) : resolve()));
    });
  }
});

test("serves recent melon identity history", async () => {
  const identityHistoryStore = createFakeIdentityHistoryStore([
    {
      id: "record-1",
      name: "WU YANFEI",
      template: "<div>template</div>",
      createdAt: "2026-05-27T00:00:00.000Z",
    },
  ]);
  const server = createWebServer({ identityHistoryStore });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const baseUrl = getBaseUrl(server.address() as AddressInfo);
    const response = await fetch(`${baseUrl}/api/identity-history`);
    const body = (await response.json()) as { records: IdentityHistoryRecord[] };

    assert.equal(response.status, 200);
    assert.deepEqual(body.records, identityHistoryStore.records);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => (error ? reject(error) : resolve()));
    });
  }
});

test("copies text through the local clipboard endpoint", async () => {
  let copiedText = "";
  const server = createWebServer({
    copyText: async (text) => {
      copiedText = text;
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const baseUrl = getBaseUrl(server.address() as AddressInfo);
    const response = await fetch(`${baseUrl}/api/copy`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "<tbody>copy me</tbody>" }),
    });
    const body = (await response.json()) as { ok: boolean };

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(copiedText, "<tbody>copy me</tbody>");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => (error ? reject(error) : resolve()));
    });
  }
});

test("uploads avatar images through the local avatar endpoint", async () => {
  let uploadedFile: { bytes: Buffer; filename: string; contentType: string } | undefined;
  const server = createWebServer({
    uploadAvatar: async (file) => {
      uploadedFile = file;

      return {
        imageUrl: "https://cdnimg.melon.co.kr/svc/user_images/user/656/54/65553440_194.jpg?tm=20260506105418",
        originalImageUrl: "https://cdnimg.melon.co.kr/svc/user_images/user/656/54/65553440_org.jpg?tm=20260506105418",
        fieldName: "file",
      };
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const baseUrl = getBaseUrl(server.address() as AddressInfo);
    const response = await fetch(`${baseUrl}/api/avatar`, {
      method: "POST",
      headers: {
        "content-type": "image/jpeg",
        "x-file-name": "avatar.jpg",
      },
      body: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    });
    const body = (await response.json()) as {
      imageUrl: string;
      originalImageUrl: string;
      fieldName: string;
    };

    assert.equal(response.status, 200);
    assert.deepEqual(uploadedFile, {
      bytes: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      filename: "avatar.jpg",
      contentType: "image/jpeg",
    });
    assert.equal(body.fieldName, "file");
    assert.match(body.imageUrl, /65553440_194\.jpg/);
    assert.match(body.originalImageUrl, /65553440_org\.jpg/);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => (error ? reject(error) : resolve()));
    });
  }
});

test("decodes encoded avatar filenames from request headers", async () => {
  let uploadedFilename = "";
  const server = createWebServer({
    uploadAvatar: async (file) => {
      uploadedFilename = file.filename;

      return {
        imageUrl: "https://cdnimg.melon.co.kr/svc/user_images/user/656/54/65553440_194.jpg",
        originalImageUrl: "https://cdnimg.melon.co.kr/svc/user_images/user/656/54/65553440_org.jpg",
        fieldName: "file",
      };
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const baseUrl = getBaseUrl(server.address() as AddressInfo);
    const response = await fetch(`${baseUrl}/api/avatar`, {
      method: "POST",
      headers: {
        "content-type": "image/png",
        "x-file-name": "%E5%8C%85.png",
      },
      body: Buffer.from([1, 2, 3]),
    });

    assert.equal(response.status, 200);
    assert.equal(uploadedFilename, "包.png");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => (error ? reject(error) : resolve()));
    });
  }
});

test("rejects avatar uploads without an image content type", async () => {
  const server = createWebServer({
    uploadAvatar: async () => {
      throw new Error("should not upload");
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const baseUrl = getBaseUrl(server.address() as AddressInfo);
    const response = await fetch(`${baseUrl}/api/avatar`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "not an image",
    });
    const body = (await response.json()) as { error: string };

    assert.equal(response.status, 400);
    assert.match(body.error, /image/);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => (error ? reject(error) : resolve()));
    });
  }
});

function getBaseUrl(address: AddressInfo): string {
  return `http://127.0.0.1:${address.port}`;
}

function createFakeIdentityHistoryStore(initialRecords: IdentityHistoryRecord[] = []): IdentityHistoryStore & {
  records: IdentityHistoryRecord[];
} {
  return {
    records: [...initialRecords],
    async add(record) {
      const savedRecord = {
        id: `record-${this.records.length + 1}`,
        name: record.name,
        template: record.template,
        createdAt: record.createdAt?.toISOString() ?? "2026-05-27T00:00:00.000Z",
      };
      this.records.unshift(savedRecord);
      return savedRecord;
    },
    async listRecent() {
      return this.records;
    },
    async pruneExpired() {},
  };
}
