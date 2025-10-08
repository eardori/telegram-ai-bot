/**
 * Image Edit Credit Wrapper
 *
 * Wraps image editing operations with credit checks and deductions
 * Handles both private chats and group chats (FOMO strategy)
 */

import { Context } from 'grammy';
import { registerUser, getUserWithCredits } from './auth-service';
import { deductCredit, getCreditBalance } from './credit-manager';
import {
  hasUsedGroupFreeTrial,
  recordGroupFreeTrial,
  generateFOMOMessage,
  generateTrialSuccessMessage
} from './group-fomo-service';

export interface CreditCheckResult {
  canProceed: boolean;
  isRegistered: boolean;
  isFreeTrial: boolean;
  remainingCredits?: number;
  message?: string;
  shouldShowPurchaseOptions?: boolean;
}

/**
 * Check if user can proceed with image editing
 * Handles credit checks and group FOMO logic
 */
export async function checkCreditsBeforeEdit(
  ctx: Context,
  templateKey?: string
): Promise<CreditCheckResult> {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;

  if (!userId || !chatId) {
    return {
      canProceed: false,
      isRegistered: false,
      isFreeTrial: false,
      message: '사용자 정보를 확인할 수 없습니다.'
    };
  }

  const isGroupChat = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';

  // Get or register user
  const { user, credits, isNewUser } = await registerUser(
    userId,
    ctx.from?.username,
    ctx.from?.first_name,
    ctx.from?.last_name,
    ctx.from?.language_code
  );

  if (isNewUser) {
    // New user just registered, has 5 free credits
    return {
      canProceed: true,
      isRegistered: true,
      isFreeTrial: false,
      remainingCredits: credits.total_credits,
      message: `🎉 가입을 환영합니다!\n\n🎁 무료 크레딧 ${credits.total_credits}개를 드렸습니다!`
    };
  }

  // Check if user has credits
  const totalCredits = credits.total_credits || 0;

  if (totalCredits > 0) {
    // User has credits, can proceed
    return {
      canProceed: true,
      isRegistered: true,
      isFreeTrial: false,
      remainingCredits: totalCredits
    };
  }

  // User has no credits
  if (isGroupChat) {
    // GROUP CHAT FOMO STRATEGY
    const hasUsedTrial = await hasUsedGroupFreeTrial(userId, chatId);

    if (hasUsedTrial) {
      // Already used trial in this group
      return {
        canProceed: false,
        isRegistered: false,
        isFreeTrial: false,
        message: generateFOMOMessage([], true),
        shouldShowPurchaseOptions: true
      };
    }

    // First time in this group - allow free trial
    return {
      canProceed: true,
      isRegistered: false,
      isFreeTrial: true,
      message: '🎁 첫 체험 무료!'
    };
  } else {
    // PRIVATE CHAT - Need to purchase
    return {
      canProceed: false,
      isRegistered: true,
      isFreeTrial: false,
      message: '💳 크레딧이 부족합니다!\n\n크레딧을 충전하시면 계속 사용하실 수 있습니다.',
      shouldShowPurchaseOptions: true
    };
  }
}

/**
 * Deduct credit after successful image edit
 * Handles regular users and group free trials
 */
export async function deductCreditAfterEdit(
  ctx: Context,
  templateKey: string,
  editId?: number,
  isFreeTrial: boolean = false
): Promise<{
  success: boolean;
  remainingCredits: number;
  message?: string;
}> {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;

  if (!userId || !chatId) {
    return {
      success: false,
      remainingCredits: 0,
      message: '사용자 정보를 확인할 수 없습니다.'
    };
  }

  const isGroupChat = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';

  if (isFreeTrial && isGroupChat) {
    // Record group free trial
    const recorded = await recordGroupFreeTrial(userId, chatId, templateKey);

    if (!recorded) {
      console.error('❌ Failed to record group free trial');
    }

    return {
      success: true,
      remainingCredits: 0,
      message: generateTrialSuccessMessage()
    };
  }

  // Regular credit deduction
  const result = await deductCredit(userId, 1, templateKey, editId);

  return {
    success: result.success,
    remainingCredits: result.remaining_credits,
    message: result.success
      ? `✅ 편집 완료!\n\n💳 남은 크레딧: ${result.remaining_credits}회`
      : `❌ ${result.message}`
  };
}

/**
 * Get formatted credit balance message
 */
export async function getCreditBalanceMessage(userId: number): Promise<string> {
  const balance = await getCreditBalance(userId);

  let message = `💳 **크레딧 잔액**\n\n`;

  if (balance.free_credits > 0) {
    message += `🎁 무료 크레딧: ${balance.free_credits}회\n`;
  }

  if (balance.paid_credits > 0) {
    message += `💰 충전 크레딧: ${balance.paid_credits}회\n`;
  }

  if (balance.subscription_type) {
    message += `⭐ 구독: ${balance.subscription_type}\n`;
  }

  message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📊 총 사용 가능: **${balance.total_credits}회**`;

  return message;
}

/**
 * Send credit deduction notification to user
 * For group chats, send as DM
 */
export async function notifyCreditDeduction(
  ctx: Context,
  remainingCredits: number,
  isGroupChat: boolean
): Promise<void> {
  const message = `✅ 크레딧 1회 차감\n💳 남은 크레딧: ${remainingCredits}회`;

  if (isGroupChat && ctx.from?.id) {
    // Send DM in group chat
    try {
      await ctx.api.sendMessage(ctx.from.id, message);
    } catch (error) {
      console.warn('⚠️ Could not send DM to user:', error);
      // Fallback: mention user in group
      await ctx.reply(message, {
        reply_to_message_id: ctx.message?.message_id
      });
    }
  } else {
    // Send in current chat
    await ctx.reply(message);
  }
}
