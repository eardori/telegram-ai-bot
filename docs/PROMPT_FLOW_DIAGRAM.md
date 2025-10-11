# 프롬프트 템플릿 시스템 흐름도

## 전체 시스템 플로우

```mermaid
flowchart TD
    Start([사용자가 사진 업로드]) --> Analyze[Gemini 이미지 분석]
    Analyze --> ShowCategory[카테고리 버튼 표시<br/>5개 카테고리 + 전체보기]

    ShowCategory --> CategoryChoice{사용자 선택}

    CategoryChoice -->|특정 카테고리| CategoryList[해당 카테고리<br/>템플릿 목록<br/>8개/페이지]
    CategoryChoice -->|전체 38개 보기| AllList[전체 템플릿 목록<br/>8개/페이지]

    CategoryList --> TemplateSelect[템플릿 선택]
    AllList --> TemplateSelect

    TemplateSelect --> CheckType{템플릿 타입?}

    CheckType -->|고정형<br/>33개| DirectProcess[즉시 이미지 처리]
    CheckType -->|파라미터형<br/>8개| ShowParams[파라미터 선택 화면]

    ShowParams --> ParamCount{파라미터 개수?}

    ParamCount -->|1개<br/>4개 템플릿| ShowOptions1[옵션 목록 표시<br/>5-6개 옵션]
    ParamCount -->|2개<br/>1개 템플릿| ShowOptions2a[1단계: 첫 번째 파라미터<br/>옵션 선택]
    ParamCount -->|3개<br/>1개 템플릿| ShowOptions3a[1단계: 첫 번째 파라미터<br/>옵션 선택]

    ShowOptions1 --> SelectOption1[옵션 선택]
    ShowOptions2a --> SelectOption2a[옵션 선택]
    ShowOptions3a --> SelectOption3a[옵션 선택]

    SelectOption1 --> ProcessWithParam[파라미터 적용하여<br/>이미지 처리]

    SelectOption2a --> ShowOptions2b[2단계: 두 번째 파라미터<br/>옵션 선택]
    ShowOptions2b --> SelectOption2b[옵션 선택]
    SelectOption2b --> ProcessWithParam

    SelectOption3a --> ShowOptions3b[2단계: 두 번째 파라미터<br/>옵션 선택]
    ShowOptions3b --> SelectOption3b[옵션 선택]
    SelectOption3b --> ShowOptions3c[3단계: 세 번째 파라미터<br/>옵션 선택]
    ShowOptions3c --> SelectOption3c[옵션 선택]
    SelectOption3c --> ProcessWithParam

    DirectProcess --> CreditCheck{크레딧 확인}
    ProcessWithParam --> CreditCheck

    CreditCheck -->|부족| ShowPurchase[크레딧 구매 안내]
    CreditCheck -->|충분| Processing[🎨 AI 이미지 처리<br/>Replicate API]

    ShowPurchase --> End1([처리 종료])

    Processing --> Success{처리 결과?}

    Success -->|성공| DeductCredit[크레딧 차감]
    Success -->|실패| RefundCredit[크레딧 환불]

    DeductCredit --> ShowResult[✅ 결과 이미지 표시]
    RefundCredit --> ShowError[❌ 에러 메시지 표시]

    ShowResult --> RetryOffer[다시 시도 옵션]
    ShowError --> RetryOffer

    RetryOffer --> UserChoice{사용자 선택}
    UserChoice -->|같은 스타일| ProcessWithParam
    UserChoice -->|다른 스타일| ShowCategory
    UserChoice -->|종료| End2([처리 종료])
```

## 카테고리별 템플릿 분포

```mermaid
pie title 카테고리별 템플릿 분포 (총 41개)
    "이미지 편집" : 16
    "포트레이트 스타일링" : 12
    "크리에이티브 변환" : 6
    "3D 피규어" : 5
    "게임/애니메이션" : 2
```

## 파라미터형 vs 고정형

```mermaid
pie title 템플릿 타입 분포
    "고정형 (즉시 실행)" : 33
    "파라미터형 (옵션 선택)" : 8
```

## 파라미터형 템플릿 상세 플로우

