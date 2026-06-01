# Grok Command Center

Grok Command Center is a Grok-native desktop agent workspace. It is designed as a modern dark GUI home for Grok: open a folder, chat with the agent, let it edit locally, generate media assets, review activity, and preview running apps in one place.

## Why This Exists

Grok Command Center is an experimental Codex-style desktop GUI built exclusively for the xAI/Grok ecosystem. The goal is to give Grok users a first-class local developer workspace: secure key setup, project-aware chat, local file editing, image/video generation, live previews, terminal/check tools, session restore, attachments, voice input, usage tracking, and polished diagnostics in one app.

## Quick Test Drive

```bash
npm install
npm run dev
```

On Windows PowerShell:

```powershell
npm.cmd install
npm.cmd run dev
```

Then:

1. Open a local test project folder.
2. Add a xAI key inside the app.
3. Keep the default xAI API endpoint unless your xAI account uses another region.
4. Ask Grok to inspect, edit, build, or create a small browser app.
5. Start the live preview to watch generated files run locally.

API keys are stored in Electron user data through `safeStorage`. They are not stored in this repository and should not be committed.

## Current MVP

- Electron + React + TypeScript desktop shell
- Grok-only model catalog
- First-run onboarding wizard for model, endpoint, API keys, permissions, and first workspace
- Preferences dialog for model, endpoint, permissions, usage limits, preview command, backups, and setup
- Secure local API key storage through Electron safeStorage
- Local workspace picker and file explorer
- In-app file search with content snippets
- Built-in file viewer/editor with save, reload, copy, and open-external controls
- Project memory saved per workspace and injected into future Grok runs
- Before-run file checkpoints with conservative restore
- Git changed-file summary
- Grok agent SDK service bridge
- Permission modes: plan, default, auto-edit, yolo
- Live preview server manager
- Preview command override with auto-detect, static server, and common dev-server presets
- Imagine media suite for xAI image generation, image editing, text-to-video, image-to-video, and reference-to-video workflows
- Workspace asset gallery that immediately saves generated images/videos under `assets/imagine`
- Imagine status stream for submitted, polling, downloading, saved, and error states
- Chat attachments for local files, screenshots, audio, and documents
- Browser speech dictation when Chromium speech recognition is available
- Markdown-style chat rendering with headings, lists, links, inline code, fenced code blocks, and copy-code buttons
- Editable prompt library chips for common and custom Grok tasks
- Local estimated usage meter with a configurable soft limit
- Grok run lifecycle card with elapsed time, idle time, last activity, stalled-run warning, stop, and retry-last-prompt controls
- Friendlier Grok error classification for API keys, quota/rate limits, CLI launch failures, permission denials, network failures, and context limits
- Session restore with recent projects, active transcripts, saved chat history, and preview state
- Versioned settings and session storage that can read older raw JSON files
- New-chat reset and Markdown transcript export
- Per-workspace chat history panel for returning to archived sessions
- Non-secret settings backup export/import
- Full session backup export/import for recent workspaces, active transcripts, chat history, command history, plans, and preview state
- Agent checklist panel for Grok planning/todo updates
- Git-backed change review drawer
- Workspace check runner for detected test, build, lint, and typecheck scripts
- Built-in workspace terminal with command presets, detected check shortcuts, output history, and copy controls
- Command palette for quick workspace, chat, preview, settings, git, terminal, and check actions
- Model capability badges for thinking, xAI, vision, file input, speed, and preview status
- Workspace dashboard for recent activity, changed files, checks, checkpoints, generated assets, usage, and preview state
- Right-rail view tabs for focused Overview, Build, Runtime, Preview, Imagine, and All work modes
- Activity timeline for Grok runs, tool activity, command results, preview status, and errors
- Toast notifications for important run, preview, settings, export, and failure events
- In-app reliability diagnostics for app mode, Electron/Node versions, storage paths, persisted files, and runtime logs
- Searchable in-app owner's manual backed by `docs/OWNERS_MANUAL.md`
- Compact project diagnostics for bridge, model, endpoint, preview, keys, and usage status
- Interactive approval prompt for Grok tool and command requests
- Focused smoke tests for backups, preview command detection, preferences rendering, and chat code-block parsing
- Carbon black, gunmetal, brushed silver, copper, and amber interface inspired by the Grok Command Center artwork

## Requirements

- Node.js 20 or newer
- Bundled SDK runner configured for xAI-compatible Grok runs
- An xAI API key

PowerShell may block npm `.ps1` shims on Windows. Use `npm.cmd` if that happens.

## Build Checks

GitHub Actions runs CI on pushes and pull requests to `main`.

```bash
npm run typecheck
npm test
npm run build
npm run smoke:desktop
```

For a fuller release-confidence pass, run:

```bash
npm run check:release
```

For the optional paid end-to-end Grok smoke test, save an xAI API key in the desktop app first, then run:

```bash
npm run smoke:grok
```

The release checklist lives at `docs/RELEASE_CHECKLIST.md`.

## Desktop Builds

The `Windows Release Build` GitHub Action can build the Windows artifacts and upload them for download. When run from a `v*` tag, or manually with `create_release=true`, it creates a draft prerelease with the `.exe` files attached.

For a local runnable Windows desktop build:

```bash
npm run pack
npm run smoke:packaged
```

The unpacked app is created at:

```text
release/win-unpacked/Grok Command Center.exe
```

For distributable Windows artifacts:

```bash
npm run dist:win
```

This produces:

```text
release/Grok-Command-Center-0.2.0-x64-Setup.exe
release/Grok-Command-Center-0.2.0-x64-Portable.exe
```

For the full package confidence pass:

```bash
npm run check:package
```

After `npm run pack` or `npm run check:package`, the optional packaged real-Grok smoke test is:

```bash
npm run smoke:grok:packaged
```

If you change the app icon source PNG, regenerate the Windows `.ico` before packaging:

```bash
npm run icons:win
```

Current Windows builds are unsigned development artifacts, so Windows SmartScreen may warn until a trusted code-signing certificate or Microsoft Store packaging path is added.

## Notes

The first prototype defaults to `grok-4.3` with the xAI API endpoint. If your xAI account uses a different available Grok model, switch models in the settings bar.

The owner's manual lives at `docs/OWNERS_MANUAL.md` and is also available inside the app from the help button, F1, or the command palette.


