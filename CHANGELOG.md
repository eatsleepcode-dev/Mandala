# Changelog

All notable changes to Mandala are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] - 2026-05-12

### Features

- **Folder mapping wizard** — replaces the old "Initialize / Migrate" setup buttons with an editable path form. On first open (or via _Remap Folder Paths_ in Settings), Mandala detects existing folders and pre-fills the form. Confirming writes all five paths to `.vscode/settings.json` (folder-level, highest precedence) and creates any missing directories.
- **Remap Folder Paths button** in Settings → Workspace Management — lets you re-run the mapping wizard at any time without reinitialising the workspace.
- **Folder-level settings write** — path configuration now targets `ConfigurationTarget.WorkspaceFolder` so values land in `.vscode/settings.json` and override both workspace-level and user-level settings.

### Internal

- Added `FolderCandidates` type and `MapWorkspaceMessage` / `RemapWorkspaceMessage` to the shared message contract.
- Added `_detectFolderCandidates()` to `BrainProvider` — reads configured paths, falls back to scanning for legacy layout folders (`__inbox`, `diary`, `sprints`, `tech-debt`, `.agents`).
- All `initState` messages now carry `folderCandidates`.

---

## [0.1.6] - 2026-05-11

### Fixes

- Workspace paths were not refreshed in the webview after a path update — `_pushWorkspacePaths()` is now called before `_pushData()` in the `updateWorkspacePath` handler.

---

## [0.1.0] - 2026-04-29

### Features

- Initial release: developer diary, sprint planner, story map, tech debt tracker, and agents view inside VS Code.
