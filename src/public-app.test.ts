import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Script, createContext } from "node:vm";
import test from "node:test";

test("copy button falls back to textarea when clipboard writeText rejects", async () => {
  const script = await readFile("public/app.js", "utf8");
  const document = createFakeDocument();
  let serverCopiedText = "";
  const window = {
    setTimeout(callback: () => void) {
      callback();
      return 1;
    },
  };
  const context = createContext({
    document,
    navigator: {
      clipboard: {
        async writeText() {
          throw new Error("clipboard denied");
        },
      },
    },
    fetch: async (_url: string, init: { body?: string }) => {
      serverCopiedText = JSON.parse(init.body ?? "{}").text;
      return { ok: true };
    },
    window,
  });

  const responseText = "before\n```html\n<div>copy me</div>\n```";
  new Script(
    `${script}\nrenderMessageBody(document.testContainer, ${JSON.stringify(responseText)});`,
  ).runInContext(context);

  const button = document.testContainer.findByClassName("copy-button");
  assert.ok(button);

  await button.dispatch("click");

  assert.equal(document.copiedText, "<div>copy me</div>");
  assert.equal(serverCopiedText, "");
});

test("clicking a code block surface copies its content", async () => {
  const script = await readFile("public/app.js", "utf8");
  const document = createFakeDocument();
  const context = createContext({
    document,
    navigator: {},
    fetch: async (_url: string, init: { body?: string }) => {
      assert.fail(`server copy should not be used before textarea fallback: ${init.body ?? ""}`);
      return { ok: true };
    },
    window: {
      setTimeout(callback: () => void) {
        callback();
        return 1;
      },
    },
  });

  const responseText = "```regex\n.*songId=31606729\\b.*$\n```";
  new Script(
    `${script}\nrenderMessageBody(document.testContainer, ${JSON.stringify(responseText)});`,
  ).runInContext(context);

  const codeBlock = document.testContainer.findByClassName("code-block");
  assert.ok(codeBlock);

  await codeBlock.dispatch("click");

  assert.equal(document.copiedText, ".*songId=31606729\\b.*$");
});

test("single source regex tool cards copy their regex on tap", async () => {
  const script = await readFile("public/app.js", "utf8");
  const document = createFakeDocument();
  const context = createContext({
    document,
    navigator: {},
    fetch: async (url: string, init?: { body?: string }) => {
      if (url === "/api/modules") {
        return {
          ok: true,
          async json() {
            return {
              modules: [
                {
                  id: "album_source",
                  label: "专辑音源",
                  description: "专辑音源说明",
                  prompt: "当前模块：专辑音源。",
                },
                {
                  id: "single_source",
                  label: "单曲音源",
                  description: "单曲音源说明",
                  prompt: "当前模块：单曲音源。",
                },
              ],
            };
          },
        };
      }

      assert.fail(`server copy should not be used before textarea fallback: ${init?.body ?? ""}`);
      return { ok: true };
    },
    window: {
      setTimeout(callback: () => void) {
        callback();
        return 1;
      },
    },
  });

  new Script(script).runInContext(context);
  await flushPromises();

  const singleSourceButton = document.moduleList.children.find((child) => child.dataset.moduleId === "single_source");
  assert.ok(singleSourceButton);
  await singleSourceButton.dispatch("click");

  const toolCards = document.singleSourceTools.findAllByClassName("tool-card");
  assert.equal(toolCards.length, 5);
  await toolCards[1].dispatch("click");

  assert.equal(document.copiedText, '"TOTALLISTENCNT":".*?\\"');
  assert.equal(document.singleSourceTools.hidden, false);
});

