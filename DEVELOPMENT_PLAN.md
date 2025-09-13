# 텔레그램 AI 봇 개발 계획서

## 📊 프로젝트 개요

### 목표
텔레그램 그룹챗에서 LLM을 활용한 메시지 요약 및 AI 이미지 생성 기능을 제공하는 서버리스 봇 구축

### 기술적 선택 이유

**Netlify Functions + Supabase 조합 선택 근거:**
- **서버리스 아키텍처**: 트래픽에 따른 자동 스케일링, 유지보수 비용 절감
- **빠른 배포**: Git 연동을 통한 자동 배포 파이프라인
- **비용 효율성**: 사용량 기반 과금으로 초기 비용 최소화
- **통합 환경**: Netlify-Supabase 네이티브 통합 지원

**grammY 프레임워크 선택 근거:**
- **현대적 문법**: async/await 완전 지원
- **타입스크립트 네이티브**: 타입 안정성 보장
- **경량화**: Telegraf 대비 더 가벼운 번들 사이즈
- **웹훅 최적화**: 서버리스 환경에 최적화된 설계

## 🏗️ 시스템 아키텍처 상세

### 데이터 플로우
```
1. 사용자 메시지 → Telegram API
2. Telegram Webhook → Netlify Functions
3. 메시지 처리 → Supabase 저장
4. 주기적 트리거 → 요약/이미지 생성
5. LLM API 호출 → 결과 처리
6. 텔레그램으로 응답 전송
```

### 핵심 컴포넌트

#### 1. 웹훅 핸들러 (`webhook.ts`)
```typescript
interface WebhookEvent {
  message?: TelegramMessage;
  callback_query?: CallbackQuery;
  inline_query?: InlineQuery;
}
```

**주요 책임:**
- 텔레그램 웹훅 수신 및 검증
- 메시지 타입별 라우팅
- 에러 처리 및 로깅

#### 2. 메시지 프로세서 (`message-processor.ts`)
```typescript
class MessageProcessor {
  async processTextMessage(message: TextMessage): Promise<void>
  async processCommand(command: string, args: string[]): Promise<void>
  async storeMessage(message: TelegramMessage): Promise<void>
}
```

#### 3. 요약 생성기 (`summary-generator.ts`)
```typescript
class SummaryGenerator {
  async generateSummary(chatId: number, timeRange: TimeRange): Promise<string>
  async schedulePeriodicalSummary(chatId: number, interval: number): Promise<void>
}
```

#### 4. 이미지 생성기 (`image-generator.ts`)
```typescript
class ImageGenerator {
  async generateImage(prompt: string, style?: string): Promise<ImageResult>
  async uploadToTelegram(imageUrl: string, chatId: number): Promise<void>
}
```

## 📅 상세 개발 일정

### Week 1: Foundation Setup
**Day 1-2: 환경 구성**
- [ ] Netlify 프로젝트 생성 및 도메인 설정
- [ ] Supabase 프로젝트 생성 및 데이터베이스 스키마 구축
- [ ] GitHub 저장소 생성 및 CI/CD 파이프라인 구성

**Day 3-5: 기본 봇 구조**
- [ ] grammY 프로젝트 초기화
- [ ] TypeScript 설정 및 타입 정의
- [ ] 텔레그램 봇 생성 및 토큰 발급
- [ ] 기본 웹훅 엔드포인트 구현

**Day 6-7: 데이터베이스 연동**
- [ ] Supabase 클라이언트 설정
- [ ] 기본 CRUD 함수 구현
- [ ] 연결 테스트 및 디버깅

### Week 2: Core Messaging System
**Day 8-10: 메시지 수집**
- [ ] 웹훅 이벤트 파싱 로직
- [ ] 메시지 타입별 처리 핸들러
- [ ] 데이터베이스 저장 로직 구현

**Day 11-12: 명령어 시스템**
- [ ] 명령어 파서 구현
- [ ] 기본 명령어 (`/start`, `/help`, `/status`)
- [ ] 관리자 권한 확인 시스템

**Day 13-14: 에러 처리 및 로깅**
- [ ] 포괄적 에러 핸들링 시스템
- [ ] 구조화된 로깅 구현
- [ ] 알림 시스템 (에러 발생 시)

### Week 3: Summary Feature Implementation
**Day 15-17: LLM 통합**
- [ ] OpenAI API 클라이언트 구현
- [ ] Claude API 클라이언트 구현
- [ ] API 응답 처리 및 에러 핸들링

**Day 18-19: 요약 알고리즘**
- [ ] 메시지 전처리 로직 (필터링, 정리)
- [ ] 컨텍스트 윈도우 관리
- [ ] 요약 품질 향상 프롬프트 엔지니어링

