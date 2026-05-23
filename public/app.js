const form = document.querySelector("#chat-form");
const input = document.querySelector("#message-input");
const messages = document.querySelector("#messages");
const sendButton = document.querySelector("#send-button");
const moduleList = document.querySelector("#module-list");
const activeModuleDescription = document.querySelector("#active-module-description");
const avatarForm = document.querySelector("#avatar-form");
const avatarFileInput = document.querySelector("#avatar-file-input");
const singleSourceTools = document.querySelector("#single-source-tools");
let activeModuleId = "album_source";
const moduleMetaById = new Map();
const moduleConversations = new Map();
const singleSourceRegexTools = [
  {
    label: "songId query",
    note: "改单曲播放次数",
    value: ".*songId=31606729\\b.*$",
  },
  {
    label: "外层播放次数",
    note: "TOTALLISTENCNT",
    value: '"TOTALLISTENCNT":".*?\\"',
  },
  {
    label: "外层首听日",
    note: "FIRSTLISTENDATE",
    value: '"FIRSTLISTENDATE":".*?\\"',
  },
  {
    label: "card 次数",
    note: "MYSTREAMCOUNT",
    value: '"MYSTREAMCOUNT":".*?\\"',
  },
  {
    label: "card SONGID",
    note: "改成次数",
    value: '"SONGID":".*?\\"',
  },
];

initializeModules();

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const text = input.value.trim();
  if (!text) {
    return;
  }

  const requestModuleId = activeModuleId;
  appendMessage("user", text, requestModuleId);
  input.value = "";
  resizeInput();
  setSending(true);

  const pending = appendMessage("assistant", "处理中...", requestModuleId);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ moduleId: requestModuleId, message: text }),
    });

    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.error || "请求失败");
    }

    pending.text = body.output;
    renderActiveConversation();
  } catch (error) {
    pending.text = `请求失败：${error.message}`;
    renderActiveConversation();
  } finally {
    setSending(false);
    input.focus();
  }
});

input.addEventListener("input", resizeInput);

avatarFileInput?.addEventListener("change", async () => {
  const file = avatarFileInput.files?.[0];

  if (!file) {
    return;
  }

  await uploadAvatar(file);
  avatarFileInput.value = "";
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

async function initializeModules() {
  if (!moduleList) {
    return;
  }

  try {
    const response = await fetch("/api/modules");
    if (!response.ok) {
      throw new Error("模块加载失败");
    }

    const body = await response.json();
    renderModules(body.modules);
  } catch {
    bindModuleButtons();
  }
}

function renderModules(modules) {
  if (!moduleList) {
    return;
  }

  moduleList.replaceChildren();

  for (const module of modules) {
    moduleMetaById.set(module.id, module);
    const button = document.createElement("button");
    button.className = "module-button";
    button.type = "button";
    button.dataset.moduleId = module.id;
    button.dataset.description = module.description;
    button.dataset.prompt = module.prompt || getDefaultModulePrompt(module);
    button.textContent = module.label;
    moduleList.append(button);
  }

  activeModuleId = modules[0]?.id || activeModuleId;
  bindModuleButtons();
  setActiveModule(activeModuleId);
}

function bindModuleButtons() {
  if (!moduleList) {
    return;
  }

  for (const button of moduleList.querySelectorAll(".module-button")) {
    const moduleId = button.dataset.moduleId;
    if (moduleId && !moduleMetaById.has(moduleId)) {
      moduleMetaById.set(moduleId, {
        id: moduleId,
        label: button.textContent || moduleId,
        description: button.dataset.description || "",
        prompt: button.dataset.prompt || "",
      });
    }

    button.addEventListener("click", () => {
      setActiveModule(button.dataset.moduleId);
    });
  }
}

function setActiveModule(moduleId) {
  if (!moduleId || !moduleList) {
    return;
  }

  activeModuleId = moduleId;
  ensureModuleConversation(activeModuleId);

  for (const button of moduleList.querySelectorAll(".module-button")) {
    const isActive = button.dataset.moduleId === activeModuleId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));

    if (isActive && activeModuleDescription) {
      activeModuleDescription.textContent = button.dataset.description || "先选择功能模块，再发送任务指令。";
    }
  }

  syncModuleControls();
  syncInputPlaceholder();
  renderSingleSourceTools();
  renderActiveConversation();
}

