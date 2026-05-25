# Melon Agent Handoff Notes

Last updated: 2026-05-25

This document is the quick-start context for continuing this project in a new thread.

## Project Summary

Melon Agent is a Node.js web app for Melon-related utility workflows. The user mainly uses it from mobile, so the UI should stay compact, touch-friendly, bright, and iOS-like. Avoid layouts that create horizontal scrolling or large fixed panels that squeeze the chat area.

The production-ish public URL is:

```text
http://54.196.179.57:3100
```

The local dev URL is:

```text
http://127.0.0.1:3100
```

The GitHub repository is:

```text
https://github.com/wyhdil/melon-utils.git
```

The latest known deployed commit at the time of this note:

```text
4bed07a Compact single source regex tools
```

## Tech Stack

- Runtime: Node.js 22+
- Language: TypeScript for backend/task logic
- Frontend: plain HTML/CSS/JavaScript in `public/`
- Server: custom Node HTTP server in `src/server.ts`
- Tests: Node built-in test runner
- Deployment: AWS EC2, systemd service named `melon-agent`

Important scripts:

```bash
npm install
npm run build
npm run web
npm test
```

## Project Structure

Core files:

- `src/server.ts`: web server, static files, `/api/chat`, `/api/modules`, `/api/copy`, `/api/avatar`.
- `src/agent/melon-agent.ts`: task routing by selected module.
- `src/modules/feature-modules.ts`: four feature tabs and their descriptions.
- `src/tasks/full-source-html.ts`: album full-source HTML workflow.
- `src/tasks/melon-identity.ts`: Melon real-name template workflow.
- `src/tasks/single-source.ts`: single-song songId and regex workflow.
- `src/tasks/avatar-change.ts`: avatar module guidance.
- `src/tools/melon-live-client.ts`: live Melon search and parsing.
- `src/tools/deepseek-semantic-parser.ts`: optional DeepSeek semantic parser for fuzzy single-song prompts.
- `src/tools/melon-avatar-client.ts`: Melon avatar upload client.
- `src/tools/source-html-generator.ts`: wrapper around `scripts/build_row.py`.
- `scripts/build_row.py`: copied source HTML generator from the older melon-web project.
- `public/index.html`: UI shell.
- `public/app.js`: module switching, chat behavior, copy behavior, compact regex tools.
- `public/styles.css`: mobile-first iOS-like UI styling.

Tests:

- `src/agent/melon-agent.test.ts`
- `src/server.test.ts`
- `src/public-app.test.ts`
- `src/tasks/single-source.test.ts`
- `src/tools/melon-live-client.test.ts`
- `src/tools/source-html-generator.test.ts`

## Feature Modules

The app has four tabs:

1. `专辑音源`
2. `melon实名`
3. `单曲音源`
4. `更换头像`

Each module keeps its own frontend conversation history. Switching tabs should update:

- active tab style
- header description
- input placeholder
- module-specific controls
- conversation content

Do not mix messages between modules.

## 专辑音源

User intent examples:

```text
给我 tws 最新专辑的全曲源码
给我 tws 2026.04.27 发行的全曲源码
给我 itzy 在0518发行的全专源码
```

Current behavior:

1. Extract artist and optional release date.
2. Search Melon artist.
3. Fetch artist album list.
4. Pick latest album by date, or pick the requested date.
5. Fetch album detail.
6. Parse album metadata and tracks.
7. Generate HTML via `scripts/build_row.py`.
8. Return copyable fenced code block.

Important limitation:

- Live parsing depends on Melon page structure.
- Ambiguous artist names may still need alias support or better semantic parsing.

## melon实名

User intent examples:

```text
yeqianwen,20010608
huanglizhi,20050902
SHI YUNLIN, 1991.08.14
test kk,20001010,指定认证日2026.02.02
```

Current behavior:

- Generates three independently copyable blocks:
  - `melon-kkt-`
  - `[\s\S]*`
  - full Melon identity HTML template
- Birth dates support compact and dotted/separated formats.
- Age is calculated using the current date.
- Auth date:
  - If specified, use that exact date.
  - If not specified, randomly choose a date from roughly current date minus 4 months to minus 2 months.

Name masking rules that the user cares about:

- Convert name to uppercase.
- If the user includes spaces, preserve those spaces and do not invent a new split.
- If no spaces, use Chinese romanized surname boundaries when possible, such as `CUI ZHIXIU`.
- Show first two letters and final two letters for the whole visible name logic, masking the middle with `*`.
- Examples:
  - `cuizhixiu` -> `CU* ****IU`
  - `HELLO HWTA` -> `HE*** **TA`
  - `HSU HAHA KE` -> `HS* **** KE`

## 单曲音源

User intent examples:

```text
tws，널 따라가 (You, You)
itzy, 달라달라，199
芒叉主打曲
李泰民在0518发行的主打曲
itzy上一张正规专辑的主打曲
```

Current behavior:

- Searches Melon by artist and song title.
- Returns songId regex:

```regex
.*songId=31606729\b.*$
```

- If a stream count is provided, returns independent copyable regex/value fragments:

```regex
"TOTALLISTENCNT":".*?\"
```

```regex
"TOTALLISTENCNT":"199"
```

```regex
"FIRSTLISTENDATE":".*?\"
```

```regex
"FIRSTLISTENDATE":"2019.02.12"
```

