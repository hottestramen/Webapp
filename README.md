# 부서 공용 업무 캘린더

부서 팀원 전체가 할 일을 함께 등록하고, 담당자·마감일·진행 상태를 **칸반 · 리스트 · 캘린더 · 대시보드** 4개 뷰로 공유하는 웹앱입니다.
캘린더에서는 **팀원 휴가**(연차·반차·병가)·**출장**도 함께 보고 `+ 휴가 등록`·`+ 출장 등록`으로 입력할 수 있습니다(평일에만 표시).
로그인 없이 링크와 이름 입력만으로 쓰며, 데이터는 공용 DB(Supabase)에 저장됩니다. 요구사항 기준 문서는 [docs/PRD.md](docs/PRD.md)입니다.

- 프론트엔드: React + Vite + TypeScript(strict), Tailwind CSS(디자인 토큰을 theme에 연결), Zustand, dnd-kit, date-fns
- 백엔드: 별도 서버 없음. Supabase(Postgres + Realtime)를 브라우저에서 직접 사용
- 다른 팀원의 변경은 실시간으로 반영되고, 같은 항목을 동시에 고치면 충돌 확인창이 뜹니다
- 헤더의 스위치로 다크 모드를 켜고 끌 수 있습니다(선택은 브라우저에 저장, 처음에는 OS 설정을 따릅니다)

