"use strict";
/**
 * Replicate Webhook Handler
 *
 * Receives webhook notifications from Replicate API when async predictions complete.
 * Updates database and sends results to users via Telegram.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const grammy_1 = require("grammy");
const supabase_1 = require("../../src/utils/supabase");
// Bot instance
const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
const bot = new grammy_1.Bot(BOT_TOKEN);
const handler = async (event, context) => {
    console.log('🔔 Replicate webhook received');
    // Only accept POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }
    try {
        const payload = JSON.parse(event.body || '{}');
        console.log(`📦 Webhook payload:`, {
            id: payload.id,
            status: payload.status,
            hasOutput: !!payload.output
        });
        // Get generation record from database
        const { data: generation, error: fetchError } = await supabase_1.supabase
            .from('nsfw_generations')
            .select('*')
            .eq('prediction_id', payload.id)
            .single();
        if (fetchError || !generation) {
            console.error('❌ Generation record not found:', payload.id);
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Generation not found' })
            };
        }
        console.log(`📋 Found generation record for user ${generation.user_id}`);
        // Handle different statuses
        if (payload.status === 'succeeded') {
            console.log('✅ Prediction succeeded');
            // Extract output URLs
            const output = payload.output;
            const outputUrls = Array.isArray(output) ? output : [output];
            // Update database
            const { error: updateError } = await supabase_1.supabase
                .from('nsfw_generations')
                .update({
                status: 'completed',
                output_url: outputUrls[0],
                completed_at: new Date().toISOString()
            })
                .eq('prediction_id', payload.id);
            if (updateError) {
                console.error('❌ Failed to update database:', updateError);
            }
            // Send result to user
            try {
                const processingTime = payload.metrics?.predict_time
                    ? Math.round(payload.metrics.predict_time * 1000)
                    : 0;
                const caption = `✨ **NSFW ${generation.type === 'video' ? '비디오' : '이미지'} 생성 완료!**

📝 **프롬프트**: "${generation.prompt}"
⏱️ **처리시간**: ${processingTime}ms
🎨 **모델**: Replicate ${generation.model_version || 'SDXL'}

🔞 **주의**: 이 콘텐츠는 성인용입니다.`;
                if (generation.type === 'video' || generation.type === 'image_to_video') {
                    // Send video
                    await bot.api.sendVideo(generation.chat_id, outputUrls[0], {
                        caption
                    });
                }
                else {
                    // Send image(s)
                    for (const url of outputUrls) {
                        await bot.api.sendPhoto(generation.chat_id, url, {
                            caption: outputUrls.length === 1 ? caption : undefined
                        });
                    }
                    // Send caption separately if multiple images
                    if (outputUrls.length > 1) {
                        await bot.api.sendMessage(generation.chat_id, caption);
                    }
                }
                console.log('✅ Result sent to user successfully');
            }
            catch (sendError) {
                console.error('❌ Failed to send result to user:', sendError);
                // Try to send error message
                try {
                    await bot.api.sendMessage(generation.chat_id, '❌ **생성은 완료되었으나 전송 중 오류가 발생했습니다.**\n\n' +
                        '잠시 후 다시 시도해주세요.');
                }
                catch {
                    console.error('❌ Failed to send error message to user');
                }
            }
        }
        else if (payload.status === 'failed') {
            console.log('❌ Prediction failed');
            // Update database
            const { error: updateError } = await supabase_1.supabase
                .from('nsfw_generations')
                .update({
                status: 'failed',
                error_message: payload.error || 'Unknown error',
                completed_at: new Date().toISOString()
            })
                .eq('prediction_id', payload.id);
            if (updateError) {
                console.error('❌ Failed to update database:', updateError);
            }
            // Notify user
            try {
                await bot.api.sendMessage(generation.chat_id, `❌ **NSFW 생성 실패**

오류: ${payload.error || 'Unknown error'}

💡 다른 프롬프트로 다시 시도해주세요.`);
            }
            catch (sendError) {
                console.error('❌ Failed to send error message:', sendError);
            }
        }
        else {
            // processing, starting, etc.
            console.log(`⏳ Prediction status: ${payload.status}`);
            // Update status in database
            const { error: updateError } = await supabase_1.supabase
                .from('nsfw_generations')
                .update({
                status: payload.status === 'starting' || payload.status === 'processing' ? 'processing' : payload.status
            })
                .eq('prediction_id', payload.id);
            if (updateError) {
                console.error('❌ Failed to update status:', updateError);
            }
        }
        return {
            statusCode: 200,
            body: JSON.stringify({ received: true, status: payload.status })
        };
    }
    catch (error) {
        console.error('❌ Webhook processing error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            })
        };
    }
};
exports.handler = handler;
