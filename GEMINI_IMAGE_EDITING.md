# Gemini Image Editing API 핵심 정보

## ✅ Gemini는 직접 이미지 편집 가능
- **모델명**: `gemini-2.5-flash-image-preview`
- 입력 이미지를 실제로 편집해서 새 이미지 반환
- 텍스트 설명이 아닌 실제 편집된 이미지 출력

## 📝 API 요청 형식

### JavaScript 예제:
```javascript
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          {
            text: "Edit this image: [편집 요청]"
          },
          {
            inline_data: {  // 또는 inlineData
              mime_type: 'image/jpeg',
              data: base64Image
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 8192
      }
    })
  }
);
```

## 📤 응답 형식

편집된 이미지는 응답에 포함:
```javascript
const editedImage = response.candidates[0].content.parts.find(
  part => part.inline_data || part.inlineData
);

// editedImage.inline_data.data = base64 인코딩된 편집 이미지
```

## 🎯 성공 조건

1. **올바른 모델 사용**: `gemini-2.5-flash-image-preview`
2. **구체적인 편집 요청**: "비키니 수영복으로 변경" 같은 명확한 지시
3. **적절한 프롬프트**:
   - ❌ "분석해줘" → 텍스트 응답
   - ✅ "Edit this image: [변경사항]" → 이미지 응답

## ⚠️ 제한사항

- 최대 3개 이미지 입력
- SynthID 워터마크 자동 추가
- 권장 언어: EN, es-MX, ja-JP, zh-CN, hi-IN, ko-KR

## 🔍 현재 코드 문제

현재 코드는 올바르게 구현되어 있지만, Gemini가 때때로 텍스트만 반환하는 이유:
1. 프롬프트가 편집 요청이 아닌 분석 요청으로 해석
2. 편집이 너무 복잡하거나 불가능한 경우
3. API가 일시적으로 이미지 생성 실패

## 💡 개선 방안

프롬프트를 더 명확하게:
```javascript
text: `Generate an edited version of this image with the following changes: ${editRequest}
Return the edited image, not a text description.`
```