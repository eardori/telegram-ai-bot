// 이미지 편집 수정 사항

// 1. 타임아웃 문제 해결
// - Gemini Vision 타임아웃: 15초 → 5초
// - 프롬프트 단순화 요청

// 2. 중복 핸들러 통합
// - 첫 번째 핸들러 제거
// - 두 번째 핸들러만 사용

// 3. 프롬프트 단순화
const simplifiedAnalysisPrompt = `
Analyze this image and the user's request: "${editRequest}"

Create a SHORT, SIMPLE English prompt (max 30 words) for image generation that:
1. Describes the main subject
2. Applies the requested change
3. Keep it concise

Output ONLY the prompt, nothing else.`;

// 4. Base64 처리 수정
const imageBuffer = imageResult.imageData.includes('base64,')
  ? Buffer.from(imageResult.imageData.split('base64,')[1], 'base64')
  : Buffer.from(imageResult.imageData, 'base64');

// 5. 타임아웃 단축
const visionResponse = await fetchWithTimeout(
  geminiUrl,
  options,
  5000 // 5초로 단축
);