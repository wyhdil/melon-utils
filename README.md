# Melon Agent

Melon Agent is a starter project for building an agent that handles Melon-related music workflows.

The first target workflow is:

```text
Input: 给我某个团体的最新一张专辑的音源列表
Output: A formatted source payload for that album's track list
```

## Current Shape

- `src/index.ts` provides a CLI entry point.
- `src/agent/` owns agent routing and task dispatch.
- `src/tasks/` contains task-specific workflows.
- `src/tools/` contains integrations such as Melon lookup and source formatting.

The Melon data source and exact source output format are intentionally left behind interfaces. Once those are known, the task implementation can be filled in without changing the CLI or agent routing.

## Setup

```bash
npm install
```

Copy the environment template when real API keys or data providers are available:

```bash
cp .env.example .env
```

## Development

```bash
npm run dev -- "给我 NewJeans 最新一张专辑的音源列表"
npm test
```

## Local Web UI

```bash
npm run web
```

Open `http://127.0.0.1:3100` in your browser. The page provides a chat-style input and copy buttons for source/code blocks in agent replies.

## Deploy

This app is a Node.js web service, not a static-only site. The browser UI and the `/api/*` routes must run together. Do not deploy only the `public/` folder to Amplify static hosting, because the chat API, DeepSeek parsing, Melon lookup, and avatar upload endpoints would not run.

### Option A: AWS App Runner

Use this if your AWS account can create App Runner services. The repo includes `apprunner.yaml` with Node.js 22, `npm ci`, `npm run build`, `npm prune --omit=dev`, `node dist/server.js`, port `3100`, and `HOST=0.0.0.0`.

In App Runner, create a service from this Git repository and select the branch you want to deploy. Add these environment variables in the App Runner service settings:

```bash
HOST=0.0.0.0
PORT=3100
DEEPSEEK_API_KEY=your_deepseek_key
DEEPSEEK_MODEL=deepseek-chat
```

Optional variables:

```bash
MELON_COOKIE=your_current_melon_cookie
MELON_AVATAR_FIELD_NAME=file
MELON_USER_AGENT="IS40; iPhone 26.3.1; 6.17.0; iPhone17,1"
```

Do not commit `.env`; set secrets in AWS environment variables instead.

### Option B: AWS Elastic Beanstalk

Use this if App Runner is unavailable in your account. Create a Node.js environment, connect or upload this repository, and keep the default start command from `Procfile`:

```bash
web: npm start
```

Set the same environment variables as above. Elastic Beanstalk normally injects `PORT`; if not, set `PORT=3100`. Always set `HOST=0.0.0.0` in the cloud environment.

### Amplify Note

Amplify can still host a separate static frontend, but then this project would need to be split into frontend plus a separate backend URL. The current project is simpler to deploy as one Node service.

### Melon Avatar Upload

For the `更换头像` module, create `.env` locally and set:

```bash
MELON_COOKIE="paste your current Melon Cookie here"
```

Optional overrides:

```bash
MELON_AVATAR_FIELD_NAME=file
MELON_USER_AGENT="IS40; iPhone 26.3.1; 6.17.0; iPhone17,1"
```

Do not commit `.env`; the Cookie is a login secret.

## Next Decisions

1. Which Melon data source should the agent use: official API, internal API, scraping service, or manually supplied data?
2. What should the final "音源源码" format look like?
3. Should the agent only answer, or should it also write files / update a system?
