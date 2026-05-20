# MindMapper

AI mind-map generator on top of OpenRouter. Type a topic, get an editable
interactive tree; click any node to expand it further with the LLM of your
choice; export to SVG or PNG.

Built with Tauri 2 + React 19 + d3-hierarchy.

## Install

Grab the latest `MindMapper_<version>_x64-setup.exe` from the
[Releases](https://github.com/reflaxess123/mapper/releases) page and run it.
Per-user install (no admin needed). Windows 10/11 x64.

You'll need an **OpenRouter API key** (paste it in the sidebar after launch
— get one at [openrouter.ai](https://openrouter.ai)).

## Develop

```bash
npm install
npm run tauri dev
```

## Build the installer locally

```powershell
.\scripts\build-installer.ps1
```

The .exe lands in `src-tauri/target/release/bundle/nsis/`.

## Release

```bash
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions builds the NSIS installer and attaches it to a new
Release automatically.
