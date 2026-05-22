import { createLatestAlbumSourcesTask } from "../tasks/latest-album-sources.js";
import { createFullSourceHtmlTask } from "../tasks/full-source-html.js";
import { createAvatarChangeTask } from "../tasks/avatar-change.js";
import { createHelpTask } from "../tasks/help.js";
import { createMelonIdentityTask } from "../tasks/melon-identity.js";
import { createModulePlaceholderTask } from "../tasks/module-placeholder.js";
import { createSingleSourceTask } from "../tasks/single-source.js";
import {
  getDefaultFeatureModule,
  getFeatureModule,
  listFeatureModules,
  type FeatureModule,
} from "../modules/feature-modules.js";
import { ToolRegistry } from "./tool-registry.js";

export type MelonAgentResponse = {
  output: string;
};

export type MelonAgentRunOptions = {
  moduleId?: string;
};

const latestAlbumSourceKeywords = ["最新", "专辑", "音源"];
const fullSourceHtmlKeywords = ["源码"];
const helpKeywords = ["你好", "您好", "你能做什么", "help", "帮助", "怎么用"];

export function listMelonAgentModules(): FeatureModule[] {
  return listFeatureModules();
}

export async function runMelonAgent(input: string, options: MelonAgentRunOptions = {}): Promise<MelonAgentResponse> {
  const registry = new ToolRegistry();
  registry.register(createHelpTask());
  registry.register(createFullSourceHtmlTask());
  registry.register(createLatestAlbumSourcesTask());
  registry.register(createMelonIdentityTask());
  registry.register(createSingleSourceTask());
  registry.register(createAvatarChangeTask());
  for (const module of listFeatureModules().filter((candidate) => candidate.status === "planned")) {
    registry.register(createModulePlaceholderTask(module));
  }

  const module = getFeatureModule(options.moduleId) ?? getDefaultFeatureModule();
  const taskName = classifyTask(input, module);
  const result = await registry.run(taskName, input);

  return {
    output: result.output,
  };
}

function classifyTask(input: string, module: FeatureModule): string {
  if (helpKeywords.some((keyword) => input.toLowerCase().includes(keyword))) {
    return "help";
  }

  if (module.status === "planned") {
    return `${module.id}_placeholder`;
  }

  if (module.id === "melon_identity") {
    return "melon_identity";
  }

  if (module.id === "single_source") {
    return "single_source";
  }

  if (module.id === "avatar_change") {
    return "avatar_change";
  }

  if (fullSourceHtmlKeywords.every((keyword) => input.includes(keyword))) {
    return "full_source_html";
  }

  if (latestAlbumSourceKeywords.every((keyword) => input.includes(keyword))) {
    return "latest_album_sources";
  }

  return "unsupported";
}
