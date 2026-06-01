# Grok Command Center Owner's Manual

Grok Command Center is a Grok-native desktop agent workspace. It gives Grok a local home for opening a project folder, reading and editing files, generating images and videos, running checks, using the terminal, previewing browser apps, and keeping useful project context around.

## Quick Start

- Use the setup wizard on first run to pick a model, endpoint, permission mode, API key, and first workspace.
- Open a project folder from the workspace panel if you skipped setup.
- Paste and save an xAI API key in the model settings.
- Use Test Grok to confirm the selected model and endpoint respond.
- Ask Grok a concrete task in chat, such as inspect this project or build a small browser game.
- Watch the dashboard, chat, plan panel, files, checks, terminal, and live preview as Grok works.

## Chat

- Use chat for coding tasks, project questions, reviews, UI polish, and debugging.
- Attach files, screenshots, documents, audio, or videos with the paperclip button or by dropping them into chat.
- Use the microphone button when Chromium speech recognition is available.
- Copy individual messages, copy the visible transcript, or export the transcript as Markdown.
- Grok responses render common Markdown patterns such as headings, bullet lists, links, inline code, and fenced code blocks.
- Use Copy code on a fenced code block when you only need the snippet instead of the whole message.
- Reasoning is collapsed by default, while raw stream events live in the Raw drawer for debugging.
- The run status card shows elapsed time, idle time, last activity, attachment count, current phase, Stop, and Retry.
- If Grok goes quiet for a while, the status changes to Waiting on Grok so you know the app has not lost track of the run.
- Use Retry after a failed or completed run to send the last prompt and attachments again.
- Use prompt chips for repeated tasks and open the template manager to add, edit, delete, or reset those chips.

## Workspace Dashboard

- The dashboard summarizes the current workspace at a glance.
- It shows changed files, detected checks, checkpoints, local usage, preview state, last command, and recent Grok output.
- Use the dashboard actions for quick open, review, preview, check, and refresh workflows.
- Use right-rail tabs to switch between Overview, Build, Runtime, Preview, Imagine, and All panel groups.
- Overview focuses on the dashboard, activity, and chat history.
- Build focuses on memory, checkpoints, Grok plans, checks, and terminal commands.
- Runtime focuses on activity, reliability diagnostics, runtime logs, Grok plans, and terminal history.
- Preview focuses on the live artifact view and recent activity.
- Imagine focuses on image and video generation plus the generated asset gallery.
- The activity timeline records recent prompts, Grok responses, tool activity, command results, preview state, and errors.
- Toast notifications appear for important events such as completed runs, failed commands, preview changes, exports, and permission requests.

## Sessions

- Grok Command Center restores the active workspace and current transcript after restart.
- New chat archives the current transcript instead of throwing it away.
- The Chat history panel lets you reopen or delete older per-workspace sessions.
- Recent workspaces stay available in the workspace explorer.
- Export session saves recent workspaces, active transcripts, saved chat history, command history, agent plans, and preview state.
- Import session replaces the remembered session state in the app and refreshes the active workspace.
- Session backups do not include API keys or project file contents.

## Command Palette

- Open the command palette from the topbar button or with Ctrl+K / Cmd+K.
- Search for actions such as opening folders, refreshing the workspace, opening preferences, starting preview, running checks, exporting settings, or reviewing changes.
- Disabled commands usually mean a workspace is not open, Grok is still running, or a preview is already active.

## Preferences

- Open preferences from the topbar, command palette, or preview configure button.
- Agent settings include model, endpoint, permission mode, thinking mode, thinking budget, and optional CLI override.
- Preview settings include the default port and command override. Leave the command blank for auto-detect, use grok-command-center-static for simple HTML folders, or choose a dev-server preset.
- Usage settings control the local token soft limit.
- Backup controls export and import non-secret settings.

## Workspace Explorer

- The left panel shows the opened folder, file tree, search results, recent workspaces, and git changed-file summary.
- Use file search to find names or text snippets.
- Open a text file to view, edit, copy, reload, save, or open it externally.
- Use Review Changes to inspect git diffs inside the app.

## Project Memory

- Project memory is saved inside the workspace and injected into future Grok runs.
- Use it for coding style, project rules, preferred commands, known traps, and other guidance Grok should remember.
- Keep memory short and practical so it helps instead of becoming noise.

## Checkpoints

- Grok Command Center creates before-run checkpoints so you can restore files if an agent run goes sideways.
- Restoring a checkpoint overwrites matching files from the snapshot.
- It does not delete newer unrelated files.

## Checks And Terminal

