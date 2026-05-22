import type { AgentTask, AgentTaskResult } from "./types.js";

export function createHelpTask(): AgentTask {
  return {
    name: "help",
    description: "Explain currently supported Melon agent workflows.",
    async run(): Promise<AgentTaskResult> {
      return {
        status: "ok",
        output: [
          "我现在可以帮你生成 Melon 全曲源码。",
          "",
          "可以这样输入：",
          "给我 tws 最新专辑的全曲源码",
          "给我 tws 2026.04.27 发行的全曲源码",
          "",
          "我会联网查询 Melon，找到对应专辑和曲目，然后输出可复制的 HTML 源码。",
        ].join("\n"),
      };
    },
  };
}
