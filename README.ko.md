# VibeVault

<div align="center">

![VibeVault](vibevault_icon.png)

**바이브 코딩 환경을 위한 실시간 API 키 유출 방지 확장프로그램.**
입력하는 순간 하드코딩된 시크릿을 탐지하고 원클릭으로 수정합니다.

[![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.90.0-blue?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=vibevault.vibevault)
[![Version](https://img.shields.io/badge/version-0.1.3-green)](https://github.com/DataWizardd/VibeVault/releases)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

**[English](README.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [Español](README.es.md)**

</div>

---

## 왜 VibeVault가 필요한가?

ChatGPT, Claude, Cursor, Copilot 같은 AI 코딩 어시스턴트의 대중화로 경험이 부족한 개발자도 수 시간 만에 라이브 서비스를 배포할 수 있게 되었습니다.

그러나 이 속도 중심의 개발 방식은 구조적인 보안 공백을 만들어냅니다.

```
AI 코딩 어시스턴트
  └─ 동작하는 코드 최우선 → API 키를 소스에 직접 삽입
        ↓
비숙련 개발자
  └─ "AI가 짜준 코드는 안전하다"는 맹목적 신뢰
        ↓
GitHub 공개 배포
  └─ API 키 노출 → 금전적 손실 / 서비스 악용 / 계정 탈취
```

[apiradar.live](https://apiradar.live) 같은 모니터링 사이트에서는 공개 저장소의 API 키 유출이 **실시간**으로 집계됩니다. 그 대부분이 AI 지원 프로젝트에서 발생하고 있습니다. 더 이상 예외적인 상황이 아닙니다.

**VibeVault는 이 문제를 IDE 레벨에서 차단합니다.**
코드가 Git에 올라가기 전에, 시크릿을 감지하고 안전하게 수정합니다.

---

## 주요 기능

### 1. 실시간 탐지 (9가지 서비스 패턴)

타이핑 후 500ms 이내에 스캔이 실행되며, AI 생성 코드에서 가장 많이 사용되는 서비스를 커버합니다.

| 서비스 | 패턴 | 심각도 |
|---|---|---|
| OpenAI | `sk-...`, `sk-proj-...` | 오류 |
| Anthropic | `sk-ant-...` | 오류 |
| AWS | `AKIA...` (16자 이상) | 오류 |
| Google Cloud | `AIza...` (35자 이상) | 오류 |
| GitHub | `ghp_...`, `github_pat_...` | 오류 |
| Stripe | `sk_live_...` | 오류 |
| Stripe (공개키) | `pk_live_...` | 경고 |
| Hugging Face | `hf_...` | 오류 |
| **제네릭** | `api_key = "..."`, `secret = "..."` 형태의 변수 할당 | 경고 |

### 2. 원클릭 자동 수정 (QuickFix)

감지된 시크릿 위에서 `Ctrl+.` (Mac: `Cmd+.`) → **"VibeVault: Move to .env"** 선택

자동으로 처리되는 사항:
- **따옴표를 포함한 정확한 교체**: `"sk-abc..."` → `process.env.OPENAI_API_KEY`
- **언어별 맞춤 문법 + 필요한 import 자동 삽입**:

  ```python
  # Python — import os 없으면 자동 추가
  import os                           # ← 자동 삽입
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

- **`.env` 파일 자동 저장** — 파일이 없으면 새로 생성
- **`.gitignore` 자동 업데이트** — `.env` 항목이 없으면 즉시 추가

### 3. 스마트 변수명 추론

주변 코드 컨텍스트를 분석해 의미 있는 변수명을 자동 제안합니다.

```python
my_openai_key = "sk-proj-abc..."
# 제안: MY_OPENAI_KEY

client = OpenAI(api_key="sk-proj-abc...")
# 제안: API_KEY  (client가 아닌 api_key 기준으로 추론)
```

### 4. 상태바 보안 지표

VS Code 우측 하단에 실시간 보안 상태를 표시합니다.

```
$(shield) VibeVault              ← 이슈 없음 (정상)
$(shield) VibeVault: 3 issues   ← 경고 (주황색 배경)
```

클릭하면 전체 워크스페이스 스캔을 실행합니다.

### 5. 워크스페이스 전체 스캔

`Ctrl+Shift+P` → **"VibeVault: Scan Workspace for Secrets"**

- `node_modules`, `dist`, `build`, `.git`, 락 파일 자동 제외
- 진행률 표시 및 취소 가능
- 스캔 완료 후 발견 이슈 수 요약 알림

### 6. 시작 시 `.gitignore` 자동 검사

워크스페이스 열 때 `.env` 파일이 존재하지만 `.gitignore`에 없으면 즉시 경고하고 자동 추가를 제안합니다.

---

## 설치

### VS Code 마켓플레이스

확장 패널(`Ctrl+Shift+X`)에서 **"VibeVault"** 검색 후 **설치** 클릭.

### 수동 설치 (VSIX)

```bash
code --install-extension vibevault-0.1.3.vsix
```

---

## 사용법

1. VS Code에서 프로젝트 폴더를 엽니다.
2. AI가 생성한 코드를 붙여넣거나 작성합니다.
3. 하드코딩된 키가 감지되면 500ms 이내에 빨간/노란 밑줄이 표시됩니다.
4. `Ctrl+.` → **"VibeVault: Move to .env"** 선택.
5. 제안된 변수명 확인 → Enter.
6. 완료. 키는 `.env`에 저장되고 코드는 안전한 참조로 교체됩니다.

---

## 설정

| 설정 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `vibevault.enable` | boolean | `true` | 시크릿 스캔 활성화/비활성화 |
| `vibevault.confirmVariableName` | boolean | `true` | 저장 전 변수명 확인 입력창 표시 여부 |

---

## 설계 원칙

**외부 통신 없음.** 모든 탐지는 로컬 정규식으로 수행됩니다. 코드가 외부로 전송되지 않으며 오프라인에서도 동작합니다.

**오탐 최소화.** `process.env.KEY`, `os.getenv(...)`, `ENV[...]` 등 이미 안전한 참조가 있는 줄은 탐지에서 제외됩니다. 단, 다른 줄의 안전 참조가 현재 줄 탐지에 영향을 주지 않습니다.

**비파괴적 수정.** 모든 코드 수정은 VS Code `WorkspaceEdit` API를 통해 실행되므로 `Ctrl+Z` 단 한 번으로 전체 되돌리기가 가능합니다.

---

## 향후 발전 방향

- Git pre-commit hook 연동 — 시크릿이 포함된 커밋 자동 차단
- `.env.example` 자동 생성 — 팀 온보딩을 위한 예시 파일 관리
- 엔트로피 기반 탐지 — 알려진 패턴 외의 고엔트로피 문자열 감지
- CI/CD 파이프라인 연동 — GitHub Actions에서 동일한 규칙 적용
