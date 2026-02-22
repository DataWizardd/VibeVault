# Changelog

All notable changes to VibeVault are documented here.

## [0.1.2] - 2025-02-23
- Fix: GitHub PAT pattern relaxed from `{36}` to `{35,}` to match all token lengths

## [0.1.1] - 2025-02-19
- Fix: Keys on lines below `os.getenv()` were incorrectly suppressed — `isAlreadySafe` now scoped to current line only
- Fix: Anthropic keys were double-flagged by the OpenAI pattern — added negative lookahead `(?!ant-)`
- Fix: Variable name mismatch between `.env` and code when a naming conflict occurred
- Fix: Duplicate detection in `.env` changed from substring to exact line match
- Feature: Python `import os` auto-inserted as part of the same undoable action
- Feature: Go `import "os"` advisory message
- Improvement: `inferEnvVarName` correctly handles keyword arguments (`OpenAI(api_key="...")`)
- Improvement: 500ms debounce reduces CPU usage during active typing

## [0.1.0] - 2025-02-16
- Expanded detection from 1 to 9 patterns (Anthropic, AWS, Google, GitHub, Stripe, HuggingFace, Generic)
- Fixed quote-inclusive code replacement
- Added status bar security indicator
- Added workspace scan command
- Added smart variable name inference
- Added startup `.gitignore` validation
- Added language-specific env var syntax for 7 languages (Python, JS/TS, Go, Ruby, Java, C#, Rust)

## [0.0.1] - 2025-02-16
- Initial release: OpenAI `sk-` pattern detection and one-click `.env` migration