```regex
"SONGID":".*?\"
```

```regex
"MYSTREAMCOUNT":".*?\"
```

The single-song module also has a compact regex tool area near the input. It appears only in `单曲音源`. It uses pill buttons, not large cards, because the user uses this on mobile and wants the chat area to stay large.

Regex tool buttons currently copy:

```text
.*songId=31606729\b.*$
"TOTALLISTENCNT":".*?\"
"FIRSTLISTENDATE":".*?\"
"MYSTREAMCOUNT":".*?\"
"SONGID":".*?\"
```

Important implementation detail:

- The visible tool buttons should stay short.
- Do not render the full regex text in the tool area unless the user asks, because it makes the chat area cramped.
- Clicking a button copies the hidden regex value.

Semantic parsing:

- `src/tasks/single-source.ts` has deterministic parsing first.
- `src/tools/deepseek-semantic-parser.ts` is optional fallback when `DEEPSEEK_API_KEY` is configured.
- DeepSeek may parse fuzzy intent, but final songId/release-date data must come from Melon, not the LLM.

Known aliases / shortcuts:

- `芒叉` maps to `MONSTA X`.
- Known ITZY title-track shortcuts exist for debut and regular album requests.
- Add more aliases in `src/tools/artist-aliases.ts` or task-specific maps when user reports misses.

## 更换头像

Current behavior:

- In `更换头像`, the chat input is replaced by an image uploader.
- The browser posts the selected image to `/api/avatar`.
- Server reads `MELON_COOKIE` from `.env`.
- Server forwards image to:

```text
https://m2.melon.com/mymusic/updateUserImg.json
```

- Successful response returns avatar URLs as copyable blocks.

Important limitations:

- Melon login Cookie expires. The user must refresh `.env` when it expires.
- Do not commit `.env`.
- If upload fails, it may be expired Cookie, wrong multipart field name, or Melon session/device validation.

Relevant env vars:

```bash
MELON_COOKIE="..."
MELON_AVATAR_FIELD_NAME=file
MELON_USER_AGENT="IS40; iPhone 26.3.1; 6.17.0; iPhone17,1"
DEEPSEEK_API_KEY="..."
DEEPSEEK_MODEL=deepseek-chat
HOST=0.0.0.0
PORT=3100
```

Never print or commit real `MELON_COOKIE` or API keys.

## Frontend UX Preferences

The user prefers:

- Mobile-first design.
- No horizontal scrolling.
- More chat/output space.
- Compact controls.
- Bright, polished, iOS-like visual style.
- Copy by tapping code blocks.
- Copy by tapping compact tool buttons.

Avoid:

- Large template cards that push the chat upward.
- Dark/green-heavy styling.
- Showing unnecessary instructions inside the app.
- Separate conversations getting mixed across tabs.

Current copy behavior:

- Code blocks have a copy button.
- Tapping the black code block surface also copies.
- The app uses `navigator.clipboard` first, then `/api/copy`, then a textarea fallback.

## Deployment Notes

Current EC2:

```text
Public IP: 54.196.179.57
Port: 3100
User: ubuntu
Service: melon-agent
```

The PEM file is local in this project directory and should not be committed.

Deploy command:

```bash
ssh -i melon.pem -o ConnectTimeout=10 ubuntu@54.196.179.57 "cd ~/melon-utils && git pull && npm ci && npm run build && sudo systemctl restart melon-agent && sleep 1 && systemctl is-active melon-agent"
```

Security group notes:

- Port `3100` needs to allow public/mobile access if the user wants to open the app from phone.
- Port `22` should usually be restricted to the user's current IP.
- If SSH fails, ask the user to temporarily allow SSH from current IP, not permanently from `0.0.0.0/0`.

After deploying, verify:

```bash
curl -s http://54.196.179.57:3100/
curl -s http://54.196.179.57:3100/app.js
```

## Development Rules For Future Work

Before changing behavior:

1. Inspect existing files and tests.
2. Keep changes scoped.
3. Prefer existing modules and patterns.
4. Add or update tests for behavior changes.
5. Run:

```bash
node --check public/app.js
npm test
```

When changing frontend layout:

- Check mobile width mentally or with browser testing.
- Make sure no element causes `100vw` overflow.
- Keep chat area as the dominant area.
- Tooling should be compact and contextual to the selected module.

When adding more Melon intelligence:

- Use deterministic parsing for stable known patterns.
- Use DeepSeek only for semantic normalization.
- Always verify final IDs, release dates, title tracks, and album data through Melon.
- Add aliases/maps only when they improve a real reported case.

## Current Known Gaps

- No follow-up-question flow for ambiguous artists or missing inputs.
- Melon HTML parsing can break if Melon changes markup.
- Single-song title-track handling is useful but still incomplete for many artists.
- Avatar upload is fragile because it depends on current Melon login state.
- The app has no authentication, so anyone who can reach the EC2 URL can use it.
- No custom domain or HTTPS is configured yet.

## Useful Next Improvements

High-value next tasks:

1. Add a small auth/passcode gate before public usage.
2. Add more artist aliases and title-track resolution tests based on real misses.
3. Improve album/date matching for common natural-language date formats.
4. Add a settings/status page showing whether DeepSeek and Melon Cookie are configured, without exposing their values.
5. Consider HTTPS and a domain if the app will be used regularly outside local networks.

