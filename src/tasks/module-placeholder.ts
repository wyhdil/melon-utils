import type { FeatureModule } from "../modules/feature-modules.js";
import type { AgentTask, AgentTaskResult } from "./types.js";

export function createModulePlaceholderTask(module: FeatureModule): AgentTask {
  return {
    name: `${module.id}_placeholder`,
    description: module.description,
    async run(): Promise<AgentTaskResult> {
      return {
        status: "unsupported",
        output: [
          `${module.label} 模块已预留，具体执行逻辑待实现。`,
          "",
          "你接下来可以告诉我这个模块需要哪些输入、执行步骤，以及最终要输出什么格式。",
        ].join("\n"),
      };
    },
  };
}