```mermaid
flowchart TD
    Start([파라미터형 템플릿 선택]) --> FetchParams[DB에서 파라미터 조회<br/>template_parameters 테이블]

    FetchParams --> CheckParams{파라미터 존재?}

    CheckParams -->|없음| Error[❌ 구조 오류<br/>에러 표시]
    CheckParams -->|있음| GetFirstParam[첫 번째 파라미터 가져오기<br/>display_order로 정렬]

    GetFirstParam --> FetchOptions[해당 파라미터의<br/>옵션 목록 조회<br/>template_parameter_options]

    FetchOptions --> CheckOptions{옵션 존재?}

    CheckOptions -->|없음| Error
    CheckOptions -->|있음| BuildKeyboard[InlineKeyboard 생성<br/>한 줄에 1개 버튼]

    BuildKeyboard --> ShowUI["파라미터 선택 UI 표시<br/>🎨 템플릿명<br/>📋 파라미터명를 선택해주세요:<br/>[옵션1]<br/>[옵션2]<br/>...<br/>[뒤로가기]"]

    ShowUI --> UserSelect[사용자가 옵션 선택<br/>콜백: p:shortId]

    UserSelect --> DecodeCallback[shortId 디코딩<br/>template_key<br/>parameter_key<br/>option_key 추출]

    DecodeCallback --> CheckMoreParams{추가 파라미터?}

    CheckMoreParams -->|있음| SaveSelection[현재 선택 저장<br/>다음 파라미터로]
    CheckMoreParams -->|없음| BuildPrompt[최종 프롬프트 생성<br/>base_prompt + 선택된 옵션들]

    SaveSelection --> GetFirstParam

    BuildPrompt --> Execute[이미지 처리 실행]

    Error --> End([종료])
    Execute --> End
```

## 데이터베이스 구조

```mermaid
erDiagram
    PROMPT_TEMPLATES ||--o{ TEMPLATE_PARAMETERS : has
    TEMPLATE_PARAMETERS ||--o{ TEMPLATE_PARAMETER_OPTIONS : has

    PROMPT_TEMPLATES {
        string template_key PK
        string template_name_ko
        string template_name_en
        string category
        string subcategory
        string template_type "fixed or parameterized"
        text base_prompt
        int min_images
        int max_images
        boolean requires_face
        int priority
        boolean is_active
    }

    TEMPLATE_PARAMETERS {
        int id PK
        string template_key FK
        string parameter_key
        string parameter_name_ko
        string parameter_name_en
        string parameter_type "select, text, color"
        boolean is_required
        int display_order
    }

    TEMPLATE_PARAMETER_OPTIONS {
        int id PK
        int parameter_id FK
        string option_key
        string option_name_ko
        string option_name_en
        text prompt_fragment
        string emoji
        int display_order
    }
```

## 현재 파라미터형 템플릿 (8개)

```mermaid
flowchart LR
    subgraph "1개 파라미터 (6개)"
        A1[배경 변경<br/>6개 옵션]
        A2[의상 스타일링<br/>6개 옵션]
        A3[표정 변경<br/>5개 옵션]
        A4[계절 변경<br/>4개 옵션]
        A5[헤어스타일 변경<br/>6개 옵션]
        A6[오브젝트 추가<br/>6개 옵션]
    end

    subgraph "1개 파라미터 - 특수 (1개)"
        A7[오브젝트 제거<br/>6개 옵션]
    end

    subgraph "2개 파라미터 (1개)"
        B1[연필 스케치 변환<br/>스타일 6개 + 질감 4개]
    end

    subgraph "3개 파라미터 (1개)"
        C1[슈퍼히어로 9부작<br/>테마 6개 + 아트 4개 + 감정 3개]
    end
```

## 크레딧 시스템 플로우

```mermaid
flowchart TD
    Start([이미지 처리 시작]) --> CheckCredit{크레딧 확인<br/>user_credits 테이블}

    CheckCredit -->|0개| ShowPurchase[💳 크레딧 구매 안내<br/>패키지 목록 표시]
    CheckCredit -->|1개 이상| ReserveCredit[크레딧 예약<br/>아직 차감 안 함]

    ShowPurchase --> End1([종료])

    ReserveCredit --> Process[AI 이미지 처리<br/>Replicate API 호출]

    Process --> Result{처리 결과}

    Result -->|성공| Deduct[✅ 크레딧 1개 차감<br/>credit_transactions 기록<br/>type: usage]
    Result -->|실패| Refund[🔄 크레딧 환불<br/>credit_transactions 기록<br/>type: refund]

    Deduct --> ShowSuccess[처리된 이미지 전송]
    Refund --> ShowError[에러 메시지 전송<br/>크레딧 복구됨]

    ShowSuccess --> End2([종료])
    ShowError --> End2
```

## 페이지네이션 플로우

