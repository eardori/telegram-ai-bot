# 📋 AI 사진 편집 기능 구현 작업 리스트

## 🎯 프로젝트 목표
38개의 고품질 프롬프트 템플릿을 활용한 지능형 사진 편집 서비스 구현

---

## 📌 Phase 0: 사전 준비 작업

### 🔧 인프라 설정
- [ ] **CLAUDE.md 파일 생성**
  - 세션 기억 기능 미작동 이슈 문서화
  - 향후 해결 방안 기록

- [ ] **환경 변수 추가**
  ```bash
  NANO_BANAFO_API_KEY=
  NANO_BANAFO_API_URL=
  IMAGE_EDIT_TIMEOUT=30000
  MAX_CONCURRENT_EDITS=3
  ```

- [ ] **프로젝트 구조 생성**
  ```bash
  mkdir -p src/services/image-edit
  mkdir -p src/handlers/image-edit
  mkdir -p src/types/image-edit
  ```

---

## 📌 Phase 1: 데이터베이스 및 타입 정의 (Day 1-2)

### 📊 데이터베이스 스키마

#### Task 1.1: 기본 테이블 생성
- [ ] **008_image_edit_schema.sql 작성**
  ```sql
  -- 프롬프트 템플릿 테이블
  CREATE TABLE prompt_templates (
    id SERIAL PRIMARY KEY,
    template_key VARCHAR(50) UNIQUE NOT NULL,
    template_name_ko TEXT NOT NULL,
    template_name_en TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    base_prompt TEXT NOT NULL,
    example_prompt TEXT,
    variables JSONB DEFAULT '[]',
    requirements JSONB DEFAULT '{}',
    priority INTEGER DEFAULT 0,
    usage_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

#### Task 1.2: 38개 템플릿 데이터 입력
- [ ] **009_insert_prompt_templates.sql 작성**
  - 피규어 만들기 템플릿 (프롬프트 #1)
  - 레드카펫 템플릿 (프롬프트 #2)
  - 밤 인물사진 템플릿 (프롬프트 #3)
  - ... (총 38개)

#### Task 1.3: TypeScript 타입 정의
- [ ] **src/types/image-edit/prompt.types.ts**
  ```typescript
  export interface PromptTemplate {
    id: number;
    templateKey: string;
    templateNameKo: string;
    templateNameEn: string;
    category: PromptCategory;
    basePrompt: string;
    examplePrompt?: string;
    variables: PromptVariable[];
    requirements: TemplateRequirements;
    priority: number;
    usageCount: number;
    successRate?: number;
    isActive: boolean;
  }
  ```

- [ ] **src/types/image-edit/analysis.types.ts**
  ```typescript
  export interface ImageAnalysis {
    imageCount: number;
    faces: FaceAnalysis;
    objects: DetectedObject[];
    scene: SceneDescription;
    composition: CompositionAnalysis;
    quality: QualityMetrics;
    suggestedCategories: string[];
  }
  ```

---

## 📌 Phase 2: 이미지 분석 서비스 (Day 3-5)

### 🔍 분석 엔진 구현

#### Task 2.1: Gemini Vision 통합
- [ ] **src/services/image-edit/image-analyzer.ts**
  ```typescript
  export class ImageAnalyzer {
    async analyze(imageBuffer: Buffer): Promise<ImageAnalysis>
    private async detectFaces(imageBase64: string): Promise<FaceAnalysis>
    private async analyzeScene(imageBase64: string): Promise<SceneDescription>
    private async assessQuality(imageBuffer: Buffer): Promise<QualityMetrics>
  }
  ```

#### Task 2.2: 분석 결과 처리
- [ ] **src/services/image-edit/analysis-processor.ts**
  - 원시 API 응답을 구조화된 데이터로 변환
  - 신뢰도 점수 계산
  - 카테고리 자동 분류

#### Task 2.3: 다중 이미지 분석
- [ ] **src/services/image-edit/multi-image-analyzer.ts**
  - 여러 이미지 동시 분석
  - 이미지 간 관계 파악
  - 합성 가능성 평가

---

## 📌 Phase 3: 프롬프트 추천 시스템 (Day 6-8)

### 🎯 추천 엔진 구현

#### Task 3.1: 템플릿 매칭 엔진
- [ ] **src/services/image-edit/template-matcher.ts**
  ```typescript
  export class TemplateMatcher {
    async matchTemplates(analysis: ImageAnalysis): Promise<MatchedTemplate[]>
    private calculateCompatibilityScore(template: PromptTemplate, analysis: ImageAnalysis): number
    private checkRequirements(template: PromptTemplate, analysis: ImageAnalysis): boolean
  }
  ```

#### Task 3.2: 추천 알고리즘
- [ ] **src/services/image-edit/recommendation-engine.ts**
  - 이미지 분석 결과 기반 점수 계산 (40%)
  - 사용자 히스토리 기반 개인화 (30%)
  - 템플릿 인기도 반영 (20%)
  - 신규성 보너스 (10%)

#### Task 3.3: 동적 프롬프트 생성
- [ ] **src/services/image-edit/prompt-builder.ts**
  ```typescript
  export class PromptBuilder {
    build(template: PromptTemplate, userInput?: string): string
    private replaceVariables(prompt: string, variables: Record<string, string>): string
    private optimizeForAPI(prompt: string): string
  }
  ```

---

## 📌 Phase 4: 사용자 인터페이스 (Day 9-11)

### 💬 Telegram Bot 핸들러

#### Task 4.1: 사진 수신 핸들러
- [ ] **src/handlers/image-edit/photo-handler.ts**
  ```typescript
  bot.on('message:photo', async (ctx) => {
    // 1. 이미지 다운로드
    // 2. 자동 분석 시작
    // 3. 추천 생성
    // 4. 인라인 키보드 표시
  });
  ```

#### Task 4.2: 인라인 키보드 구현
- [ ] **src/handlers/image-edit/keyboard-builder.ts**
  - 추천 옵션을 버튼으로 표시
  - 카테고리별 그룹핑
  - 페이지네이션 (5개씩)

#### Task 4.3: 선택 처리 핸들러
- [ ] **src/handlers/image-edit/selection-handler.ts**
  ```typescript
  bot.on('callback_query:data', async (ctx) => {
    // 1. 선택된 템플릿 확인
    // 2. 추가 옵션 필요 여부 확인
    // 3. 편집 실행 또는 추가 입력 요청
  });
  ```

#### Task 4.4: 다중 이미지 처리
- [ ] **src/handlers/image-edit/multi-image-handler.ts**
  - 여러 장 업로드 감지
  - 이미지 조합 제안
  - 순서 지정 인터페이스

---

## 📌 Phase 5: 편집 실행 엔진 (Day 12-14)

### 🎨 Nano Banafo API 통합

#### Task 5.1: API 클라이언트
- [ ] **src/services/image-edit/nano-banafo-client.ts**
  ```typescript
  export class NanoBanafoClient {
    async editImage(imageBuffer: Buffer, prompt: string): Promise<Buffer>
    async editMultipleImages(images: Buffer[], prompt: string): Promise<Buffer>
    private handleAPIError(error: any): void
    private retryWithBackoff(fn: Function, retries: number): Promise<any>
  }
  ```

#### Task 5.2: 편집 실행 관리자
- [ ] **src/services/image-edit/edit-executor.ts**
  - 큐 관리 시스템
  - 동시 실행 제한
  - 진행 상황 추적

#### Task 5.3: 결과 후처리
- [ ] **src/services/image-edit/result-processor.ts**
  - 이미지 품질 검증
  - 크기 최적화
  - 포맷 변환 (필요시)

---

## 📌 Phase 6: 고급 기능 (Day 15-17)

### ⚙️ 추가 기능 구현

#### Task 6.1: 편집 히스토리
- [ ] **src/services/image-edit/history-manager.ts**
  - 사용자별 편집 이력 저장
  - 재편집 기능
  - 즐겨찾기 템플릿

#### Task 6.2: 배치 처리
- [ ] **src/services/image-edit/batch-processor.ts**
  - 여러 템플릿 동시 적용
  - 비교 이미지 생성
  - A/B 테스트 모드

#### Task 6.3: 피드백 시스템
- [ ] **src/services/image-edit/feedback-collector.ts**
  - 평점 수집 (1-5)
  - 템플릿 개선 제안
  - 자동 학습 데이터 수집

---

## 📌 Phase 7: 최적화 및 성능 (Day 18-20)

### ⚡ 성능 최적화

#### Task 7.1: 캐싱 시스템
- [ ] **src/services/image-edit/cache-manager.ts**
  - Redis 기반 분석 결과 캐싱
  - 유사 이미지 감지
  - 프롬프트 결과 캐싱

#### Task 7.2: 이미지 최적화
- [ ] **src/services/image-edit/image-optimizer.ts**
  - 자동 리사이징
  - 포맷 최적화
  - 압축 알고리즘

#### Task 7.3: 비동기 처리
- [ ] **src/services/image-edit/async-processor.ts**
  - 백그라운드 작업 큐
  - 웹훅 기반 알림
  - 실시간 진행률 업데이트

---

## 📌 Phase 8: 테스트 및 배포 (Day 21-25)

### 🧪 테스트

#### Task 8.1: 단위 테스트
- [ ] **tests/unit/image-analyzer.test.ts**
- [ ] **tests/unit/template-matcher.test.ts**
- [ ] **tests/unit/prompt-builder.test.ts**

#### Task 8.2: 통합 테스트
- [ ] **tests/integration/edit-workflow.test.ts**
- [ ] **tests/integration/multi-image.test.ts**

#### Task 8.3: E2E 테스트
- [ ] **tests/e2e/telegram-bot.test.ts**
- [ ] 실제 이미지로 전체 플로우 테스트

### 🚀 배포

#### Task 8.4: 배포 준비
- [ ] 환경 변수 설정
- [ ] API 키 암호화
- [ ] 로깅 시스템 구성

#### Task 8.5: 단계별 롤아웃
- [ ] Stage 1: 내부 테스트 (5명)
- [ ] Stage 2: 베타 테스트 (50명)
- [ ] Stage 3: 전체 배포

---

## 📊 우선순위 매트릭스

### 🔴 Critical (즉시 구현)
1. 데이터베이스 스키마 및 38개 템플릿 입력
2. 이미지 분석 서비스
3. 기본 프롬프트 추천
4. 단일 이미지 편집 실행

### 🟡 Important (1주 내)
1. 인라인 키보드 UI
2. 다중 이미지 처리
3. 편집 히스토리
4. 에러 처리 및 재시도

### 🟢 Nice to Have (2주 내)
1. 배치 처리
2. 캐싱 시스템
3. A/B 테스트
4. 고급 분석 기능

---

## 🎯 성공 지표

### Week 1 목표
- [ ] 38개 템플릿 모두 DB에 저장
- [ ] 이미지 분석 정확도 85% 달성
- [ ] 5개 이상 추천 생성 가능

### Week 2 목표
- [ ] 편집 성공률 80% 이상
- [ ] 평균 처리 시간 25초 이내
- [ ] 사용자 만족도 4.0/5.0

### Week 3 목표
- [ ] 일일 처리량 500건 이상
- [ ] 시스템 안정성 99.5%
- [ ] 전체 기능 배포 완료

---

## 📝 체크포인트

### Daily Standup Questions
1. 어제 완료한 작업은?
2. 오늘 진행할 작업은?
3. 블로커가 있는가?

### Weekly Review Points
1. 계획 대비 진행률
2. 품질 지표 달성도
3. 사용자 피드백 반영
4. 다음 주 우선순위 조정

---

## 🔄 반복 개선 사항

### 지속적 개선
- [ ] 매주 사용자 피드백 수집
- [ ] 템플릿 성공률 분석
- [ ] 프롬프트 최적화
- [ ] 새로운 템플릿 추가

### 모니터링
- [ ] API 응답 시간
- [ ] 오류율 추적
- [ ] 사용 패턴 분석
- [ ] 비용 최적화

---

## 🚨 리스크 관리

### 기술적 리스크
| 리스크 | 확률 | 영향 | 대응 방안 |
|--------|------|------|----------|
| Nano Banafo API 불안정 | 중 | 높음 | 대체 API 준비 (Gemini) |
| 이미지 분석 부정확 | 낮음 | 중간 | 수동 보정 옵션 |
| 처리 시간 초과 | 중 | 높음 | 비동기 처리 및 알림 |
| 비용 초과 | 낮음 | 중간 | 일일 한도 설정 |

### 비즈니스 리스크
| 리스크 | 확률 | 영향 | 대응 방안 |
|--------|------|------|----------|
| 낮은 사용률 | 중 | 높음 | 마케팅 및 홍보 |
| 부정적 피드백 | 낮음 | 중간 | 빠른 개선 및 대응 |
| 경쟁 서비스 출현 | 중 | 중간 | 독특한 기능 차별화 |

---

## 📅 마일스톤

### Milestone 1: MVP (Day 7)
- 기본 이미지 분석
- 5개 핵심 템플릿
- 단일 이미지 편집

### Milestone 2: Beta (Day 14)
- 전체 38개 템플릿
- 다중 이미지 지원
- 인라인 키보드 UI

### Milestone 3: Production (Day 21)
- 전체 기능 완성
- 성능 최적화
- 모니터링 시스템

### Milestone 4: Scale (Day 30)
- 일일 1000건 처리
- 99.9% 가용성
- 자동화된 개선 시스템

---

*작성일: 2024년 12월*
*버전: 1.0.0*
*작성자: AI Photo Edit Team*