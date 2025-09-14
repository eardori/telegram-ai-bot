// 2단계 응답 패턴 - 이미지 편집용

// 현재 문제:
// Gemini Vision (3초) + Imagen (7초) = 10초 초과

// 해결 방법:
// 1단계: 분석 결과만 먼저 전송 (5초 내)
// 2단계: 사용자가 확인 후 이미지 생성 요청

// 수정된 플로우:
async function handleImageEditingTwoStage(ctx: any, photo: any, editRequest: string) {
  // 1단계: 빠른 분석과 프롬프트 생성
  const imageBase64 = await downloadImage(photo);

  const analysisPrompt = `User request: "${editRequest}"
Output a SHORT prompt (max 20 words).`;

  const visionResponse = await callGeminiVision(imageBase64, analysisPrompt, 3000); // 3초 제한

  const generatedPrompt = visionResponse.text;

  // 분석 결과를 먼저 보내고 종료
  await ctx.reply(`✅ **이미지 분석 완료!**

📝 생성된 프롬프트: "${generatedPrompt}"

✨ 이 프롬프트로 이미지를 생성하려면:
➡️ \`/generate ${generatedPrompt}\`

또는 직접 수정해서:
➡️ \`/generate [수정된 프롬프트]\``);

  return { statusCode: 200 }; // 즉시 종료
}

// 별도 명령어로 이미지 생성
bot.command('generate', async (ctx) => {
  const prompt = ctx.message.text.replace('/generate', '').trim();

  if (!prompt) {
    await ctx.reply('사용법: /generate [프롬프트]');
    return;
  }

  const msg = await ctx.reply('🎨 이미지 생성 중...');

  try {
    const image = await generateImageWithImagen(prompt);
    await ctx.replyWithPhoto(image);
    await ctx.deleteMessage(msg.message_id);
  } catch (error) {
    await ctx.reply('❌ 생성 실패. 다시 시도해주세요.');
  }
});