function appendMessage(role, text, moduleId = activeModuleId) {
  const conversation = ensureModuleConversation(moduleId);
  const message = { role, text };
  conversation.push(message);

  if (moduleId === activeModuleId) {
    renderActiveConversation();
  }

  return message;
}

function renderActiveConversation() {
  if (!messages) {
    return;
  }

  const conversation = ensureModuleConversation(activeModuleId);
  messages.replaceChildren(...conversation.map((message) => createMessageElement(message.role, message.text)));
  messages.scrollTop = messages.scrollHeight;
}

function ensureModuleConversation(moduleId) {
  if (!moduleConversations.has(moduleId)) {
    moduleConversations.set(moduleId, [
      {
        role: "assistant",
        text: getModulePrompt(moduleId),
      },
    ]);
  }

  return moduleConversations.get(moduleId);
}

function getModulePrompt(moduleId) {
  const module = moduleMetaById.get(moduleId);
  return module?.prompt || getDefaultModulePrompt(module || { id: moduleId, label: moduleId });
}

function getDefaultModulePrompt(module) {
  if (module.id === "album_source") {
    return "当前模块：专辑音源。可以输入：给我 tws 最新专辑的全曲源码。";
  }

  if (module.id === "melon_identity") {
    return "当前模块：melon实名。可以输入：test kk,20001010,指定认证日2026.02.02。";
  }

  if (module.id === "single_source") {
    return "当前模块：单曲音源。可以输入：tws，널 따라가 (You, You)。";
  }

  if (module.id === "avatar_change") {
    return "当前模块：更换头像。请先在本地 .env 配置 MELON_COOKIE，然后选择图片自动上传。";
  }

  return `当前模块：${module.label}。这个模块待实现，请先告诉我输入和输出规则。`;
}

function getModuleExample(moduleId) {
  if (moduleId === "album_source") {
    return "例如：给我 tws 最新专辑的全曲源码";
  }

  if (moduleId === "melon_identity") {
    return "例如：test kk,20001010,指定认证日2026.02.02";
  }

  if (moduleId === "single_source") {
    return "例如：itzy, 달라달라，199";
  }

  if (moduleId === "avatar_change") {
    return "选择图片后会自动上传";
  }

  return "输入 Melon 相关任务...";
}

function syncInputPlaceholder() {
  if (!input) {
    return;
  }

  input.placeholder = getModuleExample(activeModuleId);
}

function createMessageElement(role, text) {
  const message = document.createElement("article");
  message.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "你" : "M";

  const body = document.createElement("div");
  body.className = "message-body";
  renderMessageBody(body, text);

  message.append(avatar, body);

  return message;
}

function renderMessageBody(container, text) {
  container.replaceChildren();

  const segments = parseCodeBlocks(text);

  for (const segment of segments) {
    if (segment.type === "code") {
      container.append(createCodeBlock(segment.language, segment.content));
    } else if (segment.content.trim()) {
      const paragraph = document.createElement("p");
      paragraph.textContent = segment.content.trim();
      container.append(paragraph);
    }
  }
}

function parseCodeBlocks(text) {
  const segments = [];
  const pattern = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
  let cursor = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      segments.push({ type: "text", content: text.slice(cursor, match.index) });
    }

    segments.push({
      type: "code",
      language: match[1] || "source",
      content: match[2].trim(),
    });
    cursor = pattern.lastIndex;
  }

  if (cursor < text.length) {
    segments.push({ type: "text", content: text.slice(cursor) });
  }

  return segments.length > 0 ? segments : [{ type: "text", content: text }];
}

function createCodeBlock(language, content) {
  const wrapper = document.createElement("div");
  wrapper.className = "code-block";

  const header = document.createElement("div");
  header.className = "code-header";

  const label = document.createElement("span");
  label.textContent = language;

  const copyButton = document.createElement("button");
  copyButton.className = "copy-button";
  copyButton.type = "button";
  copyButton.textContent = "复制";
  copyButton.addEventListener("click", async (event) => {
    event?.stopPropagation?.();
    await copyCodeBlock(content, copyButton, wrapper);
  });

  wrapper.addEventListener("click", async () => {
    await copyCodeBlock(content, copyButton, wrapper);
  });

  const pre = document.createElement("pre");
  pre.setAttribute("tabindex", "0");
  const code = document.createElement("code");
  code.textContent = content;
  pre.append(code);

  header.append(label, copyButton);
  wrapper.append(header, pre);

  return wrapper;
}

