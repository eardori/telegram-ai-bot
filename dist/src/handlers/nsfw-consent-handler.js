"use strict";
/**
 * NSFW Consent Handler
 *
 * Handles age verification and consent for NSFW features
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerNSFWConsentHandlers = registerNSFWConsentHandlers;
exports.checkNSFWAccess = checkNSFWAccess;
exports.executeWithNSFWTracking = executeWithNSFWTracking;
const grammy_1 = require("grammy");
const nsfw_safety_1 = require("../services/nsfw-safety");
const i18n_helper_1 = require("../utils/i18n-helper");
/**
 * Register NSFW consent handlers
 */
function registerNSFWConsentHandlers(bot) {
    // ============================================
    // Callback: Show NSFW consent dialog
    // ============================================
    bot.callbackQuery(/^nsfw:request_consent$/, async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId)
            return;
        console.log(`🔞 User ${userId} requested NSFW consent dialog`);
        const lang = (0, i18n_helper_1.getUserLanguage)(ctx);
        const message = lang === 'ko'
            ? nsfw_safety_1.nsfwSafetyService.getConsentMessageKo()
            : nsfw_safety_1.nsfwSafetyService.getConsentMessageEn();
        const keyboard = new grammy_1.InlineKeyboard()
            .text(lang === 'ko' ? '✅ 네, 동의합니다 (19세 이상)' : '✅ Yes, I agree (19+)', 'nsfw:consent:yes')
            .row()
            .text(lang === 'ko' ? '❌ 아니오' : '❌ No', 'nsfw:consent:no');
        try {
            await ctx.editMessageText(message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard,
            });
            await ctx.answerCallbackQuery();
        }
        catch (error) {
            console.error('Error showing NSFW consent dialog:', error);
            await ctx.answerCallbackQuery({
                text: lang === 'ko' ? '오류가 발생했습니다' : 'An error occurred',
            });
        }
    });
    // ============================================
    // Callback: User agreed to NSFW consent
    // ============================================
    bot.callbackQuery(/^nsfw:consent:yes$/, async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId)
            return;
        console.log(`✅ User ${userId} agreed to NSFW consent`);
        const lang = (0, i18n_helper_1.getUserLanguage)(ctx);
        try {
            // Grant consent in database
            const success = await nsfw_safety_1.nsfwSafetyService.grantConsent(userId, true);
            if (success) {
                const limitCheck = await nsfw_safety_1.nsfwSafetyService.checkDailyLimit(userId);
                const successMessage = lang === 'ko'
                    ? `✅ **NSFW 기능이 활성화되었습니다!**

**일일 사용 한도:**
• 무료 사용자: ${limitCheck.daily_limit}회/일
• VIP 회원: 무제한

**오늘 남은 횟수:** ${limitCheck.remaining_count}회

이제 성인 전용 이미지 편집 기능을 사용할 수 있습니다.
사진을 업로드하여 시작하세요!`
                    : `✅ **NSFW features enabled!**

**Daily Limits:**
• Free users: ${limitCheck.daily_limit} times/day
• VIP members: Unlimited

**Remaining today:** ${limitCheck.remaining_count} times

You can now use adult content editing features.
Upload a photo to get started!`;
                await ctx.editMessageText(successMessage, {
                    parse_mode: 'Markdown',
                });
            }
            else {
                throw new Error('Failed to grant consent');
            }
            await ctx.answerCallbackQuery({
                text: lang === 'ko' ? '✅ NSFW 기능 활성화됨' : '✅ NSFW features enabled',
            });
        }
        catch (error) {
            console.error('Error granting NSFW consent:', error);
            await ctx.answerCallbackQuery({
                text: lang === 'ko' ? '오류가 발생했습니다' : 'An error occurred',
            });
        }
    });
    // ============================================
    // Callback: User declined NSFW consent
    // ============================================
    bot.callbackQuery(/^nsfw:consent:no$/, async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId)
            return;
        console.log(`❌ User ${userId} declined NSFW consent`);
        const lang = (0, i18n_helper_1.getUserLanguage)(ctx);
        const message = lang === 'ko'
            ? `⚠️ NSFW 기능을 사용하려면 만 19세 이상이어야 하며 동의가 필요합니다.

일반 이미지 편집 기능은 계속 사용하실 수 있습니다.
사진을 업로드하여 시작하세요!`
            : `⚠️ You must be 19+ and agree to use NSFW features.

You can still use regular image editing features.
Upload a photo to get started!`;
        try {
            await ctx.editMessageText(message, {
                parse_mode: 'Markdown',
            });
            await ctx.answerCallbackQuery();
        }
        catch (error) {
            console.error('Error handling NSFW decline:', error);
        }
    });
    console.log('✅ NSFW consent handlers registered');
}
/**
 * Check if user can access NSFW template and show appropriate message
 */
