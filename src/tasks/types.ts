export type AgentTaskStatus = "ok" | "needs_data_source" | "unsupported" | "error";

export type AgentTaskResult = {
  status: AgentTaskStatus;
  output: string;
};

export type AgentTask = {
  name: string;
  description: string;
  run(input: string): Promise<AgentTaskResult>;
};
