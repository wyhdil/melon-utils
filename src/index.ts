import { runMelonAgent } from "./agent/melon-agent.js";

const input = process.argv.slice(2).join(" ").trim();

if (!input) {
  console.error('Usage: npm run dev -- "给我某个团体的最新一张专辑的音源列表"');
  process.exitCode = 1;
} else {
  const response = await runMelonAgent(input);
  console.log(response.output);
}