```mermaid
flowchart TD
    Start([템플릿 목록 표시]) --> CheckCount{템플릿 개수}

    CheckCount -->|8개 이하| ShowAll[전체 표시<br/>페이지네이션 없음]
    CheckCount -->|9개 이상| ShowPage1[1페이지 표시<br/>8개 템플릿]

    ShowPage1 --> Navigation["[← 이전] [1/N] [다음 →]<br/>[🔙 카테고리로]"]

    Navigation --> UserAction{사용자 액션}

    UserAction -->|다음| LoadNext[다음 페이지 로드<br/>템플릿 9-16번]
    UserAction -->|이전| LoadPrev[이전 페이지 로드]
    UserAction -->|카테고리로| BackToCat[카테고리 선택 화면]
    UserAction -->|템플릿 선택| SelectTemplate[템플릿 처리 시작]

    LoadNext --> ShowPageN[N페이지 표시<br/>8개 템플릿]
    LoadPrev --> ShowPageN

    ShowPageN --> Navigation

    ShowAll --> SelectTemplate
    BackToCat --> End1([카테고리 화면])
    SelectTemplate --> End2([템플릿 처리])
```

## 버튼 구조 및 네비게이션 플로우

```mermaid
flowchart TD
    Start([사진 업로드 완료]) --> AIButtons["🤖 AI 추천 3개<br/>[추천1] [추천2] [추천3]<br/>[카테고리로 둘러보기]"]

    AIButtons -->|카테고리로| CategoryScreen
    AIButtons -->|AI 추천 선택| TemplateProcess[템플릿 처리 실행]

    CategoryScreen["📂 카테고리 선택 화면<br/><br/>[🎭 3D/피규어]<br/>[👤 인물 스타일]<br/>[🎮 게임/애니메이션]<br/>[✂️ 이미지 편집]<br/>[🎨 창의적 변환]<br/><br/>[📋 전체 스타일 보기]"]

    CategoryScreen -->|카테고리 선택| CategoryList
    CategoryScreen -->|전체 스타일 보기| AllList

    CategoryList["📋 카테고리별 템플릿 리스트<br/>(8개/페이지)<br/><br/>[템플릿1] [템플릿2]<br/>[템플릿3] [템플릿4]<br/>...<br/><br/>페이지네이션:"]

    AllList["📋 전체 템플릿 리스트<br/>(8개/페이지)<br/><br/>[템플릿1] [템플릿2]<br/>[템플릿3] [템플릿4]<br/>...<br/><br/>페이지네이션:"]

    CategoryList --> Pagination1["[← 이전] [페이지 1/N] [다음 →]<br/>[🔙 카테고리로]"]
    AllList --> Pagination2["[← 이전] [페이지 1/N] [다음 →]<br/>[🔙 카테고리로]"]

    Pagination1 -->|이전/다음| CategoryList
    Pagination1 -->|카테고리로| CategoryScreen
    Pagination1 -->|템플릿 선택| CheckType{템플릿 타입?}

    Pagination2 -->|이전/다음| AllList
    Pagination2 -->|카테고리로| CategoryScreen
    Pagination2 -->|템플릿 선택| CheckType

    CheckType -->|고정형| TemplateProcess
    CheckType -->|파라미터형| ParamScreen1

    ParamScreen1["🎨 [템플릿명]<br/>📋 [파라미터명]를 선택해주세요:<br/><br/>[옵션1]<br/>[옵션2]<br/>[옵션3]<br/>...<br/><br/>[🔙 뒤로가기]"]

    ParamScreen1 -->|뒤로가기| CategoryList
    ParamScreen1 -->|옵션 선택| CheckMoreParams{추가 파라미터?}

    CheckMoreParams -->|있음| ParamScreen2["🎨 [템플릿명]<br/>📋 [다음 파라미터명]를 선택해주세요:<br/><br/>[옵션1]<br/>[옵션2]<br/>...<br/><br/>[🔙 뒤로가기]"]
    CheckMoreParams -->|없음| TemplateProcess

    ParamScreen2 -->|뒤로가기| ParamScreen1
    ParamScreen2 -->|옵션 선택| TemplateProcess

    TemplateProcess --> ResultScreen["✅ 처리 완료<br/><br/>[결과 이미지]<br/><br/>[🔄 같은 스타일로 다시]<br/>[🎨 다른 스타일 선택]<br/>[📸 원본으로 돌아가기]"]

    ResultScreen -->|같은 스타일로 다시| CheckType
    ResultScreen -->|다른 스타일 선택| CategoryScreen
    ResultScreen -->|원본으로| End([종료])

    style CategoryScreen fill:#e1f5ff
    style CategoryList fill:#fff4e1
    style AllList fill:#fff4e1
    style ParamScreen1 fill:#ffe1f5
    style ParamScreen2 fill:#ffe1f5
    style ResultScreen fill:#e1ffe1
```

