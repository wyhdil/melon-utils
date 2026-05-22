# Melon Agent Project Status

Last updated: 2026-05-06

## Project Goal

Melon Agent is intended to become a local web-based assistant for Melon-related music workflows.

The target example workflow is:

```text
User: 给我某个团体的最新一张专辑的音源列表
Agent: 查询该团体最新专辑，整理曲目，并输出可复制的音源源码
```

The project should eventually support multiple Melon-related tasks, not only the latest-album source-list workflow.

## Current Status

The project is currently at the **local UI plus first real workflow modules** stage.
The album source-code workflow, Melon identity workflow, single-song source rule workflow, and avatar upload workflow now have first implementations.

It can:

- Start a local web page at `http://127.0.0.1:3100`.
- Show a chat-style interface.
- Show four feature modules before the chat input: `专辑音源`, `melon实名`, `单曲音源`, and `更换头像`.
- Send the selected module ID with each chat request.
- Send user input from the browser to the local Node.js server.
- Route matching text to an internal agent task.
- Recognize requests for full-source HTML such as `给我 tws 最新专辑的全曲源码`.
- Recognize dated requests such as `给我 tws 2026.04.27 发行的全曲源码`.
- Answer basic help/greeting prompts such as `你好`, `你能做什么`, `help`, and `怎么用`.
- Return a friendlier unsupported-task response with a usable example prompt.
- Search Melon by artist name for full-source HTML requests.
- Resolve the first matching Melon artist result.
- Fetch that artist's Melon album list.
- Select the latest album by release date, or select a release date specified by the user.
- Fetch the Melon album detail page and parse album metadata plus track IDs.
- Generate full-track source HTML from live Melon data.
- Generate `melon实名` HTML templates from a romanized name and birth date. Birth dates support compact and separated formats, such as `yeqianwen，20010608` or `SHI YUNLIN，1991.08.14`.
- Output `melon实名` results as three independently copyable blocks: `melon-kkt-`, `[\s\S]*`, and the generated HTML template.
- Search Melon by artist and song title for single-song source requests, such as `tws，널 따라가 (You, You)`.
- Resolve common artist aliases and Chinese fan nicknames for single-song requests, such as `芒叉` -> `MONSTA X`.
- Resolve `主打曲` / `最新专辑主打` requests by fetching the artist's latest Melon album and reading Melon's title-track marker.
- Optionally use DeepSeek via local `DEEPSEEK_API_KEY` as a semantic parsing fallback for fuzzy prompts. Final song, album, and songId data still come from Melon.
- Output a copyable single-song regex such as `.*songId=601862626\b.*$`.
- Accept an optional third number for `单曲音源`, such as `itzy, 달라달라，199`, then output independent copyable fragments for `songId`, `TOTALLISTENCNT`, `FIRSTLISTENDATE`, `SONGID`, and `MYSTREAMCOUNT`.
- Upload an image in `更换头像` and forward it to `https://m2.melon.com/mymusic/updateUserImg.json` using the local `MELON_COOKIE`.
- Return the updated Melon avatar URLs as copyable blocks after a successful avatar upload.
- Fall back to configured local album files such as `data/albums/tws.json` when live lookup is disabled.
- Display source/code blocks with copy buttons when responses contain fenced code blocks.
- Copy code through the local clipboard endpoint when browser clipboard APIs fail.
- Keep module conversations isolated from each other in the browser UI.
- Run automated tests for the current routing and web server behavior.

It cannot yet:

- Answer open-ended general chat beyond the current help/greeting prompts.
- Fully disambiguate ambiguous group names without follow-up questions.
- Maintain conversation context.
- Ask follow-up questions when the request is incomplete.
- Automatically refresh an expired Melon Cookie. The user must update `.env` when the login state expires.

Updated limitations:

- Live Melon parsing depends on Melon HTML structure. If Melon changes its page markup, the parser may need adjustment.
- The first artist search result is used automatically. Ambiguous names are not disambiguated yet.
- Network access is required for live lookup.
- The single-song workflow handles common aliases and title-track intent, but alternate song titles and ambiguous duplicate songs may still need more alias entries or follow-up questions.
- Avatar upload depends on Melon accepting one of the configured multipart field names. If auto-trying common field names fails, set `MELON_AVATAR_FIELD_NAME` in `.env` after finding the exact field name in Spider Proxy.
- Real Melon cookies are local secrets and must not be committed to git.

## Implemented Files

Core agent:

- `src/index.ts`: CLI entry point.
- `src/agent/melon-agent.ts`: task classification and agent entry.
- `src/agent/tool-registry.ts`: task registry.
- `src/modules/feature-modules.ts`: canonical feature module list and metadata.
- `src/tasks/help.ts`: current usage/help response for greeting and help prompts.
- `src/tasks/melon-identity.ts`: Melon identity template generation from name and birth date.
- `src/tasks/single-source.ts`: Melon single-song songId lookup and regex output.
- `src/tasks/avatar-change.ts`: guidance response for the avatar upload module.
- `src/tasks/module-placeholder.ts`: placeholder responses for planned modules.
- `src/tasks/latest-album-sources.ts`: latest album source-list task placeholder.
- `src/tasks/full-source-html.ts`: live Melon full-source HTML generation task with local fallback support.
- `src/tools/melon-client.ts`: Melon data provider interface placeholder.
- `src/tools/source-formatter.ts`: source output formatter placeholder.
- `src/tools/melon-live-client.ts`: live Melon search, song search parsing, artist album list parsing, album detail parsing.
- `src/tools/melon-avatar-client.ts`: Melon avatar upload client for `updateUserImg.json`.
- `src/tools/env.ts`: local `.env` loader for secrets such as `MELON_COOKIE`.
- `src/tools/source-html-generator.ts`: wrapper around the local copied `scripts/build_row.py` generator.
- `scripts/build_row.py`: copied source HTML generator from the previous melon-web project.
- `data/albums/tws.json`: local TWS album configuration.

Local web UI:

- `src/server.ts`: local HTTP server, `/api/chat`, `/api/modules`, `/api/copy`, and `/api/avatar` endpoints.
- `public/index.html`: chat page.
- `public/styles.css`: chat UI styling.
- `public/app.js`: browser-side module selection, chat behavior, and copy buttons.

Tests:

- `src/agent/melon-agent.test.ts`: task routing tests.
- `src/server.test.ts`: local web server and chat API tests.
- `src/public-app.test.ts`: browser-side copy behavior tests.
- `src/tasks/single-source.test.ts`: single-song request parsing and regex output tests.
- `src/tools/source-html-generator.test.ts`: source HTML generation regression tests.

Project setup:

- `package.json`: scripts and dependencies.
- `tsconfig.json`: TypeScript configuration.
- `.env.example`: future environment variable template.

## Why It Still Feels Like It Cannot Do Much

The current agent can perform the full-source HTML workflow, but it is still not a general chat assistant.

Before the help task was implemented, when the user entered:

```text
你好，你能做什么
```

the agent would return:

```text
暂不支持这个任务：unsupported
```

That happened because the old classifier only recognized requests containing all three keywords:

```text
最新
专辑
音源
```

The current version now routes `你好`, `你能做什么`, `help`, and `怎么用` to a help response with supported examples.

When the user enters:

```text
给我 aespa 最新一张专辑的音源列表
```

the old source-list placeholder task may still answer if the wording asks for `音源列表` instead of `全曲源码`. The implemented live workflow is currently the `全曲源码` path.

When the user enters:

```text
给我 tws 最新专辑的全曲源码
```

the agent now:

1. Searches Melon for `tws`.
2. Resolves TWS to Melon artist ID `3679688`.
3. Fetches the artist album page.
4. Selects the latest album by release date.
5. Fetches the album detail page.
6. Parses the album and track data.
7. Runs the copied `scripts/build_row.py` generator.
8. Returns an HTML code block in the chat UI.

When the user enters:

```text
给我 tws 2026.04.27 发行的全曲源码
```

the agent searches the same artist album list and selects the album released on `2026.04.27`.

When the user switches to `单曲音源` and enters:

```text
tws，널 따라가 (You, You)
```

the agent now:

1. Searches Melon for the artist and song title.
2. Parses the song result section.
3. Matches the title and artist.
4. Returns the copyable regex:

```regex
.*songId=601862626\b.*$
```

When the user adds a stream count:

```text
itzy, 달라달라，199
```

the agent resolves `달라달라` to songId `31606729`, gets the release date `2019.02.12`, and returns each output fragment in a separate copyable code block.

When the user switches to `更换头像`, the chat composer is replaced by an image uploader. After the user selects a local image, the browser sends it to `/api/avatar`; the local server reads `MELON_COOKIE` from `.env`, submits a multipart request to Melon, and returns the new avatar URLs from `MYPAGEIMG` and `MYPAGEIMGORG`.

## Recommended Implementation Roadmap

### Phase 1: Make The Current UI Useful

Goal: improve the local experience before connecting real Melon data.

Tasks:

- Add a help response for questions like `你能做什么`, `help`, and `怎么用`.
- Add friendlier unsupported-task messages.
- Show example prompts in the UI.
- Make the agent ask for missing artist names instead of returning `UNKNOWN_ARTIST`.
- Add response types so the UI can distinguish normal text from source/code output.

Expected result:

The user can understand what the agent currently supports and what to type next.

Status: mostly complete for local usage. The source HTML workflow is useful now, help prompts work, and unsupported-task responses include examples. Remaining polish includes progress text and artist disambiguation.

### Phase 2: Define The Source Output Format

Goal: know exactly what "音源源码" means before generating final output.

Needed input from user:

- A real example of the desired source output.
- Whether the output is Markdown, HTML, BBCode, JSON, XML, or another custom format.
- Whether each track needs Melon IDs, song titles, artist names, album name, duration, links, or image URLs.
- Whether the output should include only tracks or also album metadata.

Expected result:

`src/tools/source-formatter.ts` can be implemented correctly.

### Phase 3: Connect Melon Data

Goal: fetch real album and track data.

Possible data source options:

- Official or internal Melon API if available.
- Existing backend API if the user already has one.
- Scraping adapter if API access is unavailable.
- Manual JSON input for early testing.

Needed input from user:

- Which data source is allowed.
- Whether login/cookies are required.
- Example Melon URLs for artists, albums, and songs.
- Expected handling for Korean artist names and aliases.

Expected result:

`src/tools/melon-client.ts` can return real `MelonAlbum` data.

Status: first implementation complete for live full-source HTML generation. The implementation lives in `src/tools/melon-live-client.ts`.

### Phase 4: Add A Real Agent Planner

Goal: move from keyword matching to natural language task handling.

Tasks:

- Add OpenAI Responses API integration.
- Define available tools, such as `find_latest_album`, `format_source_payload`, and later other Melon tasks.
- Let the model choose the right tool based on the user's request.
- Add safe fallback behavior when the request is unclear.

Expected result:

The agent can understand more natural prompts and route them to the right workflow.

### Phase 5: Add More Melon Workflows

Potential workflows:

- Latest album source list.
- Specific album source list from URL or album name.
- Artist discography summary.
- Track metadata lookup. First single-song songId lookup is implemented.
- Album comparison.
- Chart/ranking lookup.
- Source format conversion.
- Batch processing for multiple artists.

Each workflow should be added as a separate task under `src/tasks/`.

## Current Commands

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Run CLI:

```bash
npm run dev -- "给我 aespa 最新一张专辑的音源列表"
```

Run local web UI:

```bash
npm run web
```

Open:

```text
http://127.0.0.1:3100
```

## Immediate Next Step

The best next implementation step is **implement the next selected feature module**.

Specifically:

1. Verify `更换头像` against a real Melon Cookie and, if needed, set the exact `MELON_AVATAR_FIELD_NAME`.
2. Improve `单曲音源` with alias support, duplicate-song disambiguation, and any additional replacement fragments needed by the user's source workflow.
3. Improve `专辑音源` with artist disambiguation and alias support.
4. Add clearer loading/progress text for live Melon lookup.
