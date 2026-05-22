import type { AgentTask, AgentTaskResult } from "../tasks/types.js";

export class ToolRegistry {
  private readonly tasks = new Map<string, AgentTask>();

  register(task: AgentTask): void {
    if (this.tasks.has(task.name)) {
      throw new Error(`Task already registered: ${task.name}`);
    }

    this.tasks.set(task.name, task);
  }

  async run(name: string, input: string): Promise<AgentTaskResult> {
    const task = this.tasks.get(name);

    if (!task) {
      return {
        status: "unsupported",
        output: [
          `暂不支持这个任务：${name}`,
          "",
          "当前可用示例：给我 tws 最新专辑的全曲源码",
          "也可以输入：你能做什么",
        ].join("\n"),
      };
    }

    return task.run(input);
  }
}