## 버튼 레이아웃 규칙

### 1. AI 추천 버튼 (초기 화면)
- **배치**: 1줄 1버튼 (텍스트 길이 무관)
- **개수**: 3개 (AI 분석 기반)
- **하단**: "카테고리로 둘러보기" 버튼 (구분선 포함)

### 2. 카테고리 선택 버튼
- **배치**: 1줄 1버튼 (명확한 구분)
- **개수**: 5개 고정
- **하단**: "전체 스타일 보기" 버튼 (구분선 포함)

### 3. 템플릿 리스트 버튼
- **스마트 레이아웃 알고리즘**:
  - 짧은 텍스트 (≤10자): 3개/행
  - 중간 텍스트 (11-20자): 2개/행
  - 긴 텍스트 (>20자): 1개/행
  - 총 40자 초과 시 자동 줄바꿈
- **페이징**: 8개/페이지

### 4. 페이지네이션 버튼
- **배치**: [← 이전] [페이지 X/N] [다음 →] (1줄)
- **하단**: [🔙 카테고리로] (별도 줄)
- **동작**:
  - 첫 페이지: "이전" 버튼 비활성화
  - 마지막 페이지: "다음" 버튼 비활성화

### 5. 파라미터 선택 버튼
- **배치**: 1줄 1버튼 (명확한 선택)
- **개수**: 파라미터별 4-6개
- **하단**: [🔙 뒤로가기] (이전 화면으로)

### 6. 결과 화면 액션 버튼
- **배치**: 1줄 1버튼
- **고정 3개**:
  - 🔄 같은 스타일로 다시
  - 🎨 다른 스타일 선택
  - 📸 원본으로 돌아가기

### 7. 버튼 텍스트 규칙
- ✅ **이모지 제거** (2025-01-10 적용)
- 한국어 명확한 표현
- 20자 이내 권장
- 일관된 톤앤매너

---

## 🔍 구조 검증 체크리스트

### ✅ 정상 작동
- [x] 사진 업로드 및 Gemini AI 분석
- [x] AI 기반 스타일 추천 (3개)
- [x] 카테고리별 템플릿 표시 (5개 카테고리)
- [x] 전체 템플릿 목록 표시 (41개)
- [x] 페이지네이션 (8개/페이지)
- [x] 스마트 버튼 레이아웃 (텍스트 길이 기반)
- [x] 고정형 템플릿 즉시 실행 (33개)
- [x] 파라미터형 템플릿 옵션 표시 (8개)
- [x] 단일 파라미터 선택 (6개 템플릿)
- [x] 멀티 파라미터 단계별 선택 (2개 템플릿)
- [x] back_to_main (카테고리로) 버튼 핸들러
- [x] 크레딧 체크 및 차감
- [x] 이미지 처리 및 결과 표시 (Replicate API)
- [x] 에러 처리 및 크레딧 환불

### 🎯 최근 추가된 기능 (2025-01-10)
- [x] **5개 파라미터형 템플릿 추가**:
  - 계절 변경 (4계절 옵션)
  - 헤어스타일 변경 (6가지 스타일)
  - 오브젝트 추가 (6가지 객체)
  - 오브젝트 제거 (6가지 제거 타입)
  - 텍스트 편집 (텍스트 입력 타입)
- [x] **버튼 UX 개선**:
  - 모든 버튼에서 이모지 제거 (모바일 최적화)
  - 스마트 레이아웃 알고리즘 적용
  - 1줄 1버튼 파라미터 선택
- [x] **back_to_main 핸들러 추가**:
  - "카테고리로" 버튼 오류 수정
  - 카테고리 선택 화면으로 복귀

### ⚠️ 개선 필요
- [ ] text_edit 텍스트 입력 타입 핸들러 (현재 select만 지원)
- [ ] 파라미터 필수/선택 명확한 표시
- [ ] 선택한 옵션 확인 화면
- [ ] 옵션 미리보기 이미지
- [ ] 템플릿 사용 통계 추적
- [ ] 관리자 프롬프트 관리 시스템

### 📊 현재 통계 (2025-01-10)
- **총 템플릿**: 41개
- **고정형**: 33개 (80.5%)
- **파라미터형**: 8개 (19.5%)
- **총 파라미터**: 14개
- **총 옵션**: 73개
- **카테고리**: 5개

---

**마지막 업데이트**: 2025-01-10
**변경 사항**:
- 파라미터형 템플릿 6개 → 8개 업데이트
- 버튼 구조 및 네비게이션 플로우 다이어그램 추가
- 버튼 레이아웃 규칙 7가지 문서화
- 최근 기능 추가 내역 반영