async function checkNSFWAccess(ctx, userId, templateKey) {
    const lang = (0, i18n_helper_1.getUserLanguage)(ctx);
    // Check if template requires NSFW
    // (This will be checked against prompt_templates.requires_nsfw_api)
    // For now, we'll assume any template with 'nsfw' in the key requires it
    const requiresNSFW = templateKey.includes('nsfw') || templateKey.includes('adult');
    if (!requiresNSFW) {
        return true; // Not an NSFW template, allow access
    }
    // Check NSFW access
    const accessCheck = await nsfw_safety_1.nsfwSafetyService.canUseNSFW(userId);
    if (accessCheck.allowed) {
        return true; // User has access
    }
    // User doesn't have access - show appropriate message
    const { reason, consent_status, limit_check } = accessCheck;
    if (reason === 'no_consent') {
        // Show consent dialog
        const message = lang === 'ko'
            ? '⚠️ 이 기능은 성인 전용입니다. 나이 인증이 필요합니다.'
            : '⚠️ This feature is for adults only. Age verification required.';
        const keyboard = new grammy_1.InlineKeyboard().text(lang === 'ko' ? '🔞 나이 인증하기' : '🔞 Verify Age', 'nsfw:request_consent');
        await ctx.reply(message, {
            reply_markup: keyboard,
        });
        return false;
    }
    if (reason === 'daily_limit_exceeded' && limit_check) {
        const message = lang === 'ko'
            ? nsfw_safety_1.nsfwSafetyService.getLimitExceededMessageKo(limit_check)
            : nsfw_safety_1.nsfwSafetyService.getLimitExceededMessageEn(limit_check);
        await ctx.reply(message, {
            parse_mode: 'Markdown',
        });
        return false;
    }
    if (reason === 'nsfw_disabled') {
        const message = lang === 'ko'
            ? '❌ NSFW 기능이 비활성화되었습니다. 관리자에게 문의하세요.'
            : '❌ NSFW features are disabled. Please contact support.';
        await ctx.reply(message);
        return false;
    }
    // Unknown reason
    const message = lang === 'ko'
        ? '❌ NSFW 기능을 사용할 수 없습니다.'
        : '❌ Cannot use NSFW features.';
    await ctx.reply(message);
    return false;
}
/**
 * Wrap NSFW template execution with safety checks and usage tracking
 */
async function executeWithNSFWTracking(userId, templateKey, prompt, execution) {
    const startTime = Date.now();
    let success = false;
    let errorMessage;
    try {
        const result = await execution();
        success = true;
        return result;
    }
    catch (error) {
        success = false;
        errorMessage = error.message || 'Unknown error';
        throw error;
    }
    finally {
        const generationTime = Date.now() - startTime;
        // Record usage (fire and forget)
        nsfw_safety_1.nsfwSafetyService.recordUsage(userId, templateKey, prompt, success, errorMessage, generationTime).catch(err => {
            console.error('Failed to record NSFW usage:', err);
        });
    }
}
