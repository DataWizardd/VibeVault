# VS Code 확장프로그램 마켓플레이스 배포 가이드

> VibeGuard 기준으로 작성된 실전 가이드입니다.

---

## 목차

1. [사전 준비](#1-사전-준비)
2. [Azure DevOps 조직 생성](#2-azure-devops-조직-생성)
3. [Personal Access Token (PAT) 발급](#3-personal-access-token-pat-발급)
4. [Visual Studio Marketplace 퍼블리셔 등록](#4-visual-studio-marketplace-퍼블리셔-등록)
5. [package.json 배포 필수 설정](#5-packagejson-배포-필수-설정)
6. [vsce 설치 및 패키징](#6-vsce-설치-및-패키징)
7. [마켓플레이스 배포](#7-마켓플레이스-배포)
8. [배포 후 확인](#8-배포-후-확인)
9. [버전 업데이트 (이후 릴리즈)](#9-버전-업데이트-이후-릴리즈)
10. [배포 체크리스트](#10-배포-체크리스트)

---

## 1. 사전 준비

### 필요한 것

- Node.js 18 이상
- Git
- Microsoft 계정 (Azure DevOps 용)
- VS Code Extension 프로젝트 (`package.json` 포함)

### 필수 패키지 설치

```bash
npm install -g @vscode/vsce
```

---

## 2. Azure DevOps 조직 생성

`vsce`로 마켓플레이스에 배포하려면 Azure DevOps 조직이 필요합니다.

1. [https://dev.azure.com](https://dev.azure.com) 접속
2. Microsoft 계정으로 로그인
3. **"New organization"** 클릭 → 조직 이름 입력 (예: `vibeguard`)
4. 조직 생성 완료

---

## 3. Personal Access Token (PAT) 발급

1. Azure DevOps 우측 상단 프로필 아이콘 → **"Personal access tokens"**
2. **"+ New Token"** 클릭
3. 다음과 같이 설정:
   - **Name**: `vsce-publish` (원하는 이름)
   - **Organization**: `All accessible organizations`
   - **Expiration**: 원하는 만료일 설정 (최대 1년)
   - **Scopes**: `Custom defined` 선택 후 **Marketplace → Manage** 체크
4. **"Create"** 클릭 → 생성된 토큰 값을 복사해 안전한 곳에 보관

> **주의**: 토큰은 생성 직후 한 번만 표시됩니다. 반드시 복사해두세요.

---

## 4. Visual Studio Marketplace 퍼블리셔 등록

1. [https://marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage) 접속
2. Microsoft 계정으로 로그인
3. **"Create publisher"** 클릭
4. 다음 항목 입력:
   - **Publisher ID** (고유 식별자, 변경 불가): 예) `vibeguard`
   - **Display name**: 예) `VibeGuard`
5. 생성 완료

> `package.json`의 `"publisher"` 필드 값이 이 **Publisher ID** 와 일치해야 합니다.

---

## 5. package.json 배포 필수 설정

배포 전 `package.json`에 아래 필드가 모두 설정되어 있어야 합니다.

```json
{
  "name": "vibeguard",
  "displayName": "VibeGuard",
  "description": "Real-time secret & API key protection for Vibe Coding.",
  "version": "0.1.2",
  "publisher": "vibeguard",
  "engines": {
    "vscode": "^1.90.0"
  },
  "categories": ["Other", "Linters"],
  "icon": "vibeguard.jpeg",
  "repository": {
    "type": "git",
    "url": "https://github.com/vibeguard/vibeguard"
  },
  "license": "MIT"
}
```

### 아이콘 규격

- 형식: PNG 또는 JPEG
- 권장 크기: **128×128px** 또는 **256×256px**
- `package.json`의 `"icon"` 필드에 파일 경로 입력
- `.vscodeignore`에서 **제외하지 않아야** 합니다

### .vscodeignore 설정

배포 패키지에서 불필요한 파일을 제외합니다.

```
.vscode/**
node_modules/**
src/**
.gitignore
**/*.map
**/*.ts
test.*
.claude/**
.env
.env.*
```

---

## 6. vsce 설치 및 패키징

### 컴파일

```bash
npm run compile
```

### VSIX 패키지 생성

```bash
vsce package
# 결과: vibeguard-0.1.2.vsix
```

의존성이 없는 경우 (확장프로그램에 외부 npm 패키지 없을 때):

```bash
vsce package --no-dependencies
```

### 패키지 내용 미리 확인

```bash
vsce ls
```

`.env`, `.claude`, `node_modules` 등이 포함되지 않았는지 확인합니다.

---

## 7. 마켓플레이스 배포

### 방법 1: 커맨드라인 배포 (권장)

```bash
vsce publish
```

PAT 입력 프롬프트가 나오면 [3단계](#3-personal-access-token-pat-발급)에서 발급한 토큰을 입력합니다.

PAT를 미리 저장해두려면:

```bash
vsce login vibeguard
# 퍼블리셔 이름 입력 후 PAT 입력
vsce publish
```

### 방법 2: VSIX 파일 직접 업로드

1. [https://marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage) 접속
2. 퍼블리셔 선택
3. **"+ New extension"** → **"VS Code"** 클릭
4. `.vsix` 파일 드래그&드롭 또는 선택

---

## 8. 배포 후 확인

배포 완료까지 보통 **5~10분** 소요됩니다.

- 마켓플레이스 페이지 확인: `https://marketplace.visualstudio.com/items?itemName={publisher}.{name}`
- VS Code에서 검색 확인: 확장 패널 → 확장프로그램 이름 검색
- 설치 테스트:
  ```bash
  code --install-extension vibeguard.vibeguard
  ```

---

## 9. 버전 업데이트 (이후 릴리즈)

### package.json 버전 변경

```json
"version": "0.1.3"
```

또는 `vsce`로 자동 버전 업:

```bash
vsce publish patch   # 0.1.2 → 0.1.3
vsce publish minor   # 0.1.2 → 0.2.0
vsce publish major   # 0.1.2 → 1.0.0
```

### 버전 관리 규칙 (Semantic Versioning)

| 변경 유형 | 예시 | 버전 올림 |
|---|---|---|
| 버그 수정, 소규모 개선 | 패턴 정규식 수정 | `patch` |
| 새 기능 추가 (하위 호환) | 새 서비스 패턴 추가 | `minor` |
| 하위 비호환 변경 | API/설정 구조 변경 | `major` |

---

## 10. 배포 체크리스트

배포 전 반드시 확인합니다.

### package.json

- [ ] `name`: 영문 소문자, 하이픈만 사용 (공백 없음)
- [ ] `displayName`: 사용자에게 표시될 이름
- [ ] `description`: 한 줄 설명 (마켓플레이스 검색에 사용)
- [ ] `version`: 올바른 Semver 형식 (`X.Y.Z`)
- [ ] `publisher`: 등록된 Publisher ID와 일치
- [ ] `engines.vscode`: 지원하는 최소 VS Code 버전
- [ ] `icon`: 아이콘 파일 경로 (`.vscodeignore`에서 제외되지 않아야 함)
- [ ] `repository`: GitHub 저장소 URL
- [ ] `license`: 라이선스 명시

### 코드 & 파일

- [ ] `npm run compile` 성공
- [ ] `vsce ls`로 패키지 내용 확인 (민감 파일 미포함)
- [ ] `.vscodeignore`에 `src/**`, `node_modules/**`, `.env*` 포함
- [ ] README.md 최신화 (영문 필수)
- [ ] CHANGELOG.md 최신화

### 기능 검증

- [ ] F5 디버그 모드에서 Extension Development Host로 동작 확인
- [ ] 탐지 패턴 테스트 (각 서비스별 샘플 키로 확인)
- [ ] QuickFix 동작 확인 (`.env` 저장 + 코드 교체)
- [ ] 상태바 표시 확인

---

## 참고 링크

- [VS Code Extension Marketplace 공식 문서](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [vsce CLI 레퍼런스](https://github.com/microsoft/vscode-vsce)
- [Azure DevOps PAT 발급](https://docs.microsoft.com/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate)
- [Marketplace 퍼블리셔 관리](https://marketplace.visualstudio.com/manage)
