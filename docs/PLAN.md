# Storybook Annotations Addon (standalone)

## Context

Build a **standalone, publishable Storybook addon** — `@kylebrodeur/storybook-addon-annotations` (GitHub + npm under `kylebrodeur`) — that lets a person leave visual comments/notes directly on the rendered story canvas, anchored to the underlying component or a specific element, with threaded replies where either humans or (later) an agent can reply, plus resolve/reopen. It is a reusable dev tool for a design→code→QA workflow, developed in its own repo with its own example Storybook (addon-kit layout).

Modeled on `U of Digital/wp-agent-os` (block-anchored comment/thread system: presentation-only overlay + persistence controller + pluggable store, fail-closed anchoring) and `enviro-grow-pico/iot-rig` (normalized-fraction overlay, `pointer-events:none` root with children opting back in, strict teardown, real save/error states, JSONL data). These live in sibling repos as **read-only references — do not import from them**; re-implement in React.

**The only server is the local Storybook dev server.** The addon's preset mounts a tiny REST API + a store **inside Storybook's own dev server** via the `experimental_devServer` preset hook — no separate/standalone server, no external backend, nothing extra spawned. Persistence is a **flat, portable JSONL file** (one thread per line, diffable/greppable/committable), and the addon can **export portable review docs** (JSONL + CommonMark-`.mdx`) for the design→code→QA loop. Exposing the store to MCP for agents is a **future** seam the REST/store layer is designed for but this plan does **not** build (no MCP server, no "send to agent" UI); agent participation exists now only as a data-model capability (`author:'agent'`) writable through the same REST API.

