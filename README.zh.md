# VibeVault

<div align="center">

![VibeVault](vibevault_icon.png)

**为 Vibe Coding 环境打造的实时 API 密钥泄露防护扩展。**
在您输入代码的瞬间检测硬编码的密钥，并支持一键自动修复。

[![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.90.0-blue?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=vibevault.vibevault)
[![Version](https://img.shields.io/badge/version-0.1.2-green)](https://github.com/vibevault/vibevault/releases)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

**[English](README.md) · [한국어](README.ko.md) · [日本語](README.ja.md) · [Español](README.es.md)**

</div>

---

## 为什么需要 VibeVault？

随着 ChatGPT、Claude、Cursor、Copilot 等 AI 编程助手的普及，即使是经验不足的开发者也能在数小时内上线一个 Web 服务。

然而，这种以速度为先的开发方式造成了结构性的安全漏洞：

```
AI 编程助手
  └─ 优先生成可运行代码 → 将 API 密钥直接写入源代码
        ↓
缺乏经验的开发者
  └─ "AI 写的代码应该是安全的" — 盲目信任生成代码
        ↓
推送到公开 GitHub 仓库
  └─ API 密钥泄露 → 经济损失 / 服务滥用 / 账号被盗
```

[apiradar.live](https://apiradar.live) 等监控网站**实时**汇总来自公开仓库的 API 密钥泄露事件，其中绝大多数来自 AI 辅助项目。这已不再是小概率事件。

**VibeVault 在 IDE 层面拦截这一问题。**
在代码提交到 Git 之前，自动检测并修复暴露的密钥。

---

## 核心功能

### 1. 实时检测（9 种服务模式）

输入后 500ms 内触发扫描，覆盖 AI 生成代码中最常用的服务。

| 服务 | 模式 | 严重级别 |
|---|---|---|
| OpenAI | `sk-...`, `sk-proj-...` | 错误 |
| Anthropic | `sk-ant-...` | 错误 |
| AWS | `AKIA...`（16位以上）| 错误 |
| Google Cloud | `AIza...`（35位以上）| 错误 |
| GitHub | `ghp_...`, `github_pat_...` | 错误 |
| Stripe | `sk_live_...` | 错误 |
| Stripe（公钥）| `pk_live_...` | 警告 |
| Hugging Face | `hf_...` | 错误 |
| **通用模式** | `api_key = "..."`, `secret = "..."` 等变量赋值 | 警告 |

### 2. 一键自动修复（QuickFix）

在检测到的密钥处按 `Ctrl+.`（Mac：`Cmd+.`）→ 选择 **"VibeVault: Move to .env"**

自动处理内容：
- **精确替换（含引号）**：`"sk-abc..."` → `process.env.OPENAI_API_KEY`
- **语言适配语法 + 自动插入 import**：

  ```python
  # Python — 自动添加缺失的 import os
  import os                            # ← 自动插入
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

- **自动写入 `.env`** — 文件不存在时自动创建
- **自动更新 `.gitignore`** — 若无 `.env` 条目则立即添加

### 3. 智能变量名推断

分析周围代码上下文，自动建议有意义的变量名。

```python
my_openai_key = "sk-proj-abc..."
# 建议：MY_OPENAI_KEY

client = OpenAI(api_key="sk-proj-abc...")
# 建议：API_KEY（基于 api_key，而非 client）
```

### 4. 状态栏安全指示器

在 VS Code 右下角状态栏实时显示当前安全状态：

```
$(shield) VibeVault              ← 无问题（正常）
$(shield) VibeVault: 3 issues   ← 警告（橙色背景）
```

点击即可触发全工作区扫描。

### 5. 全工作区扫描

`Ctrl+Shift+P` → **"VibeVault: Scan Workspace for Secrets"**

- 自动排除 `node_modules`、`dist`、`build`、`.git`、锁文件
- 支持进度显示与取消
- 扫描完成后显示摘要通知

### 6. 启动时 `.gitignore` 自动检查

打开工作区时，若存在 `.env` 文件但未在 `.gitignore` 中列出，VibeVault 会立即发出警告并提供自动添加选项。

---

## 安装

### VS Code 扩展市场

在扩展面板（`Ctrl+Shift+X`）搜索 **"VibeVault"** 并点击 **安装**。

### 手动安装（VSIX）

```bash
code --install-extension vibevault-0.1.2.vsix
```

---

## 使用方法

1. 在 VS Code 中打开项目文件夹。
2. 粘贴或编写包含 API 密钥的 AI 生成代码。
3. 硬编码的密钥在 500ms 内出现红/黄色下划线。
4. 按 `Ctrl+.` → 选择 **"VibeVault: Move to .env"**。
5. 确认建议的变量名 → 按 Enter。
6. 完成。密钥已写入 `.env`，代码已替换为安全引用。

---

## 配置项

| 设置项 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `vibevault.enable` | boolean | `true` | 启用/禁用密钥扫描 |
| `vibevault.confirmVariableName` | boolean | `true` | 写入前显示变量名确认输入框 |

---

## 设计原则

**无网络请求。** 所有检测均在本地通过正则表达式完成，代码不会离开您的设备，离线环境同样可用。

**最小化误报。** 已使用 `process.env.KEY`、`os.getenv(...)`、`ENV[...]` 等安全引用的行会被跳过。其他行的安全引用不会影响当前行的检测。

**非破坏性修改。** 所有代码修改均通过 VS Code `WorkspaceEdit` API 执行，支持单次 `Ctrl+Z` 撤销全部更改（含自动插入的 import）。

---

## 未来规划

- Git pre-commit hook 集成 — 自动阻止包含原始密钥的提交
- 自动生成 `.env.example` — 团队协作示例文件管理
- 基于熵值的检测 — 捕获已知模式之外的高熵字符串
- CI/CD 流水线集成 — 在 GitHub Actions 中应用相同规则
