# VibeGuard

<div align="center">

![VibeGuard](vibeguard_icon.png)

**バイブコーディング環境向けのリアルタイム API キー漏洩防止拡張機能。**
入力した瞬間にハードコードされたシークレットを検出し、ワンクリックで修正します。

[![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.90.0-blue?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=vibeguard.vibeguard)
[![Version](https://img.shields.io/badge/version-0.1.2-green)](https://github.com/vibeguard/vibeguard/releases)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

**[English](README.md) · [한국어](README.ko.md) · [中文](README.zh.md) · [Español](README.es.md)**

</div>

---

## なぜ VibeGuard が必要か？

ChatGPT、Claude、Cursor、Copilot などの AI コーディングアシスタントの普及により、経験の少ない開発者でも数時間でサービスをデプロイできるようになりました。

しかし、このスピード優先の開発手法は構造的なセキュリティ上の問題を生み出しています。

```
AI コーディングアシスタント
  └─ 動作するコードを最優先 → API キーをソースコードに直接埋め込む
        ↓
経験の浅い開発者
  └─ 「AI が書いたコードは安全なはず」という盲目的な信頼
        ↓
GitHub パブリックリポジトリにプッシュ
  └─ API キー漏洩 → 金銭的損害 / サービス悪用 / アカウント乗っ取り
```

[apiradar.live](https://apiradar.live) のようなモニタリングサイトでは、公開リポジトリからの API キー漏洩が**リアルタイム**で集計されており、その大多数が AI 支援プロジェクトによるものです。これはもはや例外的な事象ではありません。

**VibeGuard はこの問題を IDE レベルで遮断します。**
コードが Git にプッシュされる前に、シークレットを検出して安全に修正します。

---

## 主な機能

### 1. リアルタイム検出（9 つのサービスパターン）

入力から 500ms 以内にスキャンが実行され、AI 生成コードでよく使用されるサービスを網羅します。

| サービス | パターン | 重大度 |
|---|---|---|
| OpenAI | `sk-...`, `sk-proj-...` | エラー |
| Anthropic | `sk-ant-...` | エラー |
| AWS | `AKIA...`（16文字以上）| エラー |
| Google Cloud | `AIza...`（35文字以上）| エラー |
| GitHub | `ghp_...`, `github_pat_...` | エラー |
| Stripe | `sk_live_...` | エラー |
| Stripe（公開キー）| `pk_live_...` | 警告 |
| Hugging Face | `hf_...` | エラー |
| **汎用パターン** | `api_key = "..."`, `secret = "..."` などの変数代入 | 警告 |

### 2. ワンクリック自動修正（QuickFix）

検出されたシークレット上で `Ctrl+.`（Mac: `Cmd+.`）→ **"VibeGuard: Move to .env"** を選択

自動処理される内容：
- **引用符を含む正確な置換**：`"sk-abc..."` → `process.env.OPENAI_API_KEY`
- **言語に適したシンタックス + import の自動挿入**：

  ```python
  # Python — import os がなければ自動追加
  import os                            # ← 自動挿入
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

- **`.env` への自動書き込み** — ファイルがなければ新規作成
- **`.gitignore` の自動更新** — `.env` エントリがなければ即時追加

### 3. スマートな変数名推論

周囲のコードコンテキストを解析し、意味のある変数名を自動提案します。

```python
my_openai_key = "sk-proj-abc..."
# 提案: MY_OPENAI_KEY

client = OpenAI(api_key="sk-proj-abc...")
# 提案: API_KEY（client ではなく api_key を基準に推論）
```

### 4. ステータスバーセキュリティインジケーター

VS Code 右下のステータスバーに現在のセキュリティ状態をリアルタイム表示：

```
$(shield) VibeGuard              ← 問題なし（正常）
$(shield) VibeGuard: 3 issues   ← 警告（橙色背景）
```

クリックするとワークスペース全体のスキャンが実行されます。

### 5. ワークスペース全体スキャン

`Ctrl+Shift+P` → **"VibeGuard: Scan Workspace for Secrets"**

- `node_modules`、`dist`、`build`、`.git`、ロックファイルを自動除外
- 進行状況の表示とキャンセルに対応
- スキャン完了後に検出件数のサマリーを通知

### 6. 起動時の `.gitignore` 自動チェック

ワークスペースを開いたとき、`.env` ファイルが存在しているにもかかわらず `.gitignore` に記載されていない場合、即座に警告を表示し自動追加を提案します。

---

## インストール

### VS Code マーケットプレイス

拡張機能パネル（`Ctrl+Shift+X`）で **"VibeGuard"** を検索して **インストール** をクリック。

### 手動インストール（VSIX）

```bash
code --install-extension vibeguard-0.1.2.vsix
```

---

## 使い方

1. VS Code でプロジェクトフォルダーを開きます。
2. AI が生成したコードを貼り付けるか、直接入力します。
3. ハードコードされたキーが 500ms 以内に赤/黄色の下線で強調表示されます。
4. `Ctrl+.` → **"VibeGuard: Move to .env"** を選択。
5. 提案された変数名を確認 → Enter。
6. 完了。キーは `.env` に保存され、コードは安全な参照に置換されます。

---

## 設定項目

| 設定 | 型 | デフォルト | 説明 |
|---|---|---|---|
| `vibeguard.enable` | boolean | `true` | シークレットスキャンの有効/無効 |
| `vibeguard.confirmVariableName` | boolean | `true` | 書き込み前に変数名確認ダイアログを表示 |

---

## 設計方針

**外部通信なし。** すべての検出はローカルの正規表現で実行されます。コードが外部に送信されることはなく、オフライン環境でも動作します。

**誤検知を最小化。** `process.env.KEY`、`os.getenv(...)`、`ENV[...]` などの安全な参照がある行はスキップされます。ただし、別の行の安全な参照が現在行の検出に影響することはありません。

**非破壊的な修正。** すべてのコード変更は VS Code の `WorkspaceEdit` API 経由で実行されるため、`Ctrl+Z` 一回で全体を元に戻せます（import の自動挿入も含む）。

---

## ロードマップ

- Git pre-commit フック統合 — 生のシークレットを含むコミットを自動ブロック
- `.env.example` の自動生成 — チームオンボーディング用サンプルファイル管理
- エントロピーベースの検出 — 既知パターン以外の高エントロピー文字列を検出
- CI/CD パイプライン統合 — GitHub Actions で同じルールを適用