test("keeps module conversations separate when switching tabs", async () => {
  const script = await readFile("public/app.js", "utf8");
  const document = createFakeDocument();
  const requests: Array<{ message: string; moduleId: string }> = [];
  const context = createContext({
    document,
    navigator: {},
    fetch: async (url: string, init?: { body?: string }) => {
      if (url === "/api/modules") {
        return {
          ok: true,
          async json() {
            return {
              modules: [
                {
                  id: "album_source",
                  label: "专辑音源",
                  description: "专辑音源说明",
                  prompt: "当前模块：专辑音源。可以输入：给我 tws 最新专辑的全曲源码。",
                },
                {
                  id: "melon_identity",
                  label: "melon实名",
                  description: "melon实名说明",
                  prompt: "当前模块：melon实名。可以输入：test kk,20001010",
                },
              ],
            };
          },
        };
      }

      if (url === "/api/identity-history") {
        return {
          ok: true,
          async json() {
            return { records: [] };
          },
        };
      }

      requests.push(JSON.parse(init?.body ?? "{}"));
      return {
        ok: true,
        async json() {
          return { output: "melon实名结果" };
        },
      };
    },
    window: {
      setTimeout(callback: () => void) {
        callback();
        return 1;
      },
    },
  });

  new Script(script).runInContext(context);
  await flushPromises();

  const melonButton = document.moduleList.children.find((child) => child.dataset.moduleId === "melon_identity");
  assert.ok(melonButton);
  await melonButton.dispatch("click");

  document.input.value = "test kk,20001010";
  await document.form.dispatch("submit", { preventDefault() {} });

  assert.deepEqual(requests, [{ moduleId: "melon_identity", message: "test kk,20001010" }]);
  assert.match(document.messagesText(), /melon实名结果/);

  const albumButton = document.moduleList.children.find((child) => child.dataset.moduleId === "album_source");
  assert.ok(albumButton);
  await albumButton.dispatch("click");

  assert.match(document.messagesText(), /当前模块：专辑音源/);
  assert.doesNotMatch(document.messagesText(), /melon实名结果/);

  await melonButton.dispatch("click");

  assert.match(document.messagesText(), /melon实名结果/);
  assert.equal(document.activeModuleDescription.textContent, "melon实名说明");
});

test("renders melon identity history and copies name or template", async () => {
  const script = await readFile("public/app.js", "utf8");
  const document = createFakeDocument();
  const context = createContext({
    document,
    navigator: {},
    fetch: async (url: string, init?: { body?: string }) => {
      if (url === "/api/modules") {
        return {
          ok: true,
          async json() {
            return {
              modules: [
                {
                  id: "album_source",
                  label: "专辑音源",
                  description: "专辑音源说明",
                  prompt: "当前模块：专辑音源。",
                },
                {
                  id: "melon_identity",
                  label: "melon实名",
                  description: "melon实名说明",
                  prompt: "当前模块：melon实名。",
                },
              ],
            };
          },
        };
      }

      if (url === "/api/identity-history") {
        return {
          ok: true,
          async json() {
            return {
              records: [
                {
                  id: "record-1",
                  name: "WU YANFEI",
                  template: '<div class="modal-dialog modal-myinfo">WU ****EI</div>',
                  createdAt: "2026-05-27T00:00:00.000Z",
                },
              ],
            };
          },
        };
      }

      assert.fail(`unexpected fetch: ${url} ${init?.body ?? ""}`);
    },
    window: {
      setTimeout(callback: () => void) {
        callback();
        return 1;
      },
    },
  });

  new Script(script).runInContext(context);
  await flushPromises();

  const melonButton = document.moduleList.children.find((child) => child.dataset.moduleId === "melon_identity");
  assert.ok(melonButton);
  await melonButton.dispatch("click");
  await flushPromises();

  assert.equal(document.identityHistory.hidden, false);
  assert.match(document.identityHistoryList.fullText(), /WU YANFEI/);

  const copyButtons = document.identityHistoryList.findAllByClassName("history-copy-button");
  assert.equal(copyButtons.length, 2);

  await copyButtons[0]?.dispatch("click");
  assert.equal(document.copiedText, "WU YANFEI");

  await copyButtons[1]?.dispatch("click");
  assert.equal(document.copiedText, '<div class="modal-dialog modal-myinfo">WU ****EI</div>');
});

test("encodes avatar filenames before placing them in request headers", async () => {
  const script = await readFile("public/app.js", "utf8");
  const document = createFakeDocument();
  let avatarHeaders: Record<string, string> | undefined;
  const context = createContext({
    document,
    navigator: {},
    fetch: async (url: string, init?: { headers?: Record<string, string> }) => {
      if (url === "/api/modules") {
        return {
          ok: true,
          async json() {
            return { modules: [{ id: "avatar_change", label: "更换头像", description: "更换头像" }] };
          },
        };
      }

      avatarHeaders = init?.headers;
      return {
        ok: true,
        async json() {
          return {
            fieldName: "file",
            imageUrl: "https://cdn.example/avatar.jpg",
            originalImageUrl: "https://cdn.example/avatar_org.jpg",
          };
        },
      };
    },
    window: {
      setTimeout(callback: () => void) {
        callback();
        return 1;
      },
    },
  });

  new Script(script).runInContext(context);
  await flushPromises();
  await new Script("uploadAvatar({ name: '包.png', type: 'image/png' });").runInContext(context);

  assert.equal(avatarHeaders?.["x-file-name"], "%E5%8C%85.png");
});

