# Render.com NSFW API 차단 이슈 및 해결 방안

## 📋 문제 요약

**날짜**: 2025-01-10
**플랫폼**: Render.com Web Service
**문제**: 특정 NSFW 관련 API 호출이 서버 레벨에서 차단됨
**영향**: 일부 이미지 편집 기능 실패
**우선순위**: 🔴 높음 (기능 장애)

---

## 🔍 문제 상세

### 증상
- Render.com 서버에서 특정 NSFW 탐지/필터링 API 호출 시 연결 차단
- 로컬 환경에서는 정상 작동
- 다른 API는 정상 작동

### 영향받는 기능
- 이미지 안전성 검사 (NSFW 필터)
- 해당 API를 사용하는 모든 이미지 편집 워크플로우

### 현재 상태
- Render 지원팀 회신 대기 중
- 임시 우회 방법 검토 중

---

## 💡 해결 방안

### Option A: Render 지원팀 협의 ⭐ 추천 (1순위)

**방법:**
1. Render 지원팀에 티켓 제출
2. 사용 사례 설명 (정당한 NSFW 필터링 목적)
3. 해당 API 도메인 화이트리스트 요청

**장점:**
- ✅ 근본적 해결
- ✅ 추가 비용 없음
- ✅ 코드 변경 불필요

**단점:**
- ⏱️ 응답 시간 불확실 (며칠~1주)
- ❌ 거부될 가능성 있음

**현재 진행:**
- 티켓 제출 완료
- 회신 대기 중

---

### Option B: 프록시 서버 경유

**방법:**
```typescript
// 중간 프록시 서버 (다른 플랫폼에 배포)
// 예: Cloudflare Workers, Vercel Edge Functions

// netlify/functions/nsfw-proxy.ts (Netlify에 배포)
export const handler = async (event) => {
  const imageUrl = event.queryStringParameters.url;

  // NSFW API 호출
  const response = await fetch('https://nsfw-api.com/check', {
    method: 'POST',
    body: JSON.stringify({ url: imageUrl })
  });

  return {
    statusCode: 200,
    body: JSON.stringify(await response.json())
  };
};

// Render 서버에서 프록시 호출
const nsfwCheck = await fetch('https://your-netlify.com/.netlify/functions/nsfw-proxy?url=' + imageUrl);
```

**장점:**
- ✅ 빠른 구현 (1-2시간)
- ✅ Render 제약 우회

**단점:**
- ❌ 추가 지연 (프록시 홉)
- ❌ 복잡도 증가
- ❌ 또 다른 플랫폼 의존성

**예상 비용:**
- Netlify Functions: 무료 (125K 요청/월)
- Cloudflare Workers: 무료 (100K 요청/일)

---

### Option C: 대체 NSFW API 사용

**방법:**
현재 API를 Render에서 허용하는 다른 NSFW 탐지 서비스로 교체

**옵션:**
1. **Google Cloud Vision API** - Safe Search Detection
   - 비용: $1.50 / 1000 images
   - 신뢰도: 높음

2. **AWS Rekognition** - Content Moderation
   - 비용: $1.00 / 1000 images
   - 신뢰도: 높음

3. **Azure Content Moderator**
   - 비용: $1.00 / 1000 images
   - 신뢰도: 중간

**장점:**
- ✅ 근본적 해결
- ✅ 더 나은 성능/정확도 가능

**단점:**
- ❌ API 비용 발생
- ❌ 코드 리팩토링 필요
- ⏱️ 구현 시간 (반나절~1일)

---

### Option D: 다른 호스팅 플랫폼 마이그레이션

**후보:**
1. **Fly.io**
   - 전세계 엣지 로케이션
   - Docker 기반 (제약 없음)
   - 무료: 3개 shared-cpu VM
   - 비용: ~$5/월

2. **Railway**
   - GitHub 통합 우수
   - PostgreSQL 포함
   - 무료: $5 크레딧/월
   - 비용: ~$5/월

3. **DigitalOcean App Platform**
   - VPS 제공자, 제약 없음
   - 비용: $5/월

**장점:**
- ✅ 제약 없음 (모든 API 호출 가능)
- ✅ 더 나은 성능

**단점:**
- ❌ 마이그레이션 비용 (시간)
- ❌ 새 플랫폼 학습 필요
- 💰 무료 티어 제한적

**예상 마이그레이션 시간:**
- Fly.io: 2-3시간
- Railway: 1-2시간

---

## 🎯 추천 실행 계획

### 단계 1: 즉시 실행 (현재)
- ✅ Render 지원팀 티켓 제출 완료
- ⏳ 회신 대기 (1-3일)

### 단계 2: 회신 결과에 따라 분기

#### Case A: Render에서 화이트리스트 승인 ✅
→ 문제 해결, 추가 조치 불필요

#### Case B: Render에서 거부 ❌
→ **Option C 실행** (대체 NSFW API)
- Google Cloud Vision API로 교체
- 예상 비용: ~$1.50 / 1000 images
- 구현 시간: 반나절

#### Case C: 1주일 이상 무응답 ⏱️
→ **Option B 실행** (프록시 서버)
- Cloudflare Workers에 프록시 배포
- 무료, 빠른 구현 (1-2시간)

### 단계 3: 장기 계획
- 프로덕션 안정화 후 Option D (다른 플랫폼) 검토
- 비용 대비 효과 분석

---

## 📊 비용 비교

| 옵션 | 초기 비용 | 월간 비용 | 구현 시간 |
|------|----------|----------|----------|
| A: Render 협의 | $0 | $0 | 0 (대기) |
| B: 프록시 | $0 | $0 | 1-2시간 |
| C: 대체 API | $0 | ~$10 | 반나절 |
| D: 마이그레이션 | $0 | $5-7 | 2-3시간 |

---

## 🔄 상태 업데이트 로그

### 2025-01-10
- 🚨 **문제 발견**: Render.com에서 NSFW API 차단
- 📧 **티켓 제출**: Render 지원팀에 문의
- 📝 **문서화**: 이 문서 작성

### (업데이트 예정)
- Render 지원팀 회신 결과
- 선택한 해결 방안
- 구현 완료 여부

---

## 📚 참고 자료

### Render.com 정책
- [Acceptable Use Policy](https://render.com/terms)
- [Support Docs](https://render.com/docs)

### 대체 NSFW API
- [Google Cloud Vision - Safe Search](https://cloud.google.com/vision/docs/detecting-safe-search)
- [AWS Rekognition - Content Moderation](https://aws.amazon.com/rekognition/content-moderation/)
- [Azure Content Moderator](https://azure.microsoft.com/en-us/services/cognitive-services/content-moderator/)

### 대체 호스팅 플랫폼
- [Fly.io](https://fly.io/)
- [Railway](https://railway.app/)
- [DigitalOcean App Platform](https://www.digitalocean.com/products/app-platform)

---

*최종 수정: 2025-01-10*
*다음 업데이트: Render 지원팀 회신 후*
