# 🎯 GitHub 협업 완벽 가이드

## 📚 목차
1. [핵심 개념](#1-핵심-개념)
2. [협업 예절](#2-협업-예절)
3. [기본 워크플로우](#3-기본-워크플로우)
4. [필수 명령어](#4-필수-명령어)
5. [실전 시나리오](#5-실전-시나리오)
6. [자주 하는 실수](#6-자주-하는-실수)

---

## 1. 핵심 개념

### 🌳 브랜치(Branch)란?
- **메인 코드(main)의 복사본**으로 독립적인 작업 공간
- 다른 사람 작업에 영향 없이 기능 개발 가능
- 완성되면 main에 합침(merge)

```
main ────●────●────●────●──────●  (배포용 안정 버전)
          \                    /
feature    ●────●────●────●───●   (내 작업 공간)
```

### 📬 Pull Request(PR)란?
- "내 코드를 main에 합쳐주세요"라는 **요청**
- 팀원들이 코드 리뷰 가능
- 토론과 개선 과정
- 승인 후 merge

### 🔄 Fork vs Clone
- **Fork**: 남의 저장소를 내 GitHub 계정으로 복사
- **Clone**: 저장소를 내 컴퓨터로 다운로드

---

## 2. 협업 예절

### ✅ 반드시 지켜야 할 것들

#### 1. **절대 main에 직접 푸시하지 마세요**
```bash
# ❌ 이렇게 하지 마세요
git checkout main
git add .
git commit -m "fix bug"
git push  # 절대 금지!

# ✅ 이렇게 하세요
git checkout -b fix/login-bug
git add .
git commit -m "fix: resolve login timeout issue"
git push
# → PR 생성
```

#### 2. **의미 있는 커밋 메시지 작성**
```bash
# ❌ 나쁜 예시
git commit -m "수정"
git commit -m "asdfasdf"
git commit -m "테스트"

# ✅ 좋은 예시
git commit -m "feat: 사용자 로그인 기능 추가"
git commit -m "fix: 로그인 시 타임아웃 오류 수정"
git commit -m "docs: README에 설치 방법 추가"
```

#### 3. **PR 제목과 설명을 상세히**
```markdown
# ❌ 나쁜 PR
제목: 수정
내용: (비어있음)

# ✅ 좋은 PR
제목: feat: 사용자 프로필 편집 기능 추가
내용:
## 변경사항
- 프로필 이미지 업로드 기능
- 닉네임 변경 기능
- 이메일 변경 기능

## 테스트
- [ ] 이미지 업로드 테스트
- [ ] 닉네임 중복 체크
- [ ] 이메일 형식 검증
```

#### 4. **코드 리뷰는 건설적으로**
```markdown
# ❌ 나쁜 리뷰
"이 코드 별로네요"
"왜 이렇게 했어요?"

# ✅ 좋은 리뷰
"이 부분은 map() 대신 filter()를 사용하면 더 명확할 것 같습니다 😊"
"성능을 위해 useMemo를 사용하는 건 어떨까요? 예시: [링크]"
```

---

## 3. 기본 워크플로우

### 🔄 표준 개발 프로세스

```mermaid
1. main 최신화 → 2. 브랜치 생성 → 3. 작업 → 4. 커밋
→ 5. 푸시 → 6. PR 생성 → 7. 리뷰 → 8. 머지
```

### 상세 단계:

#### Step 1: 최신 main 받기
```bash
git checkout main
git pull origin main
```

#### Step 2: 작업 브랜치 생성
```bash
git checkout -b feature/add-dark-mode
# 브랜치 이름 규칙:
# feature/기능명 - 새 기능
# fix/버그명 - 버그 수정
# docs/문서명 - 문서 작업
```

#### Step 3: 작업하기
```bash
# 코드 수정...
# 파일 편집...
```

#### Step 4: 커밋하기
```bash
git add .
git commit -m "feat: 다크모드 토글 버튼 추가"
```

#### Step 5: 원격에 푸시
```bash
git push -u origin feature/add-dark-mode
```

#### Step 6: PR 생성
```bash
# GitHub CLI 사용
gh pr create

# 또는 GitHub 웹사이트에서 생성
```

#### Step 7: 리뷰 받기
- 팀원들의 피드백 기다리기
- 요청사항 반영하기

#### Step 8: 머지
- 승인 받으면 Merge 버튼 클릭
- 브랜치 삭제

---

## 4. 필수 명령어

### 🛠️ 기본 명령어

```bash
# 상태 확인
git status                    # 현재 상태 보기
git log --oneline -5         # 최근 5개 커밋 보기
git branch                    # 브랜치 목록 보기

# 브랜치 작업
git checkout -b feature/name  # 브랜치 생성 & 전환
git checkout main             # main으로 전환
git branch -d feature/name   # 브랜치 삭제

# 변경사항 저장
git add .                     # 모든 변경사항 스테이징
git add file.txt             # 특정 파일만 스테이징
git commit -m "message"       # 커밋
git commit --amend           # 마지막 커밋 수정

# 원격 작업
git push                      # 푸시
git push -u origin branch    # 새 브랜치 푸시
git pull                      # 풀 (fetch + merge)
git fetch                     # 원격 변경사항 확인만

# 되돌리기
git reset HEAD~1             # 마지막 커밋 취소
git checkout -- file.txt     # 파일 변경 취소
git stash                    # 임시 저장
git stash pop                # 임시 저장 복원
```

### 🚀 GitHub CLI 명령어

```bash
# PR 관련
gh pr create                  # PR 생성
gh pr list                    # PR 목록
gh pr view 123               # PR #123 보기
gh pr checkout 123           # PR #123 체크아웃
gh pr merge 123              # PR #123 머지

# 이슈 관련
gh issue create              # 이슈 생성
gh issue list                # 이슈 목록
gh issue close 123           # 이슈 #123 닫기

# 저장소 관련
gh repo clone owner/repo     # 저장소 클론
gh repo fork                 # 현재 저장소 포크
```

---

## 5. 실전 시나리오

### 시나리오 1: 새 기능 추가하기

```bash
# 1. 최신 코드 받기
git checkout main
git pull origin main

# 2. 기능 브랜치 생성
git checkout -b feature/add-search

# 3. 작업하기 (파일 수정)
# ... 코드 작성 ...

# 4. 변경사항 확인
git status
git diff

# 5. 커밋
git add .
git commit -m "feat: 검색 기능 추가

- 검색 바 UI 구현
- 검색 API 연동
- 검색 결과 표시"

# 6. 푸시
git push -u origin feature/add-search

# 7. PR 생성
gh pr create --title "feat: 검색 기능 추가" \
  --body "## 구현사항
- 검색 바 UI
- 검색 API 연동
- 결과 표시

## 테스트
- [x] 검색어 입력 테스트
- [x] 결과 표시 확인"
```

### 시나리오 2: 긴급 버그 수정

```bash
# 1. 핫픽스 브랜치 생성
git checkout main
git pull origin main
git checkout -b hotfix/login-error

# 2. 버그 수정
# ... 코드 수정 ...

# 3. 커밋 & 푸시
git add .
git commit -m "hotfix: 로그인 오류 긴급 수정"
git push -u origin hotfix/login-error

# 4. 긴급 PR 생성
gh pr create --title "HOTFIX: 로그인 오류" \
  --body "🚨 긴급 수정

## 문제
- 로그인 시 500 에러 발생

## 해결
- API 엔드포인트 수정

## 테스트
- [x] 로그인 성공 확인"
```

### 시나리오 3: 충돌 해결하기

```bash
# 1. main의 최신 변경사항 가져오기
git checkout feature/my-feature
git fetch origin
git merge origin/main

# 2. 충돌 발생!
# CONFLICT in file.js

# 3. 파일 열어서 충돌 해결
# <<<<<<< HEAD
# 내 코드
# =======
# main의 코드
# >>>>>>> origin/main

# 4. 해결 후 커밋
git add .
git commit -m "merge: main 브랜치와 충돌 해결"
git push
```

### 시나리오 4: 실수 되돌리기

```bash
# 케이스 1: 아직 커밋 안 했을 때
git checkout -- file.txt      # 특정 파일 되돌리기
git checkout -- .             # 모든 변경 되돌리기

# 케이스 2: 커밋은 했지만 푸시 안 했을 때
git reset HEAD~1              # 마지막 커밋 취소
git reset --hard HEAD~1      # 완전히 되돌리기

# 케이스 3: 이미 푸시했을 때 (위험!)
git revert HEAD              # 되돌리는 새 커밋 생성
git push                     # 푸시
```

---

## 6. 자주 하는 실수

### ❌ 실수 1: main에 직접 커밋
```bash
# 실수를 발견했을 때
git reset HEAD~1            # 커밋 취소
git checkout -b fix/my-fix  # 브랜치 생성
git add .
git commit -m "fix: 수정사항"
git push -u origin fix/my-fix
```

### ❌ 실수 2: 잘못된 브랜치에서 작업
```bash
# 작업 내용 임시 저장
git stash

# 올바른 브랜치로 이동
git checkout correct-branch

# 작업 내용 복원
git stash pop
```

### ❌ 실수 3: 커밋 메시지 실수
```bash
# 아직 푸시 안 했다면
git commit --amend -m "새로운 메시지"

# 이미 푸시했다면 (주의!)
git commit --amend -m "새로운 메시지"
git push --force  # 위험! 팀원과 상의 필요
```

### ❌ 실수 4: 큰 파일 커밋
```bash
# .gitignore에 추가
echo "large-file.zip" >> .gitignore

# 이미 커밋했다면
git rm --cached large-file.zip
git commit -m "remove: 큰 파일 제거"
```

---

## 📋 체크리스트

### PR 생성 전 체크리스트
- [ ] 최신 main을 머지했나?
- [ ] 테스트는 통과하나?
- [ ] 불필요한 파일은 없나?
- [ ] 커밋 메시지는 명확한가?
- [ ] PR 설명을 자세히 적었나?

### 코드 리뷰 체크리스트
- [ ] 코드가 이해하기 쉬운가?
- [ ] 중복 코드는 없나?
- [ ] 성능 문제는 없나?
- [ ] 보안 이슈는 없나?
- [ ] 테스트 코드는 있나?

---

## 🎓 프로 팁

### 1. 별칭(Alias) 설정으로 시간 절약
```bash
# ~/.gitconfig에 추가
[alias]
    st = status
    co = checkout
    br = branch
    cm = commit -m
    ps = push
    pl = pull
```

### 2. 커밋 메시지 템플릿
```bash
# ~/.gitmessage.txt 생성
# <type>: <subject>
#
# <body>
#
# <footer>

git config --global commit.template ~/.gitmessage.txt
```

### 3. 유용한 도구들
- **GitHub Desktop**: GUI 클라이언트
- **GitKraken**: 비주얼 git 도구
- **Sourcetree**: 무료 GUI 클라이언트
- **gh**: GitHub CLI (추천!)

---

## 📚 참고 자료

- [GitHub Docs](https://docs.github.com)
- [Pro Git Book](https://git-scm.com/book/ko/v2)
- [GitHub Flow](https://docs.github.com/en/get-started/quickstart/github-flow)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

## 💡 기억할 한 문장

> "좋은 협업은 **명확한 커뮤니케이션**과 **일관된 규칙**에서 시작됩니다."

---

*이 가이드는 팀 협업을 위한 기본 가이드입니다. 팀의 상황에 맞게 조정하여 사용하세요!*