# 🚨 Netlify 배포 긴급 수정 가이드

## 문제 상황
- Netlify가 PR의 새 설정이 아닌 main 브랜치의 이전 설정 사용 중
- `dist` 디렉토리를 찾지 못해 배포 실패

## 즉시 해결 방법

### Option 1: Netlify Dashboard에서 직접 수정 (2분 소요)

1. **Netlify 로그인**
   - https://app.netlify.com 접속
   - 프로젝트 선택: `tg-aibot`

2. **Build 설정 변경**
   - `Site settings` 클릭
   - 왼쪽 메뉴에서 `Build & deploy` 선택
   - `Build settings` 섹션 찾기
   - `Edit settings` 버튼 클릭

3. **다음 값으로 변경**:
   ```
   Base directory: (비워두기)
   Build command: mkdir -p dist && echo '<!DOCTYPE html><html><body><h1>Telegram Bot Active</h1></body></html>' > dist/index.html && echo '/webhook /.netlify/functions/webhook 200' > dist/_redirects
   Publish directory: dist
   Functions directory: netlify/functions
   ```

4. **저장 및 재배포**
   - `Save` 클릭
   - 상단 `Deploys` 탭으로 이동
   - `Trigger deploy` → `Deploy site` 클릭

### Option 2: Environment Variable로 Override (대안)

1. **Environment variables** 섹션
   - `Site settings` → `Environment variables`
   - 다음 추가:
   ```
   NETLIFY_BUILD_COMMAND = mkdir -p dist && touch dist/index.html
   NETLIFY_PUBLISH_DIR = dist
   ```

### Option 3: netlify.toml Override 파일

Netlify UI에서 `Deploy settings` → `Build hooks`에서:
1. `Link site to Git` 확인
2. `Build settings` → `Edit settings`
3. `Build command`를 다음으로 override:
   ```bash
   mkdir -p dist && cp index.html dist/ 2>/dev/null || echo "<html><body>Bot Running</body></html>" > dist/index.html
   ```

## 확인 사항

배포 로그에서 다음 확인:
- ✅ Build command 실행됨
- ✅ dist 디렉토리 생성됨
- ✅ Functions 번들링 성공
- ✅ Deploy 성공

## 영구 해결

PR #3 머지 후:
1. main 브랜치에 새 설정 적용
2. 자동 배포 트리거
3. 이후부터는 자동으로 작동

## 트러블슈팅

만약 여전히 실패한다면:

1. **Clear cache and deploy**
   - `Deploys` → `Trigger deploy` → `Clear cache and deploy site`

2. **Build 로그 확인**
   - 어떤 명령이 실행되는지 확인
   - publish directory 경로 확인

3. **Functions 확인**
   - Functions 탭에서 webhook 함수 존재 확인

## 연락처

문제 지속 시:
- GitHub Issue 생성
- PR #3 댓글로 문의