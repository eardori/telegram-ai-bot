/**
 * Credit Manager Service
 *
 * Handles credit operations: check, deduct, add, get packages/plans
 */

import { supabase } from '../utils/supabase';

export interface CreditPackage {
  id: number;
  package_key: string;
  package_name_ko: string;
  package_name_en?: string;
  credits: number;
  price_stars: number;
  bonus_credits: number;
  is_popular: boolean;
  badge?: string;
  display_order: number;
}

export interface SubscriptionPlan {
  id: number;
  plan_key: string;
  plan_name_ko: string;
  plan_name_en?: string;
  credits_per_month: number;
  price_stars: number;
  billing_period: string;
  features?: Record<string, any>;
  is_popular: boolean;
  badge?: string;
  display_order: number;
}

export interface DeductResult {
  success: boolean;
  remaining_credits: number;
  message: string;
}

/**
 * Deduct credits from user
 */
export async function deductCredit(
  userId: number,
  amount: number = 1,
  templateKey?: string,
  editId?: number
): Promise<DeductResult> {
  try {
    console.log(`💳 Deducting ${amount} credits from user ${userId}...`);

    // Call PostgreSQL function
    const { data, error } = await supabase
      .rpc('deduct_credit', {
        p_user_id: userId,
        p_amount: amount,
        p_template_key: templateKey,
        p_edit_id: editId
      });

    if (error) {
      console.error('❌ Error deducting credits:', error);
      return {
        success: false,
        remaining_credits: 0,
        message: `Failed to deduct credits: ${error.message}`
      };
    }

    const result = data[0];

    if (result.success) {
      console.log(`✅ Credits deducted: ${amount}, remaining: ${result.remaining_credits}`);
    } else {
      console.warn(`⚠️ Credit deduction failed: ${result.message}`);
    }

    return {
      success: result.success,
      remaining_credits: result.remaining_credits,
      message: result.message
    };

  } catch (error) {
    console.error('❌ Error in deductCredit:', error);
    return {
      success: false,
      remaining_credits: 0,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Add credits to user
 */
export async function addCredits(
  userId: number,
  amount: number,
  creditType: 'free' | 'paid',
  description?: string,
  packageKey?: string
): Promise<{ success: boolean; new_balance: number; message: string }> {
  try {
    console.log(`💰 Adding ${amount} ${creditType} credits to user ${userId}...`);

    // Call PostgreSQL function
    const { data, error } = await supabase
      .rpc('add_credits', {
        p_user_id: userId,
        p_amount: amount,
        p_credit_type: creditType,
        p_description: description,
        p_package_key: packageKey
      });

    if (error) {
      console.error('❌ Error adding credits:', error);
      return {
        success: false,
        new_balance: 0,
        message: `Failed to add credits: ${error.message}`
      };
    }

    const result = data[0];

    if (result.success) {
      console.log(`✅ Credits added: ${amount}, new balance: ${result.new_balance}`);
    }

    return {
      success: result.success,
      new_balance: result.new_balance,
      message: result.message
    };

  } catch (error) {
    console.error('❌ Error in addCredits:', error);
    return {
      success: false,
      new_balance: 0,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get user's current credit balance
 */
export async function getCreditBalance(userId: number): Promise<{
  free_credits: number;
  paid_credits: number;
  total_credits: number;
  subscription_type?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('v_user_total_credits')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      console.error('❌ Error fetching credit balance:', error);
      return {
        free_credits: 0,
        paid_credits: 0,
        total_credits: 0
      };
    }

    return {
      free_credits: data.free_credits || 0,
      paid_credits: data.paid_credits || 0,
      total_credits: data.total_credits || 0,
      subscription_type: data.subscription_type
    };

  } catch (error) {
    console.error('❌ Error in getCreditBalance:', error);
    return {
      free_credits: 0,
      paid_credits: 0,
      total_credits: 0
    };
  }
}

/**
 * Get all active credit packages
 */
export async function getActivePackages(): Promise<CreditPackage[]> {
  try {
    const { data, error } = await supabase
      .from('credit_packages')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('❌ Error fetching packages:', error);
      return [];
    }

    return data as CreditPackage[];

  } catch (error) {
    console.error('❌ Error in getActivePackages:', error);
    return [];
  }
}

/**
 * Get all active subscription plans
 */
export async function getActiveSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  try {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('❌ Error fetching subscription plans:', error);
      return [];
    }

    return data as SubscriptionPlan[];

  } catch (error) {
    console.error('❌ Error in getActiveSubscriptionPlans:', error);
    return [];
  }
}

/**
 * Get package by key
 */
export async function getPackageByKey(packageKey: string): Promise<CreditPackage | null> {
  try {
    const { data, error } = await supabase
      .from('credit_packages')
      .select('*')
      .eq('package_key', packageKey)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }

    return data as CreditPackage;

  } catch (error) {
    console.error('❌ Error in getPackageByKey:', error);
    return null;
  }
}

/**
 * Get subscription plan by key
 */
export async function getPlanByKey(planKey: string): Promise<SubscriptionPlan | null> {
  try {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('plan_key', planKey)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }

    return data as SubscriptionPlan;

  } catch (error) {
    console.error('❌ Error in getPlanByKey:', error);
    return null;
  }
}

/**
 * Get user's credit transaction history
 */
export async function getTransactionHistory(
  userId: number,
  limit: number = 10
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Error fetching transaction history:', error);
      return [];
    }

    return data || [];

  } catch (error) {
    console.error('❌ Error in getTransactionHistory:', error);
    return [];
  }
}

/**
 * Format credits for display
 */
export function formatCredits(credits: number): string {
  if (credits === -1) {
    return '무제한';
  }
  return `${credits}회`;
}

/**
 * Calculate price per credit
 */
export function calculatePricePerCredit(stars: number, credits: number): number {
  const usdPrice = stars * 0.013; // 1 Star = $0.013
  return usdPrice / credits;
}

/**
 * Get discount percentage for package
 */
export function getDiscountPercentage(pkg: CreditPackage): number {
  const basePrice = 100 * 0.013; // 스타터 팩 기준가 (100 Stars)
  const baseCredits = 30;
  const basePricePerCredit = basePrice / baseCredits; // $0.0433/credit

  const pkgPricePerCredit = calculatePricePerCredit(pkg.price_stars, pkg.credits);
  const discount = ((basePricePerCredit - pkgPricePerCredit) / basePricePerCredit) * 100;

  return Math.round(discount);
}
