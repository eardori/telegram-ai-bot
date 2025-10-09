/**
 * Group FOMO Service
 *
 * Manages group-based free trials for viral marketing
 * Strategy: Non-registered users can try once per group, creating FOMO
 */

import { supabase } from '../utils/supabase';

export interface GroupFreeTrial {
  id: number;
  user_id: number;
  group_id: number;
  template_key?: string;
  used_at: Date;
  converted_to_paid: boolean;
  converted_at?: Date;
}

/**
 * Check if user has used free trial in this group
 */
export async function hasUsedGroupFreeTrial(
  userId: number,
  groupId: number
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('group_free_trials')
      .select('id')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('❌ Error checking group free trial:', error);
      return false;
    }

    return !!data;

  } catch (error) {
    console.error('❌ Error in hasUsedGroupFreeTrial:', error);
    return false;
  }
}

/**
 * Record group free trial usage
 */
export async function recordGroupFreeTrial(
  userId: number,
  groupId: number,
  templateKey?: string
): Promise<boolean> {
  try {
    console.log(`🎁 Recording group free trial: user ${userId}, group ${groupId}`);

    const { error } = await supabase
      .from('group_free_trials')
      .insert({
        user_id: userId,
        group_id: groupId,
        template_key: templateKey,
        used_at: new Date().toISOString(),
        converted_to_paid: false
      });

    if (error) {
      // Duplicate key error is expected if user tries twice
      if (error.code === '23505') {
        console.warn(`⚠️ User ${userId} already used trial in group ${groupId}`);
        return false;
      }

      console.error('❌ Error recording group free trial:', error);
      return false;
    }

    console.log(`✅ Group free trial recorded for user ${userId}`);
    return true;

  } catch (error) {
    console.error('❌ Error in recordGroupFreeTrial:', error);
    return false;
  }
}

/**
 * Mark user as converted (registered and purchased)
 */
export async function markAsConverted(
  userId: number,
  groupId: number
): Promise<void> {
  try {
    await supabase
      .from('group_free_trials')
      .update({
        converted_to_paid: true,
        converted_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('group_id', groupId);

    console.log(`✅ User ${userId} marked as converted in group ${groupId}`);

  } catch (error) {
    console.error('❌ Error in markAsConverted:', error);
  }
}

/**
 * Get group conversion statistics
 */
export async function getGroupStats(groupId: number): Promise<{
  total_trials: number;
  converted_users: number;
  conversion_rate: number;
}> {
  try {
    const { data, error } = await supabase
      .from('group_free_trials')
      .select('converted_to_paid')
      .eq('group_id', groupId);

    if (error || !data) {
      return { total_trials: 0, converted_users: 0, conversion_rate: 0 };
    }

    const total_trials = data.length;
    const converted_users = data.filter(trial => trial.converted_to_paid).length;
    const conversion_rate = total_trials > 0 ? (converted_users / total_trials) * 100 : 0;

    return {
      total_trials,
      converted_users,
      conversion_rate: Math.round(conversion_rate * 10) / 10
    };

  } catch (error) {
    console.error('❌ Error in getGroupStats:', error);
    return { total_trials: 0, converted_users: 0, conversion_rate: 0 };
  }
}

/**
 * Get all groups where user tried for free
 */
export async function getUserTrialGroups(userId: number): Promise<number[]> {
  try {
    const { data, error } = await supabase
      .from('group_free_trials')
      .select('group_id')
      .eq('user_id', userId);

    if (error || !data) {
      return [];
    }

    return data.map(trial => trial.group_id);

  } catch (error) {
    console.error('❌ Error in getUserTrialGroups:', error);
    return [];
  }
}

/**
 * Get registered users in a group (for social proof messaging)
 */
export async function getRegisteredUsersInGroup(groupId: number): Promise<number[]> {
  try {
    // This would require tracking group members
    // For now, we'll return users who have used credits in this group
    const { data, error } = await supabase
      .from('group_free_trials')
      .select('user_id')
      .eq('group_id', groupId)
      .eq('converted_to_paid', true);

    if (error || !data) {
      return [];
    }

    return data.map(trial => trial.user_id);

  } catch (error) {
    console.error('❌ Error in getRegisteredUsersInGroup:', error);
    return [];
  }
}

/**
 * Generate FOMO message for non-registered user
 */
export function generateFOMOMessage(
  registeredUsernames: string[],
  hasUsedTrial: boolean
): string {
  if (hasUsedTrial) {
    // User already used their free trial
    if (registeredUsernames.length > 0) {
      const userList = registeredUsernames.slice(0, 3).join('님, ') + '님';
      return `⚠️ 무료 체험은 1회만 가능합니다!\n\n` +
        `😊 계속 사용하시려면:\n` +
        `• 개인 대화에서 가입하시면 즉시 5회 무료!\n` +
        `• 지금 가입한 ${userList}처럼 함께 즐기세요!\n\n` +
        `[🚀 지금 가입하기]`;
    } else {
      return `⚠️ 무료 체험은 1회만 가능합니다!\n\n` +
        `🚀 지금 가입하면 즉시 5회 무료!\n\n` +
        `[지금 가입하기]`;
    }
  } else {
    // First time user
    return `🎁 **첫 체험 무료!**\n\n` +
      `⚠️ 무료 체험은 1회만 가능합니다.\n` +
      `💡 가입하시면 즉시 5회 무료 크레딧을 드립니다!\n\n` +
      `[🚀 지금 가입하기]`;
  }
}

/**
 * Generate success message after free trial
 */
export function generateTrialSuccessMessage(): string {
  return `✅ 편집 완료! 첫 무료 체험을 사용하셨습니다.\n\n` +
    `💡 더 많은 편집을 원하시면?\n` +
    `개인 대화에서 가입하시면 즉시 5회 무료!`;
}

/**
 * Get signup button for free trial message
 */
export function getSignupButton(botUsername: string = 'multifulaibot') {
  return {
    text: '🚀 지금 가입하고 5회 더 받기',
    url: `https://t.me/${botUsername}?start=group_signup`
  };
}
