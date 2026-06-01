# Grok Command Center Release Checklist

Use this before sharing a build, uploading artifacts, or asking someone else to test-drive the app.

## Preflight

- Pull the latest `main`.
- Confirm the working tree is clean before starting release checks.
- Confirm an xAI API key is saved in the desktop app if running the paid real-Grok smoke test.
- Confirm the app can still start in normal dev mode.

## Automated Checks

GitHub runs `.github/workflows/ci.yml` on pushes and pull requests to `main`. It installs dependencies with `npm ci`, then runs the release confidence checks.

```powershell
npm.cmd run check:release
```

This runs typecheck, unit tests, production build, and the hidden Electron renderer smoke test.

```powershell
npm.cmd run smoke:grok
```

This is the paid end-to-end smoke test. It copies encrypted local settings/secrets into a disposable user-data folder, asks Grok to create a tiny `index.html`, verifies the generated file, starts static preview, and verifies the page is served.

Smoke temp files are removed automatically. Set `GROK_COMMAND_CENTER_KEEP_SMOKE=1` only when you need to keep them for debugging.

```powershell
npm.cmd run check:package
```

This creates the unpacked Windows build and verifies the packaged app renderer loads.

```powershell
npm.cmd run smoke:grok:packaged
```

Run this after `npm.cmd run pack` or `npm.cmd run check:package` when you want the same paid real-Grok smoke test against `release/win-unpacked/Grok Command Center.exe`.

## Manual Desktop Pass

- Launch the app normally.
- Test Grok connection with the saved key.
- Open a disposable workspace.
- Ask Grok to make or edit a small browser app.
- Watch the run status card for elapsed time, idle time, last activity, stalled state, stop, and retry.
- Verify file tree refreshes after completion.
- Verify live preview starts and serves the generated app.
- Open Imagine, run a low-cost image generation, and confirm the saved file appears under `assets/imagine`.
- If testing video credits, run one short 6-second video generation and confirm the polling status resolves and the MP4 is saved locally.
- Queue two generated videos in Imagine, export a stitched MP4, and confirm it appears in the gallery.
- Restart the app and confirm workspace/session restore.
- Open Runtime diagnostics and confirm settings, session, secrets, and runtime log paths look sane.
- Export a transcript and a session backup.

## Packaging Pass

- Run `npm.cmd run dist:win` when distributable artifacts are needed.
- Use the `Windows Release Build` GitHub Action when you want CI-built Windows artifacts.
- Push a `v*` tag or run the workflow manually with `create_release=true` to create a draft prerelease with the generated `.exe` files attached.
- Install the setup build on a clean-ish Windows profile when possible.
- Launch the portable build once.
- Confirm Windows SmartScreen warnings are expected for unsigned local builds.
- Keep generated artifacts under `release/`; do not commit them.

## Ship Notes

- Current Windows artifacts are unsigned development builds.
- Microsoft Store packaging/signing can be handled later if that distribution path is chosen.
- API keys and project files are never included in settings/session backups.