> ⚠️ **이 앱은 로그인이 없습니다.** 주소와 공개(anon) 키를 아는 사람은 누구나 데이터를 읽고 쓸 수 있습니다.
> 부서 내부에서만 링크를 공유하고, 개인정보는 입력하지 마세요. 자세한 한계는 [식별 한계와 보안 주의사항](#식별-한계와-보안-주의사항)을 보세요.

---

## 1. Supabase 설정 (처음 한 번)

### 1-1. 프로젝트 만들기
1. [supabase.com](https://supabase.com)에서 프로젝트를 만듭니다. (리전은 가까운 곳, 예: Northeast Asia / Seoul)
2. **Project Settings → API**에서 두 값을 확인해 둡니다.
   - `Project URL` (예: `https://abcdefgh.supabase.co`)
   - `anon` `public` key — **이 키만** 앱에 넣습니다. `service_role` 키는 어디에도 넣지 않습니다.

### 1-2. 마이그레이션 적용 (순서 중요)
**SQL Editor**에서 아래 파일의 내용을 **순서대로** 하나씩 실행합니다.

| 순서 | 파일 | 내용 |
| --- | --- | --- |
| 1 | `supabase/migrations/001_init.sql` | 테이블·제약(CHECK)·트리거, 초기 카테고리, 2026~2027 공휴일 |
| 2 | `supabase/migrations/002_rls.sql` | RLS(모든 테이블), anon은 DELETE 불가, 삭제된 행 숨김, 소프트 삭제 함수 |
| 3 | `supabase/migrations/003_holidays_insert.sql` | 설정 화면의 임시공휴일 등록용 INSERT 허용 |
| 4 | `supabase/migrations/004_realtime.sql` | Realtime 발행 추가, 소프트 삭제 알림 트리거 |
| 5 | `supabase/migrations/005_leaves.sql` | 팀원 휴가(`leaves`) 테이블, RLS, 소프트 삭제 함수, 실시간 발행 |
| 6 | `supabase/migrations/006_trips.sql` | 출장(`trip`) 종류 추가 (휴가 테이블 공용) |
| – | (휴지통) | DB 변경 없음: 완료 후 7일 지난 할일을 화면에서 계산해 설정 > 휴지통으로 이동 |

실행 후 **Table Editor**에서 `tasks`, `comments`, `members`, `categories`, `holidays` 5개 테이블에 **RLS enabled** 표시가 있는지 확인하세요. RLS가 꺼진 테이블이 있으면 배포하지 마세요.

### 1-3. 확인과 운영 설정
- **Database → Replication**(또는 Publications)에서 `supabase_realtime`에 `tasks`, `comments`, `members`, `categories`가 들어 있는지 확인합니다(004가 추가합니다).
- **Project Settings → Database → Backups**에서 자동 백업을 켭니다. 앱의 **설정 → 데이터 내보내기(JSON)**도 함께 쓰세요.
- 관리자(프로젝트 소유자)를 정해 두세요. 삭제 복구·임시공휴일 수정은 관리자가 콘솔에서 합니다.

---

## 2. 환경변수

`.env.example`을 `.env`로 복사해 채웁니다. `.env`는 `.gitignore`에 들어 있어 저장소에 올라가지 않습니다.

```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

`VITE_`로 시작하는 값은 브라우저 번들에 포함됩니다. 그래서 **공개해도 되는 anon 키만** 넣습니다.

---

## 3. 로컬 실행

```bash
npm install
cp .env.example .env     # 값을 채운 뒤
npm run dev              # http://localhost:5173
```

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입 검사 + 프로덕션 빌드(`dist/`) |
| `npm run build:html` | 단일 HTML 파일 빌드(`dist-html/index.html`) |
| `npm run dev:mock` | 가짜 Supabase 서버와 개발 서버를 함께 실행(체험용) |
| `npm run preview` | 빌드 결과 미리보기(배포와 같은 보안 헤더 적용) |
| `npm test` | 단위 테스트(vitest): 지표·필터·마감 계산·충돌 저장·실시간 병합·RLS(PGlite)·보안 스캔·명도 대비 |
| `npm run typecheck` / `npm run lint` | 타입 검사 / ESLint(색상 코드·px 직접 사용, innerHTML 등을 금지하는 규칙 포함) |
| `npm run check:bundle` | 빌드 후 초기 JS gzip 크기 확인(200KB 이하) |
| `npm run seed` | 할일 500건·댓글 2,000건 시드 입력(**테스트 프로젝트에서만**) |
| `npm run e2e` | Playwright E2E·접근성·반응형·성능 (아래 참고) |

### E2E 테스트
`npm run e2e`는 **로컬 목 서버**(`scripts/mock-supabase.ts`, Supabase 호환 REST + Realtime)와 프로덕션 빌드를 자동으로 띄워 실행합니다. 실제 Supabase에 접속하지 않습니다.
- 이 PC의 Chrome/Edge를 쓰도록 설정되어 있습니다(`--project=chrome`, `--project=edge`).
- Firefox·WebKit 프로젝트도 설정되어 있습니다. 해당 브라우저가 설치된 환경에서 `npx playwright install firefox webkit` 후 `npx playwright test --project=firefox --project=webkit`로 실행하세요.
- 스크린샷은 `e2e/screenshots/`에 저장됩니다(저장소에는 올리지 않습니다).

---

## 4. 배포 (Netlify 또는 Vercel)

둘 다 SPA 리다이렉트와 보안 헤더(CSP 포함)가 설정 파일에 들어 있습니다. 환경변수 두 개만 넣으면 됩니다.

### Netlify
1. 저장소를 연결해 새 사이트를 만듭니다(`netlify.toml`이 빌드 명령·출력 폴더·헤더를 지정합니다).
2. **Site configuration → Environment variables**에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 추가합니다.
3. 배포합니다.

### Vercel
1. 저장소를 Import합니다(Framework: Vite). `vercel.json`이 리라이트와 헤더를 지정합니다.
2. **Settings → Environment Variables**에 같은 두 값을 추가합니다(Production/Preview 모두).
3. 배포합니다.

### 배포 후 꼭 할 일: CSP 좁히기
설정 파일의 `connect-src`에는 `https://*.supabase.co wss://*.supabase.co`가 들어 있습니다. 배포 후 **내 프로젝트 주소로 좁히세요**.

```
connect-src 'self' https://abcdefgh.supabase.co wss://abcdefgh.supabase.co
```
`netlify.toml`과 `vercel.json`의 `Content-Security-Policy` 값을 바꾸면 됩니다.
(`tests/deploy-config.test.ts`는 와일드카드 값과의 일치를 검사하므로, 좁힌 뒤에는 해당 테스트의 기대값도 함께 바꾸세요.)

### 배포 후 확인
- 브라우저 개발자도구 콘솔에 CSP 위반(`Refused to ...`)이 없는지
- 첫 접속 시 이름 입력 모달이 뜨고, 두 브라우저에서 한쪽 수정이 다른 쪽에 바로 보이는지
- `/?view=list&status=todo` 같은 주소로 직접 접속해도 열리는지(SPA 리다이렉트)

### 단일 HTML 파일로 배포하기 (서버 없이 열기)

서버·호스팅 설정이 부담스러우면 **HTML 파일 하나**로 배포할 수 있습니다. JS·CSS를 모두 `index.html` 안에 합친 파일이라, 더블클릭으로 열리고 공유 폴더·사내 웹서버·정적 호스팅 어디에든 올릴 수 있습니다. 데이터는 그대로 Supabase에 저장되므로 파일을 여러 사람이 각자 열어도 같은 데이터를 봅니다.

```bash
# 1) .env 에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 를 채운 뒤
npm run build:html
# 2) dist-html/index.html 한 파일이 결과물입니다
```

- **주소와 키가 파일 안에 들어갑니다.** 키는 공개용 anon 키지만, 주소·키가 바뀌면 다시 빌드해서 파일을 새로 배포해야 합니다.
- **파일로 직접 열 때**(`file://`)는 보안 헤더(CSP)가 없고, 이름·마지막 뷰는 그 PC 브라우저에 저장됩니다. 필터 링크(`index.html?status=todo&view=list`)도 같은 파일 경로로 열 때 동작합니다. 팀원에게 파일 자체를 나눠 주면 각자 경로가 달라 링크 공유가 어렵습니다. **링크 공유가 중요하면 웹 서버에 올리세요.**
- **웹 서버에 올릴 때**는 `build:html` 마지막에 출력되는 `Content-Security-Policy` 값을 서버 헤더에 넣으세요(인라인 스크립트의 해시를 허용하는 값이며, 빌드할 때마다 바뀝니다). 위의 Netlify·Vercel 설정 파일의 CSP(`script-src 'self'`)는 이 파일에는 맞지 않습니다.
- **글꼴**: Pretendard 웹폰트는 파일이 많아 넣지 않았습니다. 시스템 글꼴(맑은 고딕, Apple SD Gothic Neo)로 표시됩니다.
- 용량은 약 640KB(gzip 약 190KB)입니다.

---

## 5. 식별 한계와 보안 주의사항

**이름만 입력하는 방식입니다.**
- 본인 확인을 하지 않습니다. 다른 사람 이름을 입력하면 그 사람으로 작성·수정할 수 있습니다(사칭을 막을 수 없습니다).
- 이름이 같은 팀원은 구분되지 않습니다. “김하늘(기획)”처럼 소속을 붙여 등록하세요.
- 작성자·수정자 기록은 참고용이며, 책임 추적이나 감사의 근거로 쓸 수 없습니다.
- 책임 추적·권한 구분이 필요해지면 인증 도입을 별도로 검토하세요(이 앱의 범위 밖).

**RLS는 “무슨 작업”만 제한합니다.** 인증이 없어서 “누가 하는지”는 구분하지 못합니다.
- anon은 조회·등록·수정만 가능하고 **DELETE는 막혀 있습니다.** 삭제는 `deleted_at`을 채우는 소프트 삭제이며, 삭제된 행은 조회되지 않습니다.
- 값 제약(길이, 상태 값 등)은 DB의 CHECK 제약으로도 걸려 있습니다.
- 주소와 anon 키를 아는 사람은 누구나 허용된 작업을 할 수 있으니 **링크를 부서 외부로 공유하지 마세요.** 개인정보도 입력하지 마세요.

**코드 규칙**
- 사용자 입력(제목·설명·댓글·이름)은 항상 텍스트로 렌더합니다. `innerHTML`·`dangerouslySetInnerHTML`·`eval`은 쓰지 않습니다(테스트가 검사합니다).
- 설명의 URL은 `http`/`https`만 링크가 되고 `rel="noopener noreferrer"`가 붙습니다.
- `service_role` 키는 저장소 어디에도 없어야 합니다(테스트가 검사합니다).

---

## 6. 운영 메모

### 삭제한 할일·댓글 복구 (관리자, SQL Editor)
```sql
update tasks    set deleted_at = null where id = '<할일 id>';
update comments set deleted_at = null where id = '<댓글 id>';
```
앱의 “실행 취소”는 삭제 직후 1분 안에만 동작합니다(`restore_task`).

### 임시공휴일 수정·삭제
앱에서는 등록만 가능합니다(RLS가 UPDATE·DELETE를 막습니다). 잘못 넣었다면 SQL Editor에서 고칩니다.
```sql
delete from holidays where date = '2026-12-31';
```
법정 공휴일은 법령·공고로 바뀔 수 있으니 배포 전에 한 번 대조하세요.

### 실시간 동기화
- 변경은 Supabase Realtime으로 2초 안에 반영됩니다. 연결이 끊기면 헤더에 “오프라인 — 재연결 중”이 보이고 30초마다 다시 불러오며, 재연결되면 전체를 한 번 불러옵니다. 탭이 다시 보일 때도 다시 불러옵니다.
- 삭제 알림은 RLS 때문에 일반 Realtime 이벤트로는 오지 않아서, 004의 트리거가 `realtime.send`로 따로 보냅니다. 이 기능은 **실제 Supabase에서 한 번 확인**하세요(두 브라우저에서 한쪽이 삭제 → 다른 쪽 카드가 사라지는지). 동작하지 않아도 탭 복귀·재연결·폴링 때 삭제가 반영됩니다.

### 동시 편집
상세에서 저장할 때 `updated_at`이 열었을 때와 같을 때만 저장하고, 다르면 충돌 확인창(최신 내용 보기 / 내 내용으로 덮어쓰기)이 뜹니다. 칸반 드래그·리스트 인라인 변경 같은 단일 필드 변경은 확인 없이 나중 저장이 우선합니다.

---

## 7. 폴더 구조

```
docs/PRD.md                 요구사항 기준 문서
supabase/migrations/        001~004 SQL, rls.test.ts(PGlite 로 RLS 검증)
src/
  app/                      App, URL 동기화, 실시간 연결
  components/               공통 UI(헤더·탭·모달·배지·토스트)
  features/                 tasks · comments · filters · dashboard · calendar · settings · user
  lib/                      api(데이터 접근 계층), realtime, 마감·정렬·충돌·날짜 유틸
  stores/                   Zustand 스토어
  styles/tokens.css         디자인 토큰(색·간격·모서리·그림자·글꼴·모션)
config/csp.ts               CSP·보안 헤더 정의
scripts/                    mock-supabase(목 서버), seed, check-bundle
e2e/                        Playwright 테스트
```
컴포넌트는 `supabase`를 직접 호출하지 않고 `src/lib/api`의 함수만 씁니다(ESLint 규칙으로 강제).