async function copyCodeBlock(content, copyButton, wrapper) {
  if (wrapper.dataset.copying === "true") {
    return;
  }

  wrapper.dataset.copying = "true";

  try {
    await copyText(content);
    copyButton.textContent = "已复制";
    wrapper.classList.toggle("is-copied", true);
  } catch {
    copyButton.textContent = "复制失败";
  } finally {
    window.setTimeout(() => {
      copyButton.textContent = "复制";
      wrapper.classList.toggle("is-copied", false);
      wrapper.dataset.copying = "false";
    }, 1600);
  }
}

function renderSingleSourceTools() {
  if (!singleSourceTools) {
    return;
  }

  singleSourceTools.hidden = activeModuleId !== "single_source";

  if (singleSourceTools.children.length > 0) {
    return;
  }

  singleSourceTools.replaceChildren(...singleSourceRegexTools.map(createRegexToolCard));
}

function createRegexToolCard(tool) {
  const button = document.createElement("button");
  button.className = "tool-card";
  button.type = "button";
  button.setAttribute("aria-label", `复制${tool.label}正则`);

  const title = document.createElement("span");
  title.className = "tool-card-title";
  title.textContent = tool.label;

  const note = document.createElement("span");
  note.className = "tool-card-note";
  note.textContent = tool.note;

  const value = document.createElement("code");
  value.className = "tool-card-value";
  value.textContent = tool.value;

  button.append(title, note, value);
  button.addEventListener("click", async () => {
    await copyRegexTool(tool.value, button);
  });

  return button;
}

async function copyRegexTool(value, button) {
  if (button.dataset.copying === "true") {
    return;
  }

  button.dataset.copying = "true";

  try {
    await copyText(value);
    button.classList.toggle("is-copied", true);
    button.dataset.status = "已复制";
  } catch {
    button.dataset.status = "复制失败";
  } finally {
    window.setTimeout(() => {
      button.classList.toggle("is-copied", false);
      button.dataset.status = "";
      button.dataset.copying = "false";
    }, 1200);
  }
}

/*
  Keep a single browser/server/textarea copy pipeline. Code blocks call this
  whether the user taps the copy button or the code surface itself.
*/
async function copyText(text) {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Some embedded browsers expose navigator.clipboard but reject writes.
      // Fall through to the selection-based copy path.
    }
  }

  try {
    await copyTextWithLocalServer(text);
    return;
  } catch {
    // Keep a browser-only fallback for environments where the local server
    // endpoint is unavailable.
  }

  copyTextWithTextarea(text);
}

async function copyTextWithLocalServer(text) {
  const response = await fetch("/api/copy", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error("Local copy endpoint failed");
  }
}

function copyTextWithTextarea(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("Copy command failed");
  }
}

function resizeInput() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
}

function setSending(isSending) {
  sendButton.disabled = isSending;
  input.disabled = isSending;
}

function syncModuleControls() {
  const isAvatarModule = activeModuleId === "avatar_change";

  if (avatarForm) {
    avatarForm.hidden = !isAvatarModule;
  }

  if (form) {
    form.hidden = isAvatarModule;
  }
}

async function uploadAvatar(file) {
  appendMessage("user", `上传头像：${file.name}`, "avatar_change");
  const pending = appendMessage("assistant", "正在上传头像...", "avatar_change");

  try {
    const response = await fetch("/api/avatar", {
      method: "POST",
      headers: {
        "content-type": file.type || "application/octet-stream",
        "x-file-name": encodeURIComponent(file.name),
      },
      body: file,
    });
    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.error || "上传失败");
    }

    pending.text = formatAvatarUploadResult(body);
    renderActiveConversation();
  } catch (error) {
    pending.text = `头像上传失败：${error.message}`;
    renderActiveConversation();
  }
}

function formatAvatarUploadResult(result) {
  return [
    "头像已提交到 Melon。",
    `使用字段名：${result.fieldName || "unknown"}`,
    "",
    "```text",
    result.imageUrl || "",
    "```",
    "```text",
    result.originalImageUrl || "",
    "```",
  ].join("\n");
}