The addon hooks into Storybook where it helps a review workflow: a **globals-driven toolbar toggle** for annotate mode (URL-shareable), **sidebar status badges** showing open-comment counts per story (via Storybook's status store, enabling built-in status filtering), and an **MDX Docs block** to render a component's annotations inside its Docs page.

End state: with the addon registered, every story gains an "Annotate" toolbar toggle; clicking the canvas places a pin and opens a thread composer in a side panel; comments persist across reloads in a JSONL file; replies thread under the root comment; threads resolve/reopen; element-level anchoring works when a component exposes `data-annotation-anchor`, else falling back to whole-component (story-root) anchoring; the sidebar shows which stories have open comments; and annotations export to portable JSONL/MDX.

## Verified facts (this session)

- `storybookjs/addon-kit` is the canonical standalone-addon template: `package.json#bundler` (`managerEntries`/`previewEntries`/`nodeEntries`) + `tsup.config.ts` (ESM, externalizes browser-provided pkgs); a self-contained dev Storybook under `.storybook/` that loads the **built** addon via `.storybook/local-preset.ts` (exports `previewAnnotations()`/`managerEntries()` → `../dist/preview.js`/`../dist/manager.js`; re-exports `../dist/preset.js`); `.storybook/main.ts` uses `defineMain` from `@storybook/react-vite/node` with `addons: ['@storybook/addon-docs', import.meta.resolve('./local-preset.ts')]`; `start` runs `run-p build:watch "storybook --quiet"`.
- SB10 `storybook/manager-api` exports (verified in installed `storybook@10.6.0` `dist/manager-api/index.d.ts`): `addons`, `types`, `useChannel`, `useParameter`, `useGlobals`, `useGlobalTypes`, `useAddonState`, `useStorybookApi`, `useStorybookState`, and the status store: `experimental_getStatusStore`, `experimental_useStatusStore`.
- SB10 status store: `experimental_getStatusStore(typeId: string)` → `{ getAll(): Status[]; set(statuses: Status[]): void; unset(storyIds?: StoryId[]): void; onAllStatusChange(cb); onSelect(cb); typeId }`; `Status = { value: StatusValue; typeId: string; storyId: string; title: string; description: string }`; valid `StatusValue` = `status-value:{pending,success,new,modified,affected,reviewing,warning,error,unknown}` (from `dist/_browser-chunks/chunk-D6P6QKH4.js`). Setting per-story statuses renders sidebar badges and feeds the built-in status filter.
- SB10 `storybook/preview-api` exports: `useChannel`, `useParameter`, `useGlobals`, `useEffect`, `useStoryContext`.
- SB10 preset Node hook: `export const experimental_devServer = async (app, options) => app` (Express-compatible middleware app). Confirmed used by `@storybook/addon-mcp@10.6.0` (`dist/preset.js`, mounts routes via `app.get(endpoint,…)`/`app.post(endpoint,…)`); runs only under `storybook dev`, not `storybook build`. (Its `tmcp` MCP server is the future MCP reference — not built here.)
- Preview decorators receive `context.canvasElement` (story root DOM node), `context.id` (storyId), `context.title`, `context.parameters`, `context.globals`.

## Architecture

One JSONL store, reached three ways — all inside the single `storybook dev` process (no other server):

1. **Preview iframe (browser, React)** — a global decorator renders a presentation-only overlay over `context.canvasElement`: reads annotate mode from `context.globals`, captures clicks, computes a normalized anchor point, draws one pin per thread, emits gestures over the addon channel. No storage access.
2. **Manager (browser, React)** — a panel is the **controller**: owns data access (REST client), renders threads/replies/resolve, pushes thread lists to the overlay over the channel, and publishes per-story open-counts to Storybook's status store. A toolbar **tool** toggles the annotate **global**.
3. **Storybook dev server (Node — the only server)** — the addon preset's `experimental_devServer` hook mounts a small REST API backed by an `AnnotationStore` (default: a JSONL file on disk) **inside Storybook's existing dev server process**; nothing extra is spawned. Also serves portable exports. Single source of truth; the seam a future MCP tool will call.

Manager ⇄ preview coordinate over the Storybook addon **channel** (gestures, present threads, reveal). Annotate **mode** flows manager→preview via a Storybook **global** (not the channel). Manager ⇄ store communicate over **same-origin HTTP** to Storybook's own dev server — no extra origin, port, or process.

## Approach

Ordered so the tree builds and the package's own tests pass after each. Steps 1–2 foundation. Step 3 (Node store+REST+export) and Step 5 (preview overlay) depend only on 1–2 and are mutually independent. Step 4 (client) feeds Step 6 (manager). Steps 7 (docs block), 8 (dev harness + demo), 9 (tests) follow.

### 1. Scaffold the standalone package (addon-kit layout)

Create a self-contained repo dir `storybook-addon-annotations/` at the workspace root (`/Users/kylebrodeur/workspace/storybook-addon-annotations/`); **no dependency on folia-app or any sibling repo**.

- `package.json`:
  - `"name": "@kylebrodeur/storybook-addon-annotations"`, `"version": "0.0.0"`, `"type": "module"`, `"license": "MIT"`, `"author": "kylebrodeur"`, `"repository": { "type": "git", "url": "https://github.com/kylebrodeur/storybook-addon-annotations" }`, `"keywords": ["storybook-addon","annotations","comments","review","qa"]`.
  - `"exports"`: `"."` → `{ "types": "./dist/index.d.ts", "default": "./dist/index.js" }`; `"./manager"` → `"./dist/manager.js"`; `"./preview"` → `{ "types": "./dist/preview.d.ts", "default": "./dist/preview.js" }`; `"./blocks"` → `{ "types": "./dist/blocks.d.ts", "default": "./dist/blocks.js" }`; `"./preset"` → `"./dist/preset.js"`; `"./package.json"` → `"./package.json"`.
  - `"bundler": { "managerEntries": ["src/manager.tsx"], "previewEntries": ["src/preview.tsx", "src/index.ts", "src/blocks.tsx"], "nodeEntries": ["src/preset.ts"] }`.
  - `"scripts"`: `"build": "tsup"`, `"build:watch": "tsup --watch"`, `"start": "run-p build:watch \"storybook dev -p 6006 --quiet\""`, `"storybook": "storybook dev -p 6006"`, `"export:docs": "node --experimental-strip-types scripts/export-annotations.ts"`, `"test": "node --experimental-strip-types --test 'src/**/*.test.ts'"`, `"typecheck": "tsc --noEmit"`.
  - `"peerDependencies": { "react": "^18 || ^19", "react-dom": "^18 || ^19", "storybook": "^10" }`.
  - `"devDependencies"`: `@storybook/addon-docs`, `@storybook/react-vite`, `storybook` (`^10.6.0`), `@storybook/icons ^2`, `@types/node ^22`, `@types/react ^19`, `@types/react-dom ^19`, `react ^19`, `react-dom ^19`, `@vitejs/plugin-react ^5`, `vite ^7`, `tsup ^8.5.0`, `typescript ^5.7.0`, `npm-run-all2 ^8`.
  - `"publishConfig": { "access": "public" }`, `"storybook": { "displayName": "Annotations", "icon": "" }`.
- `tsup.config.ts`: copy addon-kit's file (reads `package.json#bundler`), set `external: ['react','react-dom','@storybook/icons','storybook',/^storybook\//]`.
- `tsconfig.json`: `{ "target":"ES2022","module":"ESNext","moduleResolution":"Bundler","jsx":"react-jsx","strict":true,"declaration":true,"skipLibCheck":true,"types":["react","react-dom","node"],"lib":["ES2022","DOM","DOM.Iterable"] }`, `include:["src"]`.

New package justified (this is the deliverable; no addon exists).

### 2. Domain model + constants

- `src/constants.ts` (exact literals):
  - `export const ADDON_ID = 'kylebrodeur-annotations'`
  - `export const PANEL_ID = \`${ADDON_ID}/panel\``; `export const TOOL_ID = \`${ADDON_ID}/tool\``
  - `export const GLOBAL_KEY = 'kylebrodeurAnnotations'` (globals key; value `'on' | 'off'`, default `'off'`)
  - `export const STATUS_TYPE_ID = 'kylebrodeur-annotations'`
  - `export const OPEN_STATUS_VALUE = 'status-value:warning'`
  - `export const EVENTS = { REQUEST_THREADS: \`${ADDON_ID}/request-threads\`, PRESENT_THREADS: \`${ADDON_ID}/present-threads\`, CREATE_GESTURE: \`${ADDON_ID}/create-gesture\`, ACTIVATE_PIN: \`${ADDON_ID}/activate-pin\`, REVEAL_THREAD: \`${ADDON_ID}/reveal-thread\`, ORPHAN_REPORT: \`${ADDON_ID}/orphan-report\` }` (mode is a global, not an event)
  - `export const DATA_ANCHOR_ATTR = 'data-annotation-anchor'`; `export const STORY_ROOT_KEY = '__story_root__'`
  - `export const API_BASE = '/kylebrodeur-annotations'`
  - `export const PARAM_KEY = 'annotations'`
  - `export const DEFAULT_STORE_FILE = '.storybook-annotations.jsonl'`
- `src/types.ts`:
  - `export type AnnotationAuthor = 'human' | 'agent'`; `export type ThreadStatus = 'open' | 'resolved'`
  - `export interface AnnotationAnchor { storyId: string; elementKey: string; point: { xFraction: number; yFraction: number } }` (elementKey = a `data-annotation-anchor` value or `STORY_ROOT_KEY`; fractions clamped `[0,1]` of the anchor element rect)
  - `export interface AnnotationMessage { id: string; author: AnnotationAuthor; authorName?: string; body: string; createdAt: string }`
  - `export interface AnnotationThread { id: string; anchor: AnnotationAnchor; storyTitle?: string; status: ThreadStatus; messages: AnnotationMessage[]; createdAt: string; updatedAt: string }` (`messages[0]` = root comment; `storyTitle` captured at create for readable exports/badges)
  - `export type NewMessage = { author: AnnotationAuthor; authorName?: string; body: string }`
  - `export interface AnnotationsParameters { disable?: boolean; currentUser?: string }`
  - `export interface AnnotationsPresetOptions { storeFile?: string }`

### 3. Node store (JSONL) + REST API + portable export

- `src/store/store.ts` — interface + pure mutation helpers (unit-tested): `export interface AnnotationStore { list(storyId?: string): Promise<AnnotationThread[]>; create(input:{anchor:AnnotationAnchor; storyTitle?:string; message:NewMessage}): Promise<AnnotationThread>; reply(id:string, message:NewMessage): Promise<AnnotationThread>; setStatus(id:string, status:ThreadStatus): Promise<AnnotationThread>; remove(id:string): Promise<void> }`. Pure fns `newThread(input)`, `applyReply(thread,msg)`, `withStatus(thread,status)` — IDs `crypto.randomUUID()`, ISO timestamps; `newThread` → status `'open'`, one message; `applyReply` appends + bumps `updatedAt`; unknown id throws `Error('thread-not-found')` (fail-closed, never silent-create).
- `src/store/jsonlStore.ts` — `export function createJsonlStore(filePath: string): AnnotationStore`. **Flat portable format: one JSON thread object per line.** Read = read file, split on `\n`, `JSON.parse` each non-blank line, skip+`console.warn` on any corrupt line (never throw). Write = serialize each thread to one line, join with `\n`, atomic write (`filePath + '.tmp'` then `fs.rename`). Missing file → empty. `list(storyId)` filters by `anchor.storyId` when provided, else all (the "all" mode powers sidebar badges + a future MCP tool). Single-process, so read→mutate→rewrite per call is safe.
- `src/export/render.ts` — pure exporters (unit-tested): `export function toJsonl(threads: AnnotationThread[]): string` (one thread per line, same as store); `export function toMarkdown(threads: AnnotationThread[]): string` — **CommonMark only, no JSX** so the output is valid `.md`/`.mdx`/`.mdc`: `# Annotations` title, group by `storyTitle ?? anchor.storyId` as `##` sections, each thread a `###` with anchor label (`STORY_ROOT_KEY`→"Whole component", else the key) + `[open]`/`[resolved]`, then messages as `- **name** _(human|agent, ISO)_: body`.
- `src/server/routes.ts` — `export function mountRoutes(app, store: AnnotationStore): void`. Register one dispatcher `app.use(API_BASE, handler)` (portable; no `:param` routes). Handler strips `API_BASE` from `req.originalUrl || req.url`, JSON-parses body from `req` chunks, dispatches on method + flat subpath:
  - `GET /threads?storyId=…` → `200 {threads}` (omit `storyId` → all)
  - `POST /threads` `{anchor, storyTitle?, message}` → `201 {thread}` (validate `anchor.storyId`, finite `anchor.point`, non-empty `message.body`; else `400 {error:'invalid'}`)
  - `POST /threads/reply` `{id, message}` → `200 {thread}` (unknown id → `404 {error:'thread-not-found'}`)
  - `PATCH /threads/status` `{id, status}` → `200 {thread}` (status ∈ `open|resolved`)
  - `DELETE /threads?id=…` → `200 {ok:true}`
  - `GET /export.jsonl?storyId=…` → `200` text `application/x-ndjson` = `toJsonl(list)`
  - `GET /export.mdx?storyId=…` → `200` text `text/markdown` = `toMarkdown(list)`
    Responses via `res.statusCode`/`res.setHeader`/`res.end(JSON.stringify|text)` (no body-parser/`res.json`). try/catch → `500 {error:'internal',message}`.
- `src/preset.ts` — `export const experimental_devServer = async (app, options: AnnotationsPresetOptions = {}) => { const file = options.storeFile ?? process.env.SB_ANNOTATIONS_FILE ?? path.join(process.cwd(), DEFAULT_STORE_FILE); mountRoutes(app, createJsonlStore(file)); return app }`. Reread `@storybook/addon-mcp/dist/preset.js` `experimental_devServer` for the exact `app` API before writing.
- `scripts/export-annotations.ts` — reads the JSONL store file (arg `--file`/`SB_ANNOTATIONS_FILE`/default) and writes `annotations.mdx` (via `toMarkdown`) + copies the JSONL to `annotations.jsonl` in cwd; prints the two output paths. Portable, committable design→code→QA artifacts.

No existing store/REST/export util exists — new code justified. This layer is the boundary a future MCP toolset (tmcp) wraps; a future Firebase/manual backend implements the same `AnnotationStore` interface.

### 4. Browser REST client

`src/client/api.ts` — same-origin fetch wrappers used by the manager: `listThreads(storyId?)`, `createThread(input)`, `replyThread(id, message)`, `setThreadStatus(id, status)`, `deleteThread(id)`, `exportUrl(format:'jsonl'|'mdx', storyId?)` (returns the `API_BASE` export URL for links/downloads). Each mutation throws `Error('annotations-api-'+status)` on non-2xx (surfaced as inline panel errors; no optimistic success). No storage access in preview.

### 5. Preview overlay (presentation-only pins + click-to-anchor; mode via globals)

- `src/anchor.ts` — pure helpers (unit-tested): `resolveAnchorElement(canvasElement, elementKey)` (`STORY_ROOT_KEY`→`canvasElement`, else `canvasElement.querySelector('['+DATA_ANCHOR_ATTR+'="'+CSS.escape(elementKey)+'"]')`; `null`=orphan); `anchorKeyFromClickTarget(target, canvasElement)` (walk up to first `DATA_ANCHOR_ATTR` ancestor, else `STORY_ROOT_KEY`); `pointInRect(clientX, clientY, rect)` (normalized+clamped `[0,1]`); `pinPixelInRect(rect, point)` (inverse).
- `src/components/Overlay.tsx` — props `{canvasElement, storyId, active, threads, emit}`:
  - Fixed-position container recomputed from `canvasElement.getBoundingClientRect()`, above the story, `pointerEvents:'none'`. Reposition on `ResizeObserver(canvasElement)` + `window` `scroll`(capture)/`resize`; remove all observers/listeners in effect cleanup.
  - Per thread: `resolveAnchorElement`; `null` → no pin, collect id → `emit(EVENTS.ORPHAN_REPORT,{storyId,orphanThreadIds})`. Else `<button>` pin (`pointerEvents:'auto'`) at `pinPixelInRect(anchorRect, point)` offset by overlay origin; color/badge by status (`open`=accent, `resolved`=muted+check); `aria-label`/`title`=root-comment preview; `onClick` → `emit(EVENTS.ACTIVATE_PIN,{threadId})`. One pin per thread.
  - Annotate mode: when `active`, add `canvasElement.addEventListener('click', handler, {capture:true})`; handler `preventDefault()`+`stopPropagation()` (blocks component's own handlers), computes `elementKey=anchorKeyFromClickTarget(e.target, canvasElement)`, target rect, `point=pointInRect(...)`, `emit(EVENTS.CREATE_GESTURE,{anchor:{storyId,elementKey,point}})`. Detach on cleanup/when inactive. `cursor:'crosshair'` + subtle tint while active.
  - `EVENTS.REVEAL_THREAD`: scroll resolved anchor into view + pulse its pin.
- `src/preview.tsx` — `export const decorators = [withAnnotations]`, `export const initialGlobals = { [GLOBAL_KEY]: 'off' }`:
  - `withAnnotations`: read `context.parameters[PARAM_KEY]`; if `disable` → `storyFn()`. `active = context.globals[GLOBAL_KEY] === 'on'`. State `{threads}`; `useChannel`: `PRESENT_THREADS`→if `payload.storyId===context.id` set threads; `REVEAL_THREAD`→overlay. On mount/`context.id` change: `emit(EVENTS.REQUEST_THREADS,{storyId:context.id})`. Render `<>{storyFn()}<Overlay canvasElement={context.canvasElement} storyId={context.id} active={active} threads={threads} emit={emit}/></>`.

### 6. Manager: toolbar toggle (globals), panel (controller), sidebar status badges

- `src/manager.tsx` — `addons.register(ADDON_ID, (api) => {...})`:
  - Tool (`types.TOOL`, `TOOL_ID`, `match:({viewMode})=>viewMode==='story'`): renders `src/components/ToolToggle.tsx` using `useGlobals()` — active = `globals[GLOBAL_KEY]==='on'`, click → `updateGlobals({[GLOBAL_KEY]: active?'off':'on'})`; a `@storybook/icons` pin/comment icon, pressed styling when active.
  - Panel (`types.PANEL`, `PANEL_ID`, `title:'Annotations'`, `match:({viewMode})=>viewMode==='story'`) → `src/components/Panel.tsx`.
  - Status controller: create `const statusStore = experimental_getStatusStore(STATUS_TYPE_ID)`; call `refreshStatuses()` from `src/manager/status.ts` on register and on `STORY_CHANGED`. `refreshStatuses` = `listThreads()` (all) → group by `anchor.storyId`, count `status==='open'` → `statusStore.set(stories.map(s => ({ storyId:s.id, typeId:STATUS_TYPE_ID, value:OPEN_STATUS_VALUE, title:'Annotations', description:\`${n} open comment(s)\` })))`and`statusStore.unset(idsWithZeroOpen)`. Sidebar then shows badges + status filter.
- `src/components/Panel.tsx` (`useChannel`, `useParameter`, `useStorybookApi` from `storybook/manager-api`; UI from `storybook/internal/components`; `styled` from `storybook/theming`):
  - Current story id from `useStorybookApi().getCurrentStoryData()?.id` (+ `.title` for `storyTitle`). Load `listThreads(storyId)` on story change and after each mutation, then `emit(EVENTS.PRESENT_THREADS,{storyId,threads})` and call `refreshStatuses()`.
  - `useChannel`: `REQUEST_THREADS`→reload+present; `CREATE_GESTURE`→open inline draft composer bound to `payload.anchor`; `ACTIVATE_PIN`→scroll+expand that thread; `ORPHAN_REPORT`→mark ids "target unavailable" (badge, disable reveal).
  - Thread list (sorted `createdAt`): anchor label, status pill, messages (author name + `human`/`agent` badge + body + relative time), human reply composer (`replyThread(id,{author:'human',authorName:currentUser,body})`), Resolve/Reopen (`setThreadStatus`), Delete (`deleteThread`). Click thread → `emit(EVENTS.REVEAL_THREAD)`. Header has "Export .mdx"/"Export .jsonl" links to `exportUrl(...)`.
  - Draft composer (from `CREATE_GESTURE`): textarea + Save → `createThread({anchor, storyTitle, message:{author:'human',authorName:currentUser,body}})`; Cancel discards. `currentUser` = `useParameter(PARAM_KEY,{}).currentUser` ?? `'You'`.
  - All calls `await`ed; rejection → inline error (no fake success). Empty body → Save disabled. Deleting the only message deletes the thread. Agent messages render with a distinct badge (only agent surface built now).

### 7. MDX Docs block

`src/blocks.tsx` — `export function Annotations(props: { storyId?: string; title?: string }): JSX.Element`. A self-contained React component authors drop into an MDX Docs page (`import { Annotations } from '@kylebrodeur/storybook-addon-annotations/blocks'`). It fetches `exportUrl('jsonl', props.storyId)` (or, when only `title` given, `GET /threads` then filter by `storyTitle===title`) and renders the threads read-only (same layout as the panel, no composer). Requires exactly one of `storyId`/`title`; if neither, render a small "provide storyId or title" notice. Avoids docs-context coupling entirely (no `@storybook/blocks` internals) — robust across versions.

### 8. Example dev Storybook + demo story

- `.storybook/main.ts`: `defineMain` from `@storybook/react-vite/node`, `stories:['../src/**/*.stories.@(js|jsx|ts|tsx)','../src/**/*.mdx']`, `addons:['@storybook/addon-docs', import.meta.resolve('./local-preset.ts')]`, `framework:'@storybook/react-vite'`.
- `.storybook/local-preset.ts`: copy addon-kit's exactly — `previewAnnotations(entry=[])`→`[...entry, fileURLToPath(import.meta.resolve('../dist/preview.js'))]`; `managerEntries(entry=[])`→`[...entry, fileURLToPath(import.meta.resolve('../dist/manager.js'))]`; `export * from '../dist/preset.js'`. (Dev Storybook loads the **built** addon; `build:watch` must run alongside — `npm start` does both.)
- `src/stories/Demo.stories.tsx`: a React component with ≥2 elements carrying `data-annotation-anchor` (`"hero-title"`, `"cta-button"`) plus untagged regions, and a story arg `hideHeroTitle` removing the `hero-title` element to exercise the **orphan / "target unavailable"** path. Proves element anchoring, story-root fallback, fail-closed orphaning against real DOM.
- `src/stories/Annotations.mdx`: a Docs page using `<Annotations storyId="stories-demo--default" />` (adjust to the generated id) to verify the Docs block.

### 9. Tests (pure-logic, `node --test`)

Run by `test` (`node --experimental-strip-types --test 'src/**/*.test.ts'`):

- `src/anchor.test.ts` — `pointInRect` clamps out-of-rect to `[0,1]`; `pinPixelInRect` inverts `pointInRect` for in-bounds points; `anchorKeyFromClickTarget` returns nearest ancestor's anchor value and `STORY_ROOT_KEY` when none, against a hand-built fake node tree (`getAttribute`/`parentElement`) — no DOM dep.
- `src/store/store.test.ts` — `newThread` → `open` + one message; `applyReply` appends + bumps `updatedAt`; `withStatus` flips; `createJsonlStore` round-trip on a temp file (`os.tmpdir()`): create→list(storyId) filters, reply, setStatus, remove; `reply` unknown id rejects `thread-not-found`; a file with a corrupt middle line loads the valid lines and warns (no throw).
- `src/export/render.test.ts` — `toJsonl` yields one parseable JSON object per line matching input count; `toMarkdown` groups by story, emits `[open]`/`[resolved]`, one bullet per message, and contains no JSX/HTML tags (portable CommonMark).

## Critical files & anchors

- `folia-app/node_modules/@storybook/addon-mcp/dist/preset.js` (`experimental_devServer`, ~line 1504) — exact SB10 dev-server `app` middleware API for `src/preset.ts` + `src/server/routes.ts`; reread before step 3. (Same file's `tmcp` server = future MCP reference, not built now.)
- `folia-app/node_modules/storybook/dist/manager-api/index.d.ts` (line 2 export list) + `dist/_browser-chunks/chunk-D6P6QKH4.js` (`STATUS_VALUES`) — confirm `experimental_getStatusStore` shape and valid `StatusValue` literals before step 6.
- `storybookjs/addon-kit`: `.storybook/main.ts`, `.storybook/local-preset.ts`, `tsup.config.ts`, `src/manager.tsx`, `src/withRoundTrip.ts` (all read) — canonical layout, dev-harness wiring, build config, `addons.register`/`addons.add`, `useChannel` decorator.
- `U of Digital/wp-agent-os/packages/ui/src/editor/EditorCanvasOverlayHost.ts` + `gutenberg-targets.ts` — reference for capture-phase click, normalized pins, fail-closed anchor resolution (read-only; re-implement in React).
- `enviro-grow-pico/iot-rig/ui-lab/src/components/AnnotationPinsOverlay.ts` — reference for `pointer-events` opt-in, ResizeObserver repositioning, teardown (read-only).

## Verification

Prerequisites: run from `storybook-addon-annotations/`. Node ≥ 22 (for `--experimental-strip-types`).

1. **Install + build**: `npm install`; `npm run build` → `dist/` has `manager.js`, `preview.js`, `preset.js`, `index.js`, `blocks.js`, `index.d.ts`, `preview.d.ts`, `blocks.d.ts`; no errors. `npm run typecheck` passes.
2. **Unit tests**: `npm run test` → all anchor + store + render tests pass (incl. temp-file JSONL round-trip, corrupt-line tolerance, `thread-not-found`).
3. **Run**: `npm start`; open `http://localhost:6006`.
4. **Place + persist (story-root, JSONL)**: open `Stories/Demo`; click the **Annotate** toolbar toggle (URL gains `globals=kylebrodeurAnnotations:on`) → crosshair; click an untagged region → composer opens; type "spacing off" + Save → pin appears at click point, thread lists in panel. `cat .storybook-annotations.jsonl` shows exactly one JSON line for the thread. **Reload** → pin + thread persist.
5. **Element anchor + orphan**: annotate the `data-annotation-anchor="hero-title"` element → panel anchor label `hero-title`; reload → pin re-anchors to that element. Flip `hideHeroTitle` → thread shows **"target unavailable"**, no pin, clicking it does not jump.
6. **Reply + resolve**: add human reply "agreed" → threads under root with `human` badge; Resolve → pin muted/checked; Reopen → accent.
7. **Sidebar status badge**: with ≥1 open thread on a story, the sidebar shows a status indicator on that story; resolving all its threads clears it (via the status store). The built-in status filter can filter to stories with annotations.
8. **Portable export**: in the browser, open `http://localhost:6006/kylebrodeur-annotations/export.mdx` → CommonMark grouped by story with `[open]`/`[resolved]` and message bullets; `…/export.jsonl` → one JSON thread per line. Then `npm run export:docs` → writes `annotations.mdx` + `annotations.jsonl` in cwd; `cat annotations.mdx` matches.
9. **Agent/MCP-ready seam** (server-authoritative store, agent-writable — the exact path a future MCP tool uses): with Storybook running, take a thread id from the panel/JSONL and run
   `curl -X POST http://localhost:6006/kylebrodeur-annotations/threads/reply -H 'content-type: application/json' -d '{"id":"<THREAD_ID>","message":{"author":"agent","authorName":"Agent","body":"Consider an 8px grid."}}'`
   → `200 {thread}`; after the panel reloads that story's threads, the reply shows with the **agent** badge. `curl http://localhost:6006/kylebrodeur-annotations/threads` returns all threads.
10. **Docs block**: open the `Stories/Demo` **Docs** tab (or the `Annotations` MDX page) → the `<Annotations/>` block lists that story's threads read-only.
11. **Standalone check**: `grep -R "folia\|wp-agent-os\|iot-rig" src` returns nothing; the repo builds and runs with no sibling-repo reference.

## Assumptions & contingencies

- **Package name/scope**: `@kylebrodeur/storybook-addon-annotations` (npm + GitHub under `kylebrodeur`). Only `package.json#name`/`repository` change if that differs.
- **Standalone repo location**: `/Users/kylebrodeur/workspace/storybook-addon-annotations/`, its own project (not a member of any workspace). If it must live inside another repo's workspaces, only the location + a workspace entry change; addon code unaffected.
- **Storage = a flat JSONL file** served by the Storybook dev server (the only server), chosen for portability/diffability and out-of-process (agent/MCP) reachability. It is local (a file in cwd) and swappable: a future Firebase/manual backend implements the same `AnnotationStore` and is passed where `createJsonlStore` is called. Because it lives in `experimental_devServer`, annotations are a **dev-time** capability; a static `storybook build` has no server and the panel is empty/read-only — acceptable for a dev QA tool.
- **MCP deferred**: this builds the JSONL store + REST + `author:'agent'` model + `/export.*` that MCP will wrap; no `tmcp` server, MCP tools, or "send to agent" UI. Adding them later = register tools calling the existing `AnnotationStore`; no UI/overlay rework.
- **If `experimental_devServer`'s `app` does not strip `API_BASE`** from `req.url` under `app.use(API_BASE, handler)`, match the full `req.originalUrl`/`req.url` instead; flat action paths (`/threads`, `/threads/reply`, `/threads/status`, `/export.mdx`, `/export.jsonl`) stay unambiguous either way.
- **If the SB10 status store method names differ** at implementation time from `{set, unset, getAll, onAllStatusChange}`, use whatever `experimental_getStatusStore(typeId)` returns per the read `dist/manager-api/index.d.ts` (same `10.6.0`); the badge behavior (set open-count per story, clear at zero) is unchanged.
- **If Node's `--experimental-strip-types` is unavailable**, run tests/scripts via `npx tsx` (add `tsx` to devDependencies); logic unchanged.
