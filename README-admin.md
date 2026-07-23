# 아카이브 포트폴리오 생성기 README

이 문서는 **어떤 기능을 수정할 때 어떤 파일을 보면 되는지** 빠르게 찾기 위한 관리자용 메모입니다.

## 핵심 파일

| 수정하려는 것 | 파일 |
|---|---|
| 입력창, 버튼, 모달, 화면 구조 | `generator/index.html` |
| 색상, 간격, 카드, 반응형, 모바일 배치 | `generator/generator.css` |
| 저장, 불러오기, 미리보기, 이미지·음악, 검색·필터 동작 | `generator/generator.js` |
| 플랫폼·장르·소셜 목록 | `shared/admin-catalog.js` |
| 새 프로젝트 기본 데이터 | `shared/empty-project.js` |
| 최종 배포용 원본 구조 | `template/` |
| 디자인·레이아웃 참고본 | `examples/stardust-archive/` |

## 기능별 위치

### 사이트와 제작자 프로필

- 입력 항목 추가·문구 수정  
  `generator/index.html`
- 프로필 미리보기 배치와 배경 이미지 스타일  
  `generator/generator.css`
- 프로필 데이터 저장, 배경·프로필 PNG 처리  
  `generator/generator.js`

### 세계관

- 세계관 입력 화면  
  `generator/index.html`
- 세계관 카드·상세 화면·반응형  
  `generator/generator.css`
- 추가·삭제·순서·캐릭터 연결·음악·상세 출력  
  `generator/generator.js`

### 캐릭터

- 캐릭터 입력 화면  
  `generator/index.html`
- 캐릭터 카드·상세 화면·이미지 갤러리  
  `generator/generator.css`
- 추가·삭제·순서·장르·플랫폼·세계관 연결·음악  
  `generator/generator.js`

### 검색과 필터

- 검색창·필터 선택창 구조  
  `generator/index.html`
- 필터 버튼·더보기 창 디자인  
  `generator/generator.css`
- 장르·플랫폼·세계관 다중 선택과 검색 규칙  
  `generator/generator.js`

### 이미지

- 파일 입력 영역  
  `generator/index.html`
- 드롭 영역과 미리보기 디자인  
  `generator/generator.css`
- PNG 선택·드래그·붙여넣기·IndexedDB 저장  
  `generator/generator.js`

### 음악

- 세계관·캐릭터 음악 입력창과 상세 SOUNDTRACK 영역  
  `generator/index.html`
- 재생바·트랙 목록·카드의 `♫` 표시  
  `generator/generator.css`
- MP3 저장·YouTube 처리·재생·ZIP 백업  
  `generator/generator.js`

### 테마 색

- 색상 입력창  
  `generator/index.html`
- 기본 CSS 색상 변수와 각 요소 디자인  
  `generator/generator.css`
- 선택 색상에서 전체 팔레트를 만드는 `applyPreviewTheme()`  
  `generator/generator.js`

### 백업과 불러오기

- 백업·불러오기 버튼  
  `generator/index.html`
- JSON 저장, 전체 ZIP 저장, ZIP 복구  
  `generator/generator.js`

전체 ZIP에는 다음이 들어갑니다.

```text
project.json
backup-manifest.json
images/*.png
audio/*.mp3
```

## 관리자 목록 수정

플랫폼, 장르, 소셜 서비스 목록은 다음 파일에서 관리합니다.

```text
shared/admin-catalog.js
```

플랫폼 ID는 연결 데이터의 기준이므로 변경하지 않습니다.

```text
bloom
caveduck
rofan
tingle
```

표시 이름, 설명, 아이콘 경로만 수정하는 것이 안전합니다.

## 이미지 폴더

```text
images/characters/
images/platforms/
images/worlds/
images/profile/
images/profile-links/
```

사용자 업로드 이미지는 생성기에서 IndexedDB와 전체 백업 ZIP으로 관리합니다.

## 수정 후 확인

1. `generator/index.html`의 ID가 중복되지 않는지 확인
2. `generator.js`의 `querySelector("#...")`와 HTML ID가 연결되는지 확인
3. JavaScript 문법 검사

```bash
node --check generator/generator.js
```

4. 데스크톱과 380px 미리보기 확인
5. JSON 저장·불러오기 확인
6. 이미지·음악 포함 ZIP 저장·불러오기 확인
7. 음악이 없는 항목에 `♫`와 SOUNDTRACK이 나오지 않는지 확인

## 주의

- 요청하지 않은 파일과 기능은 함께 수정하지 않습니다.
- `shared/admin-catalog.js`의 기존 플랫폼 ID는 유지합니다.
- 레이아웃 수정은 `examples/stardust-archive/`를 먼저 참고합니다.
- MP3 다운로드 버튼은 숨길 수 있지만, 브라우저 재생 파일의 완전한 다운로드 차단은 불가능합니다.
