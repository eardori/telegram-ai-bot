/**
 * Authentication & User Registration Service
 *
 * Handles user registration, free credit allocation, and user verification
 */

import { supabase } from '../utils/supabase';

export interface User {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
  is_premium?: boolean;
  created_at: Date;
}

export interface UserCredits {
  user_id: number;
  free_credits: number;
  paid_credits: number;
  subscription_credits: number;
  total_credits: number;
  subscription_type?: string;
  subscription_status?: string;
}

const SIGNUP_FREE_CREDITS = 5; // 신규 가입 시 무료 크레딧

/**
 * Register a new user or return existing user
 */
export async function registerUser(
  userId: number,
  username?: string,
  firstName?: string,
  lastName?: string,
  languageCode?: string
): Promise<{ user: User; credits: UserCredits; isNewUser: boolean }> {
  try {
    // 1. 기존 유저 확인
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (existingUser && !userError) {
      // 기존 유저: 크레딧 정보 조회
      const { data: credits } = await supabase
        .from('v_user_total_credits')
        .select('*')
        .eq('user_id', userId)
        .single();

      return {
        user: existingUser as User,
        credits: credits as UserCredits || {
          user_id: userId,
          free_credits: 0,
          paid_credits: 0,
          subscription_credits: 0,
          total_credits: 0
        },
        isNewUser: false
      };
    }

    // 2. 신규 유저 등록
    const { data: newUser, error: insertUserError } = await supabase
      .from('users')
      .insert({
        id: userId,
        username: username,
        first_name: firstName,
        last_name: lastName,
        language_code: languageCode,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertUserError) {
      console.error('❌ Error inserting user:', insertUserError);
      throw new Error(`Failed to register user: ${insertUserError.message}`);
    }

    // 3. 무료 크레딧 지급
    const { data: newCredits, error: insertCreditsError } = await supabase
      .from('user_credits')
      .insert({
        user_id: userId,
        free_credits: SIGNUP_FREE_CREDITS,
        paid_credits: 0,
        subscription_credits: 0,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertCreditsError) {
      console.error('❌ Error inserting credits:', insertCreditsError);
      throw new Error(`Failed to allocate credits: ${insertCreditsError.message}`);
    }

    // 4. 가입 보너스 거래 기록
    await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        transaction_type: 'signup',
        credit_type: 'free',
        amount: SIGNUP_FREE_CREDITS,
        balance_after: SIGNUP_FREE_CREDITS,
        description: 'Signup bonus',
        created_at: new Date().toISOString()
      });

    console.log(`✅ New user registered: ${userId}, ${SIGNUP_FREE_CREDITS} free credits allocated`);

    return {
      user: newUser as User,
      credits: {
        user_id: userId,
        free_credits: SIGNUP_FREE_CREDITS,
        paid_credits: 0,
        subscription_credits: 0,
        total_credits: SIGNUP_FREE_CREDITS
      },
      isNewUser: true
    };

  } catch (error) {
    console.error('❌ Error in registerUser:', error);
    throw error;
  }
}

/**
 * Get user with credits info
 */
export async function getUserWithCredits(userId: number): Promise<{
  user: User | null;
  credits: UserCredits | null;
}> {
  try {
    // 유저 정보 조회
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return { user: null, credits: null };
    }

    // 크레딧 정보 조회
    const { data: credits, error: creditsError } = await supabase
      .from('v_user_total_credits')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (creditsError || !credits) {
      return { user: user as User, credits: null };
    }

    return {
      user: user as User,
      credits: credits as UserCredits
    };

  } catch (error) {
    console.error('❌ Error in getUserWithCredits:', error);
    return { user: null, credits: null };
  }
}

/**
 * Check if user has enough credits
 */
export async function hasEnoughCredits(
  userId: number,
  requiredAmount: number = 1
): Promise<{ hasEnough: boolean; currentCredits: number }> {
  try {
    const { data, error } = await supabase
      .from('v_user_total_credits')
      .select('total_credits')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return { hasEnough: false, currentCredits: 0 };
    }

    const totalCredits = data.total_credits || 0;

    return {
      hasEnough: totalCredits >= requiredAmount,
      currentCredits: totalCredits
    };

  } catch (error) {
    console.error('❌ Error checking credits:', error);
    return { hasEnough: false, currentCredits: 0 };
  }
}

/**
 * Update user's last active timestamp
 */
export async function updateLastActive(userId: number): Promise<void> {
  try {
    await supabase
      .from('users')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', userId);
  } catch (error) {
    console.error('❌ Error updating last active:', error);
  }
}
