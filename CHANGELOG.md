# Changelog

All notable changes to Mandala are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.1](https://github.com/eatsleepcode-dev/Mandala/compare/mandala-v0.2.0...mandala-v0.2.1) (2026-05-15)


### Features

* add configurable workspace paths (inbox/diary) in Settings UI with multi-root support ([2f14f42](https://github.com/eatsleepcode-dev/Mandala/commit/2f14f427fb46d0e0d7bbfad2dccde22cd1404124))
* add fabric-thermostat-check agent workflow and claude command ([c39c440](https://github.com/eatsleepcode-dev/Mandala/commit/c39c44099fc7b5c93601dc0aabfdb040bef99259))
* add reinitialize workspace button in settings ([fb96492](https://github.com/eatsleepcode-dev/Mandala/commit/fb96492cb30f39f982b81e8ede37a864a965dfca))
* add welcome screen and configurable paths for sprints, tech-debt, and agents ([930091a](https://github.com/eatsleepcode-dev/Mandala/commit/930091abbc42176c167bf940f3bda67d77cd2194))
* enhance dashboard UX and sync repo assets ([25dd238](https://github.com/eatsleepcode-dev/Mandala/commit/25dd238d1d24ab8bdf02f2b4d84dc99a35700946))
* Fabric Thermostat stability and UI expansion [skip ci] ([6e833b8](https://github.com/eatsleepcode-dev/Mandala/commit/6e833b88c0e079534948b0201b8421066d56ca04))
* folder mapping wizard, publisher rename to eatsleepcode-dev, release please CI/CD setup ([9bc8201](https://github.com/eatsleepcode-dev/Mandala/commit/9bc82013f6f419032a8db9920001555b97eee478))
* implement non-blocking azure discovery for thermostat and add bottom save button ([2431ddb](https://github.com/eatsleepcode-dev/Mandala/commit/2431ddbea0c43c5e7083ced86e56e507dd4a9e1a))
* layout overhaul — topbar, status bar, story map, and missing CSS ([1754fa4](https://github.com/eatsleepcode-dev/Mandala/commit/1754fa4512c15a53dcc7a228c700edaf3592d746))
* migrate to Sidebar-based architecture and integrate native VS Code settings ([fabc350](https://github.com/eatsleepcode-dev/Mandala/commit/fabc35003435d5837c6ed4f8a39cace4ccebac41))
* reorder settings UI and filter inbox for valid task cards ([c44400f](https://github.com/eatsleepcode-dev/Mandala/commit/c44400fd2b00844c1f10e507539dc39e78598924))
* search bar, blue status bar, activity-meta tags (TDD) ([c1447e2](https://github.com/eatsleepcode-dev/Mandala/commit/c1447e2d6d6c29b4221bc3d501fbf648fa6e67f6))
* severity sort, inbox score, diary tech-debt filter (TDD) ([2cd9329](https://github.com/eatsleepcode-dev/Mandala/commit/2cd93292961f3938f8c5e7a3b61c7ccf25c8b11e))
* sprint date range in story map; CardDetailPanel (TDD) ([e75647d](https://github.com/eatsleepcode-dev/Mandala/commit/e75647d4bd95d92e13e8a27484821b2d6472d962))
* **thermostat:** add capacity name to weekly schedule header ([6a5bf4a](https://github.com/eatsleepcode-dev/Mandala/commit/6a5bf4a8e6bc66a80d92456e355dc07f1063384e))
* **webview:** move Inbox to the top of the sidebar navigation ([14ac21f](https://github.com/eatsleepcode-dev/Mandala/commit/14ac21f8fd3424cb5bc3ca855a7a590b3dc3aa64))


### Bug Fixes

* address Copilot PR review comments ([0b83c78](https://github.com/eatsleepcode-dev/Mandala/commit/0b83c78ccab3bf6f8fe297274bb80696e0ee8727))
* **thermostat:** align CapacityConfig.id with remote API to resolve 404 trigger errors and implement proxy architecture ([2fb80a4](https://github.com/eatsleepcode-dev/Mandala/commit/2fb80a407b68992242d5b902f5cba61ce564308d))
* upgrade [@typescript-eslint](https://github.com/typescript-eslint) to v8 to resolve ESLint 9 peer conflict ([53bf6da](https://github.com/eatsleepcode-dev/Mandala/commit/53bf6da5076782159954f9ebe15c6dd70cf51299))
* **webview:** resolve data drop race condition during boot and reorder settings ([d2e3b39](https://github.com/eatsleepcode-dev/Mandala/commit/d2e3b39293acd5bdff12b205b140a3bb835e6c65))

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
