/**
 * Admin Credit Management Service
 * Grant or revoke credits for CS purposes
 */

import { supabase } from '../utils/supabase';
import { addCredits } from './credit-manager';
import { CreditGrantRequest, CreditGrantResult } from '../types/admin.types';

/**
 * Grant credits to a user (CS compensation, promotion, etc.)
 */
export async function grantCredits(request: CreditGrantRequest): Promise<CreditGrantResult> {
  try {
    const { userId, amount, reason, grantedBy } = request;

    // Get current balance
    const { data: currentCredits } = await supabase
      .from('user_credits')
      .select('free_credits, paid_credits, subscription_credits')
      .eq('user_id', userId)
      .single();

    if (!currentCredits) {
      return {
        success: false,
        userId,
        amountGranted: 0,
        previousBalance: 0,
        newBalance: 0,
        message: '사용자를 찾을 수 없습니다.'
      };
    }

    const previousBalance =
      (currentCredits.free_credits || 0) +
      (currentCredits.paid_credits || 0) +
      (currentCredits.subscription_credits || 0);

    // Grant credits using existing addCredits function
    const result = await addCredits(
      userId,
      amount,
      'free', // Grant as free credits
      `Admin grant: ${reason}`,
      undefined // No package key
    );

    if (!result.success) {
      return {
        success: false,
        userId,
        amountGranted: 0,
        previousBalance,
        newBalance: previousBalance,
        message: result.message
      };
    }

    // Log admin activity
    await logAdminActivity({
      adminUserId: grantedBy,
      action: 'credit_grant',
      targetUserId: userId,
      details: {
        amount,
        reason,
        previousBalance,
        newBalance: result.new_balance
      }
    });

    return {
      success: true,
      userId,
      amountGranted: amount,
      previousBalance,
      newBalance: result.new_balance,
      message: `✅ 크레딧 ${amount}회가 성공적으로 지급되었습니다.`
    };

  } catch (error) {
    console.error('❌ Error granting credits:', error);
    return {
      success: false,
      userId: request.userId,
      amountGranted: 0,
      previousBalance: 0,
      newBalance: 0,
      message: '크레딧 지급 중 오류가 발생했습니다.'
    };
  }
}

/**
 * Revoke credits from a user (abuse, refund, etc.)
 */
export async function revokeCredits(
  userId: number,
  amount: number,
  reason: string,
  revokedBy: number
): Promise<CreditGrantResult> {
  try {
    // Get current credits
    const { data: credits, error } = await supabase
      .from('user_credits')
      .select('free_credits, paid_credits')
      .eq('user_id', userId)
      .single();

    if (error || !credits) {
      return {
        success: false,
        userId,
        amountGranted: 0,
        previousBalance: 0,
        newBalance: 0,
        message: '사용자를 찾을 수 없습니다.'
      };
    }

    const previousBalance = (credits.free_credits || 0) + (credits.paid_credits || 0);

    // Deduct from free credits first, then paid
    let freeToDeduct = Math.min(amount, credits.free_credits || 0);
    let paidToDeduct = amount - freeToDeduct;

    if (paidToDeduct > (credits.paid_credits || 0)) {
      return {
        success: false,
        userId,
        amountGranted: 0,
        previousBalance,
        newBalance: previousBalance,
        message: '회수할 크레딧이 부족합니다.'
      };
    }

    // Update credits
    const { error: updateError } = await supabase
      .from('user_credits')
      .update({
        free_credits: (credits.free_credits || 0) - freeToDeduct,
        paid_credits: (credits.paid_credits || 0) - paidToDeduct,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      throw updateError;
    }

    const newBalance = previousBalance - amount;

    // Record transaction
    await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        transaction_type: 'revoke',
        credit_type: 'free',
        amount: -amount,
        balance_after: newBalance,
        description: `Admin revoke: ${reason}`,
        created_at: new Date().toISOString()
      });

    // Log admin activity
    await logAdminActivity({
      adminUserId: revokedBy,
      action: 'credit_revoke',
      targetUserId: userId,
      details: {
        amount,
        reason,
        previousBalance,
        newBalance
      }
    });

    return {
      success: true,
      userId,
      amountGranted: -amount,
      previousBalance,
      newBalance,
      message: `✅ 크레딧 ${amount}회가 성공적으로 회수되었습니다.`
    };

  } catch (error) {
    console.error('❌ Error revoking credits:', error);
    return {
      success: false,
      userId,
      amountGranted: 0,
      previousBalance: 0,
      newBalance: 0,
      message: '크레딧 회수 중 오류가 발생했습니다.'
    };
  }
}

/**
 * Format credit grant result as Telegram message
 */
export function formatCreditGrantMessage(result: CreditGrantResult, username?: string): string {
  if (!result.success) {
    return `❌ **크레딧 지급 실패**\n\n${result.message}`;
  }

  let message = `✅ **크레딧 지급 완료**\n\n`;
  message += `• 대상: `;
  if (username) message += `@${username} `;
  message += `(ID: ${result.userId})\n`;
  message += `• 지급 크레딧: ${result.amountGranted}회\n`;
  message += `• 지급 전: ${result.previousBalance}회\n`;
  message += `• 지급 후: ${result.newBalance}회\n\n`;
  message += `사용자에게 DM이 발송됩니다.`;

  return message;
}

/**
 * Send DM to user about credit grant
 */
export async function notifyUserCreditGrant(
  bot: any,
  userId: number,
  amount: number,
  reason: string
): Promise<boolean> {
  try {
    const message =
      `🎁 **크레딧 지급 알림**\n\n` +
      `${amount}회의 크레딧이 지급되었습니다!\n\n` +
      `사유: ${reason}\n\n` +
      `지급된 크레딧은 즉시 사용하실 수 있습니다.`;

    await bot.api.sendMessage(userId, message, { parse_mode: 'Markdown' });
    return true;
  } catch (error) {
    console.warn('⚠️ Could not send DM to user:', error);
    return false;
  }
}

/**
 * Log admin activity for audit trail
 */
async function logAdminActivity(activity: {
  adminUserId: number;
  action: string;
  targetUserId?: number;
  details: Record<string, any>;
}) {
  try {
    // Check if admin_activity_log table exists, if not skip logging
    await supabase
      .from('admin_activity_log')
      .insert({
        admin_user_id: activity.adminUserId,
        action_type: activity.action,
        target_user_id: activity.targetUserId,
        action_details: activity.details,
        created_at: new Date().toISOString()
      });
  } catch (error) {
    // Table might not exist yet, silently skip
    console.warn('⚠️ Admin activity log skipped (table may not exist)');
  }
}
