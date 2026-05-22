import type { AgentTask, AgentTaskResult } from "./types.js";

export function createAvatarChangeTask(): AgentTask {
  return {
    name: "avatar_change",
    description: "Explain how to upload an image for Melon avatar replacement.",
    async run(): Promise<AgentTaskResult> {
      return {
        status: "ok",
        output: "请在下方上传一张图片。系统会使用本地 .env 里的 MELON_COOKIE 自动提交到 Melon 更换头像。",
      };
    },
  };
}
