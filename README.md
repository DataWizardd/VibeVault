# VibeGuard

**VibeGuard** is a security-focused VS Code extension that helps developers prevent API key leakage. 

It real-time scans your code for hardcoded API keys (specifically OpenAI `sk-` pattern) and provides a **Quick Fix** to instantly move them to a `.env` file and replace the code with an environment variable reference.

## Features

- 🚀 **Real-time Detection**: Instantly highlights `sk-` and `sk-proj-` patterns in your code.
- 🛠️ **Quick Fix**: Click "Move to .env" or use `Ctrl+.` (Cmd+.) to fix it.
- ⚡ **Auto-configuration**: 
    - Creates `.env` if it doesn't exist.
    - Appends the key safely.
    - Replaces code with language-specific syntax:
        - Python: `os.getenv("OPENAI_API_KEY")`
        - Node.js: `process.env.OPENAI_API_KEY`
        - Go: `os.Getenv("OPENAI_API_KEY")`
        - PHP: `getenv('OPENAI_API_KEY')`

## Extension Settings

This extension contributes the following settings:

* `vibeguard.enable`: Enable/disable VibeGuard scanning. (Default: `true`)
* `vibeguard.variableName`: The environment variable name to use. (Default: `OPENAI_API_KEY`)

## Usage

1. Open any file.
2. Type or paste an OpenAI API Key (e.g., `sk-proj-xyz...`).
3. VibeGuard will underline it with a warning.
4. Hover over the warning and click "Move to .env".
5. Done! The key is safe in `.env` and your code is clean.

## Release Notes

### 0.0.1
- Initial release of VibeGuard.
