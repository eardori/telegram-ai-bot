# 🎨 AI Image Edit Feature

## 📸 개요

텔레그램 봇에 추가된 지능형 이미지 편집 기능입니다. 사용자가 업로드한 사진을 AI가 분석하여 38개의 맞춤형 편집 템플릿을 제안하고, 선택한 스타일로 자동 편집합니다.

## ✨ 주요 기능

### 1. **자동 이미지 분석**
- 얼굴 감지 및 품질 평가
- 객체 및 장면 인식
- 구성 및 색상 분석
- 이미지 품질 평가

### 2. **38개 프롬프트 템플릿**

#### 🎭 3D/피규어 (5개)
- 피규어 만들기
- 손뜨개 인형
- 히어로 봉제인형
- 이모지 스티커 세트
- Funko Pop 피규어

#### 🌟 인물 스타일링 (13개)
- 레드카펫 스타일
- 파리의 밤 인물사진
- 골든아워 빈티지
- 드라마틱 흑백사진
- 70년대 헐리우드 스타
- 시네마틱 수트 스타일
- 로맨틱 로즈 스타일
- 오렌지 패션 화보
- 창가의 부드러운 빛
- 레트로 라운지 스타일
- 프로페셔널 흑백
- 우아한 사리 스타일

#### 🎮 게임/애니메이션 (2개)
- 리듬게임 캐릭터
- 16비트 픽셀아트

#### ✂️ 이미지 편집 (16개)
- 다중 이미지 합성
- 의상 교체
- 표정 변경
- 근육질 변신
- 배경 교체
- 사물 추가/제거
- 카메라 앵글 변경
- 계절 변경
- 텍스트 편집
- 의상 추출
- 헤어스타일 변경
- 화질 개선
- 사진 복원

#### 🎨 창의적 변환 (3개)
- 9장 앨범 생성
- 9장 스티커 사진
- 폴라로이드 커플/가족

## 🚀 사용 방법

### 기본 사용법

1. **편집 시작**
   ```
   /edit
   ```

2. **사진 업로드**
   - 1~5장까지 업로드 가능
   - 캡션으로 편집 요청 추가 가능

3. **제안 선택**
   - AI가 분석 후 5개 옵션 제안
   - 원하는 스타일 선택

4. **결과 받기**
   - 10-20초 내 편집 완료
   - 편집된 이미지 전송

### 고급 사용법

#### 다중 이미지 편집
```
1. 여러 사진 업로드
2. "완료" 입력
3. 합성 옵션 선택
```

#### 커스텀 편집
```
1. 사진 업로드
2. 캡션에 상세 요청 작성
   예: "배경을 에펠탑으로 바꿔주세요"
```

## 🛠️ 기술 스택

### 핵심 서비스
- **이미지 분석**: Gemini Vision API
- **이미지 편집**: Gemini API (Nano Banafo는 프로젝트명)
- **데이터베이스**: Supabase (PostgreSQL)
- **봇 프레임워크**: grammY

### 아키텍처
```
사용자 → Telegram Bot → Image Analyzer → Template Matcher
                    ↓
            Gemini API ← Prompt Builder ← Suggestion Engine
```

## 📊 성능 지표

| 지표 | 목표 | 현재 |
|------|------|------|
| 이미지 분석 정확도 | 90% | - |
| 제안 적중률 | 70% | - |
| 편집 성공률 | 85% | - |
| 평균 처리 시간 | 30초 이내 | - |
| 사용자 만족도 | 4.0/5.0 | - |

## 🔧 설치 및 설정

### 1. 환경 변수 설정

`.env` 파일에 추가:
```bash
# 필수 (이미 설정되어 있음)
GOOGLE_API_KEY=your_google_api_key  # 이미지 분석과 편집 모두 사용

# 선택 (설정 권장)
MAX_IMAGE_SIZE_MB=20
MAX_IMAGES_PER_EDIT=5
IMAGE_EDIT_TIMEOUT=30000
```

### 2. 데이터베이스 설정

Supabase SQL Editor에서 실행:
```sql
-- 1. 기본 스키마
sql/008_image_edit_schema.sql

-- 2. 템플릿 데이터
sql/009_insert_prompt_templates.sql
```

### 3. 배포

```bash
# 배포 스크립트 실행
./deploy-image-edit.sh

# 또는 수동 배포
npm install
npm run build
git push origin main
```

## 📋 API 엔드포인트

### 내부 서비스

| 서비스 | 클래스 | 용도 |
|--------|--------|------|
| Image Analyzer | `ImageAnalyzer` | 이미지 분석 |
| Template Matcher | `TemplateMatcher` | 템플릿 매칭 |
| Suggestion Engine | `SuggestionEngine` | 제안 생성 |
| Prompt Builder | `PromptBuilder` | 프롬프트 구성 |
| Gemini Edit Client | `NanoBanafoClient` | 편집 실행 (Gemini API 사용) |

## 🐛 트러블슈팅

### 일반적인 문제

#### 1. 이미지 업로드 실패
- 파일 크기 확인 (최대 20MB)
- 지원 포맷: JPEG, PNG, WebP

#### 2. 편집 타임아웃
- 네트워크 상태 확인
- 이미지 크기 축소 시도

#### 3. 템플릿 로드 실패
- 데이터베이스 연결 확인
- SQL 스키마 적용 여부 확인

### 로그 확인

```bash
# Render 로그
https://dashboard.render.com → Services → Logs

# 로컬 디버깅
NODE_ENV=development npm run dev
```

## 📈 사용 통계

### 템플릿별 우선순위 (상위 10개)

1. 피규어 만들기 (95점)
2. 배경 교체 (93점)
3. 레드카펫 스타일 (92점)
4. 다중 이미지 합성 (91점)
5. Funko Pop 피규어 (90점)
6. 화질 개선 (89점)
7. 파리의 밤 인물사진 (88점)
8. 의상 교체 (87점)
9. 프로페셔널 흑백 (86점)
10. 드라마틱 흑백사진 (85점)

## 🔒 보안

- API 키 암호화 저장
- 이미지 임시 저장 후 24시간 내 삭제
- 사용자별 일일 한도 설정 (50건)
- IP 화이트리스트 (Telegram 서버만)

## 📝 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.

## 🤝 기여

버그 리포트나 기능 제안은 GitHub Issues에 남겨주세요.

## 📞 지원

- GitHub: [eardori/telegram-ai-bot](https://github.com/eardori/telegram-ai-bot)
- Telegram: @MultifulDobi_bot

---

*Last Updated: 2024년 12월*
*Version: 1.0.0*