type FakeEventHandler = (event?: unknown) => void | Promise<void>;

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly listeners = new Map<string, FakeEventHandler>();
  className = "";
  dataset: Record<string, string> = {};
  disabled = false;
  hidden = false;
  innerHTML = "";
  scrollHeight = 44;
  scrollTop = 0;
  textContent = "";
  value = "";
  style: Record<string, string> = {};

  constructor(
    readonly tagName: string,
    private readonly ownerDocument: FakeDocument,
  ) {}

  get classList(): { toggle: (className: string, force?: boolean) => void } {
    return {
      toggle: (className: string, force?: boolean) => {
        const classes = new Set(this.className.split(/\s+/).filter(Boolean));
        if (force) {
          classes.add(className);
        } else {
          classes.delete(className);
        }

        this.className = [...classes].join(" ");
      },
    };
  }

  addEventListener(event: string, handler: FakeEventHandler): void {
    this.listeners.set(event, handler);
  }

  append(...children: FakeElement[]): void {
    this.children.push(...children);
  }

  focus(): void {}

  querySelector(selector: string): FakeElement | null {
    if (!selector.startsWith(".")) {
      return null;
    }

    return this.findByClassName(selector.slice(1));
  }

  querySelectorAll(selector: string): FakeElement[] {
    if (!selector.startsWith(".")) {
      return [];
    }

    return this.findAllByClassName(selector.slice(1));
  }

  replaceChildren(...children: FakeElement[]): void {
    this.children.splice(0, this.children.length, ...children);
  }

  select(): void {
    this.ownerDocument.selectedText = this.value;
  }

  setSelectionRange(): void {
    this.ownerDocument.selectedText = this.value;
  }

  remove(): void {}

  setAttribute(): void {}

  async dispatch(event: string, payload?: unknown): Promise<void> {
    await this.listeners.get(event)?.(payload);
  }

  findByClassName(className: string): FakeElement | null {
    if (this.className.split(/\s+/).includes(className)) {
      return this;
    }

    for (const child of this.children) {
      const found = child.findByClassName(className);
      if (found) {
        return found;
      }
    }

    return null;
  }

  findAllByClassName(className: string): FakeElement[] {
    const matches: FakeElement[] = this.className.split(/\s+/).includes(className) ? [this] : [];

    for (const child of this.children) {
      matches.push(...child.findAllByClassName(className));
    }

    return matches;
  }

  fullText(): string {
    return [this.textContent, ...this.children.map((child) => child.fullText())].filter(Boolean).join("\n");
  }
}

class FakeDocument {
  readonly form = new FakeElement("form", this);
  readonly input = new FakeElement("textarea", this);
  readonly activeModuleDescription = new FakeElement("p", this);
  readonly avatarForm = new FakeElement("form", this);
  readonly avatarFileInput = new FakeElement("input", this);
  readonly messages = new FakeElement("section", this);
  readonly moduleList = new FakeElement("div", this);
  readonly identityHistory = new FakeElement("section", this);
  readonly identityHistoryList = new FakeElement("div", this);
  readonly singleSourceTools = new FakeElement("section", this);
  readonly sendButton = new FakeElement("button", this);
  readonly body = new FakeElement("body", this);
  readonly testContainer = new FakeElement("div", this);
  copiedText = "";
  selectedText = "";

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName, this);
  }

  execCommand(command: string): boolean {
    if (command === "copy") {
      this.copiedText = this.selectedText;
      return true;
    }

    return false;
  }

  querySelector(selector: string): FakeElement | null {
    if (selector === "#chat-form") {
      return this.form;
    }

    if (selector === "#message-input") {
      return this.input;
    }

    if (selector === "#messages") {
      return this.messages;
    }

    if (selector === "#module-list") {
      return this.moduleList;
    }

    if (selector === "#active-module-description") {
      return this.activeModuleDescription;
    }

    if (selector === "#send-button") {
      return this.sendButton;
    }

    if (selector === "#avatar-form") {
      return this.avatarForm;
    }

    if (selector === "#avatar-file-input") {
      return this.avatarFileInput;
    }

    if (selector === "#single-source-tools") {
      return this.singleSourceTools;
    }

    if (selector === "#identity-history") {
      return this.identityHistory;
    }

    if (selector === "#identity-history-list") {
      return this.identityHistoryList;
    }

    return null;
  }

  messagesText(): string {
    return this.messages.fullText();
  }
}

function createFakeDocument(): FakeDocument {
  return new FakeDocument();
}

async function flushPromises(): Promise<void> {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
}
