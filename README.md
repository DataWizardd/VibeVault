# VibeGuard

<div align="center">

![VibeGuard](vibeguard_icon.png)

**Real-time API key leak prevention for Vibe Coding environments.**
Detects hardcoded secrets the moment you type — and fixes them in one click.

[![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.90.0-blue?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=vibeguard.vibeguard)
[![Version](https://img.shields.io/badge/version-0.1.2-green)](https://github.com/vibeguard/vibeguard/releases)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

**[한국어](README.ko.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [Español](README.es.md)**

</div>

---

## Why VibeGuard?

The rise of AI coding assistants — ChatGPT, Claude, Cursor, Copilot — has dramatically lowered the barrier to shipping software. A developer with minimal experience can now deploy a live web service in hours.

But speed without guardrails creates a structural security gap:

```
AI coding assistant
  └─ Prioritizes working code → embeds API keys directly in source
        ↓
Non-expert developer
  └─ "If AI wrote it, it must be safe" — blind trust in generated code
        ↓
Public GitHub push
  └─ Exposed API key → financial loss / service abuse / account compromise
```

Sites like [apiradar.live](https://apiradar.live) aggregate API key leaks from public repositories **in real time** — the vast majority originating from AI-assisted projects. This is no longer an edge case.

**VibeGuard intercepts this problem at the IDE level.**
Before the code hits Git, VibeGuard detects exposed secrets and guides you to fix them automatically.

---

## Features

### 1. Real-time Detection (9 Service Patterns)

Scanning triggers within 500ms of typing, covering the most common services used in AI-generated code.

| Service | Pattern | Severity |
|---|---|---|
| OpenAI | `sk-...`, `sk-proj-...` | Error |
| Anthropic | `sk-ant-...` | Error |
| AWS | `AKIA...` (16+ chars) | Error |
| Google Cloud | `AIza...` (35+ chars) | Error |
| GitHub | `ghp_...`, `github_pat_...` | Error |
| Stripe | `sk_live_...` | Error |
| Stripe (public key) | `pk_live_...` | Warning |
| Hugging Face | `hf_...` | Error |
| **Generic** | `api_key = "..."`, `secret = "..."` assignments | Warning |

### 2. One-click Auto-fix (QuickFix)

Press `Ctrl+.` (Mac: `Cmd+.`) on any flagged secret → select **"VibeGuard: Move to .env"**

What happens automatically:
- **Precise replacement including surrounding quotes**: `"sk-abc..."` → `process.env.OPENAI_API_KEY`
- **Language-appropriate syntax** with auto-inserted imports:

  ```python
  # Python — `import os` inserted if missing
  import os                            # ← auto-inserted
  api_key = os.getenv("OPENAI_API_KEY")
  ```
  ```javascript
  // JavaScript / TypeScript
  const apiKey = process.env.OPENAI_API_KEY;
  ```
  ```go
  // Go
  apiKey := os.Getenv("OPENAI_API_KEY")
  ```
  ```ruby
  # Ruby
  api_key = ENV['OPENAI_API_KEY']
  ```
  ```java
  // Java
  String apiKey = System.getenv("OPENAI_API_KEY");
  ```
  ```csharp
  // C#
  var apiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY");
  ```
  ```rust
  // Rust
  let api_key = std::env::var("OPENAI_API_KEY").unwrap();
  ```

- **Auto-writes `.env`** — creates the file if it doesn't exist
- **Auto-updates `.gitignore`** — adds `.env` entry if absent

### 3. Smart Variable Name Inference

VibeGuard analyzes the surrounding code to suggest a meaningful variable name.

```python
my_openai_key = "sk-proj-abc..."
# Suggested: MY_OPENAI_KEY

client = OpenAI(api_key="sk-proj-abc...")
# Suggested: API_KEY  (inferred from `api_key`, not `client`)
```

### 4. Security Status Bar

Live security indicator in the VS Code status bar (bottom-right):

```
$(shield) VibeGuard              ← All clear
$(shield) VibeGuard: 3 issues   ← Warning (amber background)
```

Click to trigger a full workspace scan.

### 5. Workspace-wide Scan

`Ctrl+Shift+P` → **"VibeGuard: Scan Workspace for Secrets"**

- Automatically excludes `node_modules`, `dist`, `build`, `.git`, lock files
- Progress indicator with cancellation support
- Summary notification on completion

### 6. Startup `.gitignore` Check

On workspace open, if a `.env` file exists but is not listed in `.gitignore`, VibeGuard immediately warns you and offers to add it.

---

## Installation

### From VS Code Marketplace

Search **"VibeGuard"** in the Extensions panel (`Ctrl+Shift+X`) and click **Install**.

### Manual (VSIX)

```bash
code --install-extension vibeguard-0.1.2.vsix
```

---

## Usage

1. Open your project folder in VS Code.
2. Paste or write AI-generated code containing API keys.
3. Red/yellow underlines appear on hardcoded secrets within 500ms.
4. Press `Ctrl+.` → select **"VibeGuard: Move to .env"**.
5. Confirm the suggested variable name → press Enter.
6. Done. The key is written to `.env` and the code is updated to a safe reference.

---

## Configuration

| Setting | Type | Default | Description |
|---|---|---|---|
| `vibeguard.enable` | boolean | `true` | Enable or disable secret scanning |
| `vibeguard.confirmVariableName` | boolean | `true` | Show input box to confirm variable name before writing |

---

## Design Principles

**No network calls.** All detection runs locally via regex. Your code never leaves your machine. Works offline.

**Minimal false positives.** Lines that already use `process.env.KEY`, `os.getenv(...)`, `ENV[...]` etc. are skipped. Safe references on *other* lines do not suppress detection on the current line.

**Non-destructive edits.** All changes go through VS Code's `WorkspaceEdit` API — fully undoable with a single `Ctrl+Z`, including auto-inserted imports.

---

## Roadmap

- Git pre-commit hook integration — block commits containing raw secrets
- Auto-generate `.env.example` for team onboarding
- Entropy-based detection — catch high-entropy strings beyond known patterns
- CI/CD integration — apply the same rules in GitHub Actions pipelines

---

## Release Notes

### 0.1.2
- Fix: GitHub PAT pattern relaxed from `{36}` to `{35,}` to match all token lengths

### 0.1.1
- Fix: Keys on lines below a `os.getenv()` call were incorrectly suppressed — `isAlreadySafe` now scoped to current line only
- Fix: Anthropic keys were being double-flagged by the OpenAI pattern — added negative lookahead `(?!ant-)`
- Fix: Variable name mismatch between `.env` entry and code replacement when a naming conflict occurred
- Fix: Duplicate detection in `.env` changed from substring match to exact line match
- Feature: Python `import os` auto-inserted as part of the same undoable action
- Feature: Go `import "os"` advisory message
- Improvement: `inferEnvVarName` correctly handles keyword arguments (`OpenAI(api_key="...")`)
- Improvement: 500ms debounce reduces CPU usage during active typing

### 0.1.0
- Expanded from 1 to 9 detection patterns (Anthropic, AWS, Google, GitHub, Stripe, HuggingFace, Generic)
- Fixed quote-inclusive code replacement
- Added status bar security indicator
- Added workspace scan command
- Added smart variable name inference
- Added startup `.gitignore` validation
- Added language-specific env var reference syntax for 7 languages

### 0.0.1
- Initial release: OpenAI `sk-` pattern detection and `.env` migration
