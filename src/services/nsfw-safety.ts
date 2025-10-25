/**
 * NSFW Safety Service
 *
 * Handles age verification, consent tracking, and usage limits for NSFW features.
 * Ensures legal compliance and user safety.
 */

import { supabase } from '../utils/supabase';

export interface NSFWLimitCheck {
  can_use: boolean;
  remaining_count: number;
  daily_limit: number;
  used_today: number;
}

export interface NSFWConsentStatus {
  consent_given: boolean;
  age_verified: boolean;
  enabled: boolean;
  consent_date?: string;
}

class NSFWSafetyService {
  /**
   * Check if user has given NSFW consent
   */
  async checkConsent(userId: number): Promise<NSFWConsentStatus> {
    const { data, error } = await supabase
      .from('users')
      .select('nsfw_consent_given, nsfw_age_verified, nsfw_enabled, nsfw_consent_date')
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.error('Error checking NSFW consent:', error);
      return {
        consent_given: false,
        age_verified: false,
        enabled: false,
      };
    }

    return {
      consent_given: data.nsfw_consent_given || false,
      age_verified: data.nsfw_age_verified || false,
      enabled: data.nsfw_enabled !== false, // Default to true if null
      consent_date: data.nsfw_consent_date,
    };
  }

  /**
   * Grant NSFW consent after age verification
   */
  async grantConsent(userId: number, ageVerified: boolean = true): Promise<boolean> {
    const { data, error } = await supabase.rpc('grant_nsfw_consent', {
      p_user_id: userId,
      p_age_verified: ageVerified,
    });

    if (error) {
      console.error('Error granting NSFW consent:', error);
      return false;
    }

    console.log(`✅ NSFW consent granted for user ${userId}`);
    return true;
  }

  /**
   * Check daily usage limit
   */
  async checkDailyLimit(userId: number): Promise<NSFWLimitCheck> {
    const { data, error } = await supabase.rpc('check_nsfw_daily_limit', {
      p_user_id: userId,
    });

    if (error || !data || data.length === 0) {
      console.error('Error checking NSFW daily limit:', error);
      return {
        can_use: false,
        remaining_count: 0,
        daily_limit: 5,
        used_today: 0,
      };
    }

    return data[0];
  }

  /**
   * Record NSFW usage
   */
  async recordUsage(
    userId: number,
    templateKey: string,
    prompt: string,
    success: boolean = true,
    errorMessage?: string,
    generationTimeMs?: number
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc('record_nsfw_usage', {
      p_user_id: userId,
      p_template_key: templateKey,
      p_prompt: prompt,
      p_success: success,
      p_error_message: errorMessage || null,
      p_generation_time_ms: generationTimeMs || null,
    });

    if (error) {
      console.error('Error recording NSFW usage:', error);
      return false;
    }

    console.log(`📊 NSFW usage recorded: user=${userId}, template=${templateKey}, success=${success}`);
    return true;
  }

  /**
   * Check if user can use NSFW features (full verification)
   */
  async canUseNSFW(userId: number): Promise<{
    allowed: boolean;
    reason?: string;
    consent_status?: NSFWConsentStatus;
    limit_check?: NSFWLimitCheck;
  }> {
    // 1. Check consent
    const consentStatus = await this.checkConsent(userId);

    if (!consentStatus.enabled) {
      return {
        allowed: false,
        reason: 'nsfw_disabled',
        consent_status: consentStatus,
      };
    }

    if (!consentStatus.consent_given) {
      return {
        allowed: false,
        reason: 'no_consent',
        consent_status: consentStatus,
      };
    }

    if (!consentStatus.age_verified) {
      return {
        allowed: false,
        reason: 'age_not_verified',
        consent_status: consentStatus,
      };
    }

    // 2. Check daily limit
    const limitCheck = await this.checkDailyLimit(userId);

    if (!limitCheck.can_use) {
      return {
        allowed: false,
        reason: 'daily_limit_exceeded',
        consent_status: consentStatus,
        limit_check: limitCheck,
      };
    }

    // All checks passed
    return {
      allowed: true,
      consent_status: consentStatus,
      limit_check: limitCheck,
    };
  }

  /**
   * Format consent request message (Korean)
   */
  getConsentMessageKo(): string {
    return `⚠️ **성인 전용 기능 안내**

이 기능은 **만 19세 이상**만 사용할 수 있습니다.

**주의사항:**
• 성인 컨텐츠가 포함될 수 있습니다
• 불법적인 용도로 사용할 수 없습니다
• 타인에게 불쾌감을 주는 컨텐츠는 제한됩니다
• 남용 시 계정이 정지될 수 있습니다

**개인정보 보호:**
• 생성된 이미지는 저장되지 않습니다
• 사용 통계만 익명으로 수집됩니다

만 19세 이상이며, 위 내용에 동의하시나요?`;
  }

  /**
   * Format consent request message (English)
   */
  getConsentMessageEn(): string {
    return `⚠️ **Adult Content Warning**

This feature is restricted to users **19 years or older**.

**Terms of Use:**
• May contain adult content
• Cannot be used for illegal purposes
• Offensive content may be restricted
• Account may be suspended for abuse

**Privacy:**
• Generated images are not stored
• Only anonymous usage statistics are collected

Are you 19 years or older and agree to these terms?`;
  }

  /**
   * Format limit exceeded message (Korean)
   */
  getLimitExceededMessageKo(limitCheck: NSFWLimitCheck): string {
    return `❌ **일일 사용 한도 초과**

오늘 사용 가능한 NSFW 크레딧을 모두 사용했습니다.

📊 **오늘의 사용량:**
• 사용: ${limitCheck.used_today}회
• 한도: ${limitCheck.daily_limit}회
• 남은 횟수: 0회

⏰ **내일 다시 사용 가능합니다**

💎 **무제한 사용을 원하신다면:**
• VIP 구독으로 일일 제한 없이 사용하세요
• /credits 명령어로 구독 플랜 확인`;
  }

  /**
   * Format limit exceeded message (English)
   */
  getLimitExceededMessageEn(limitCheck: NSFWLimitCheck): string {
    return `❌ **Daily Limit Exceeded**

You've used all your NSFW credits for today.

📊 **Today's Usage:**
• Used: ${limitCheck.used_today} times
• Limit: ${limitCheck.daily_limit} times
• Remaining: 0 times

⏰ **Available again tomorrow**

💎 **Want unlimited access?**
• Subscribe to VIP for no daily limits
• Check plans with /credits command`;
  }
}

// Export singleton instance
export const nsfwSafetyService = new NSFWSafetyService();