**Day 20-21: 스케줄링 시스템**
- [ ] 주기적 실행을 위한 cron job 설정
- [ ] Netlify 스케줄드 함수 구현
- [ ] 시간대 처리 및 설정 관리

### Week 4: Image Generation Feature
**Day 22-24: 이미지 API 통합**
- [ ] DALL-E API 클라이언트 구현
- [ ] 이미지 생성 파라미터 최적화
- [ ] 비동기 처리 시스템 (이미지 생성은 시간이 오래 걸림)

**Day 25-26: 이미지 처리**
- [ ] 이미지 다운로드 및 임시 저장
- [ ] 텔레그램 이미지 업로드 구현
- [ ] 이미지 메타데이터 데이터베이스 저장

**Day 27-28: 고급 기능**
- [ ] 스타일 프리셋 시스템
- [ ] 이미지 히스토리 조회 기능
- [ ] 배치 이미지 생성 (여러 개 한번에)

### Week 5: Testing & Deployment
**Day 29-31: 테스팅**
- [ ] 단위 테스트 작성 (Jest 사용)
- [ ] 통합 테스트 구현
- [ ] 로드 테스트 및 성능 최적화

**Day 32-33: 베타 테스트**
- [ ] 실제 그룹챗에서 베타 테스트
- [ ] 사용자 피드백 수집 및 반영
- [ ] 버그 수정 및 안정성 개선

**Day 34-35: 프로덕션 배포**
- [ ] 환경별 설정 분리 (dev/staging/prod)
- [ ] 모니터링 대시보드 설정
- [ ] 문서 최종 업데이트

## 🔧 기술적 고려사항

### 성능 최적화
**메시지 저장 최적화**
- 배치 삽입을 통한 DB 성능 향상
- 인덱스 최적화 (chat_id, timestamp)
- 오래된 메시지 자동 아카이빙

**API 호출 최적화**
- LLM API 호출 캐싱 시스템
- 레이트 리미팅 구현
- 비용 모니터링 및 알림

### 보안 고려사항
**API 키 관리**
- Netlify 환경변수를 통한 안전한 키 저장
- 키 로테이션 정책 수립
- 최소 권한 원칙 적용

**사용자 인증**
- 텔레그램 사용자 ID 검증
- 관리자 권한 시스템
- 스팸 방지 메커니즘

### 모니터링 및 관찰가능성
**메트릭 수집**
- 메시지 처리량 모니터링
- API 응답 시간 추적
- 에러율 모니터링

**로깅 전략**
- 구조화된 JSON 로깅
- 로그 레벨 분리 (ERROR, WARN, INFO, DEBUG)
- 민감한 정보 마스킹

## 💰 비용 추정

### Netlify Functions
- **무료 티어**: 월 125,000회 함수 실행
- **예상 사용량**: 10,000회/월 (여유 있음)
- **비용**: $0/월

### Supabase
- **무료 티어**: 500MB 데이터베이스, 2GB 대역폭
- **예상 사용량**: 100MB 데이터, 500MB 대역폭
- **비용**: $0/월

### LLM API 비용
- **OpenAI GPT-4**: ~$0.03/1K 토큰
- **예상 사용량**: 일 10회 요약, 회당 2K 토큰
- **월 비용**: ~$18

### 총 예상 비용
- **초기 개발**: $0 (무료 티어 활용)
- **월 운영비**: ~$20-30 (LLM API 사용량에 따라)

## 🚀 향후 확장 계획

### Phase 3: Advanced Features (6-8주차)
- **다국어 지원**: 자동 언어 감지 및 번역
- **감정 분석**: 그룹 분위기 모니터링
- **통계 대시보드**: 웹 기반 분석 도구

### Phase 4: Enterprise Features (9-12주차)
- **멀티 테넌시**: 여러 그룹 동시 관리
- **사용자 커스터마이제이션**: 개인별 설정
- **API 제공**: 서드파티 통합을 위한 REST API

## 📚 학습 리소스

### 필수 문서
- [grammY 공식 문서](https://grammy.dev/)
- [Supabase 함수 가이드](https://supabase.com/docs/guides/functions)
- [Netlify 함수 문서](https://docs.netlify.com/functions/overview/)

### 참고 프로젝트
- [Supabase 텔레그램 봇 예제](https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/telegram-bot)
- [grammY 웹훅 예제](https://github.com/grammyjs/examples)

이 개발 계획서는 프로젝트 진행 상황에 따라 지속적으로 업데이트됩니다.