- The check runner detects common package scripts such as test, build, lint, and typecheck.
- The terminal panel runs workspace commands and keeps copyable output history.
- Terminal presets include git status, git diff stat, npm install, npm run dev, and directory listing.
- Command output is summarized into chat so the transcript tells the story of the work.

## Live Preview

- Start live preview from the preview panel or command palette.
- Grok Command Center detects common dev commands from package.json and falls back to a static preview for simple folders.
- Use Preferences or the preview configure button to force a specific preview command when auto-detect picks the wrong thing.
- If a root index.html appears after a Grok run, the app can auto-start preview.
- The preview panel includes desktop, tablet, and mobile viewport modes plus dev server logs.

## Imagine Media Suite

- Open the Imagine rail to generate media directly into the current workspace.
- Image mode creates images from text prompts.
- Edit mode uses one or more source images plus a prompt.
- Video mode creates text-to-video outputs.
- I2V mode animates one source image.
- Refs mode uses reference images to guide a video.
- Generated files are downloaded immediately into `assets/imagine` so temporary provider URLs are not the source of truth.
- The gallery shows recent generated images and videos with click-to-preview, open-file, and copy-path controls.
- Source images must be PNG, JPG, JPEG, or WEBP.
- Video renders can take longer than image jobs; watch the status stream for submitted, polling, downloading, and saved states.

## Models And Endpoints

- Grok Command Center only exposes Grok models.
- xAI API is the default endpoint for Grok Command Center.
- Use the xAI endpoint for xAI keys and Grok models.
- Test Grok checks the selected model and endpoint with your saved key.
- Capability badges show useful model hints such as Thinking, xAI, Agentic coding, Vision, File input, Fast, Preview, and Latest.
- Endpoint mismatch appears when the selected endpoint is not the model's recommended endpoint.

## Permissions

- plan keeps Grok in planning mode.
- default uses the SDK's normal permission behavior.
- auto-edit allows file edits while still keeping the app in the loop.
- yolo is the fastest and least cautious mode. Use it only when you are comfortable with Grok editing and running tools freely.

## Usage Limits

- The usage meter is a local estimate for the active session.
- It helps avoid accidentally sending huge transcripts or attachments.
- Provider-side quotas and billing may differ from the local estimate.
- Raise the limit in settings or start a fresh session when the current context gets too large.

## Backups And Exports

- Export transcript saves the visible chat as Markdown.
- Export settings saves non-secret app settings as JSON.
- Export session saves remembered work state such as recent workspaces, chats, plans, command history, and preview state.
- API keys are not included in settings backups.
- Project files are not included in session backups. Keep using normal project folders, git, zip files, or cloud storage for source code backup.
- Sessions, recent projects, command history, and chat history are restored locally by the app.

## Troubleshooting

- If Test Grok says the desktop bridge is missing, run the Electron app instead of the plain browser preview.
- If preview shows Grok Command Center instead of your project, stop preview and start it again after opening the right workspace.
- If a command fails on Windows, try the .cmd version, such as npm.cmd.
- If Grok appears quiet while thinking, watch the working indicator, plan panel, tool rows, and raw drawer.
- If a run fails, Grok Command Center classifies common errors such as missing keys, quota/rate limits, CLI launch failures, permission denials, network issues, and context limits with a next step.
- Use the Runtime diagnostics panel to inspect app mode, Electron and Node versions, storage paths, settings/session/log file status, renderer crashes, unresponsive events, child process exits, and uncaught desktop errors.
- Use Copy diagnostics when you need one support bundle with app environment details and the runtime log tail.
- If the app feels stuck, stop the active Grok run before switching sessions, importing settings, or starting another run.

## Workflow Recipes

### Inspect A Project

- Open the folder.
- Use the Inspect prompt chip or command palette.
- Ask Grok to summarize architecture without editing files.
- Save important conventions into Project Memory.

### Build A Browser Game

- Open an empty or simple folder.
- Ask Grok for a playable browser game.
- Let it create index.html or the project files.
- Start preview and test in the right panel.
- Ask for polish, controls, scoring, and mobile layout.

### Fix Failing Checks

- Run detected checks from the check runner or command palette.
- Ask Grok to inspect failures and make a focused fix.
- Rerun the relevant check.
- Review git changes before moving on.

### UI Polish Pass

- Start from a working app.
- Use the UI pass prompt chip.
- Keep the existing visual language unless you explicitly want a redesign.
- Check desktop and mobile preview modes.

## Keyboard Shortcuts

- Ctrl+K or Cmd+K opens the command palette.
- F1 opens this owner's manual.
- Escape closes overlays such as the command palette, owner manual, and permission prompts when supported.
