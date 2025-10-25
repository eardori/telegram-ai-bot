"use strict";
/**
 * Authentication & User Registration Service
 *
 * Handles user registration, free credit allocation, and user verification
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUser = registerUser;
exports.getUserWithCredits = getUserWithCredits;
exports.hasEnoughCredits = hasEnoughCredits;
exports.updateLastActive = updateLastActive;
const supabase_1 = require("../utils/supabase");
const SIGNUP_FREE_CREDITS = 5; // 신규 가입 시 무료 크레딧
/**
 * Register a new user or return existing user
 */
async function registerUser(userId, username, firstName, lastName, languageCode) {
    try {
        // 1. 기존 유저 확인
        const { data: existingUser, error: userError } = await supabase_1.supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        if (existingUser && !userError) {
            // 기존 유저: 크레딧 정보 조회
            const { data: credits } = await supabase_1.supabase
                .from('v_user_total_credits')
                .select('*')
                .eq('user_id', userId)
                .single();
            return {
                user: existingUser,
                credits: credits || {
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
        const { data: newUser, error: insertUserError } = await supabase_1.supabase
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
        const { data: newCredits, error: insertCreditsError } = await supabase_1.supabase
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
        await supabase_1.supabase
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
            user: newUser,
            credits: {
                user_id: userId,
                free_credits: SIGNUP_FREE_CREDITS,
                paid_credits: 0,
                subscription_credits: 0,
                total_credits: SIGNUP_FREE_CREDITS
            },
            isNewUser: true
        };
    }
    catch (error) {
        console.error('❌ Error in registerUser:', error);
        throw error;
    }
}
/**
 * Get user with credits info
 */
async function getUserWithCredits(userId) {
    try {
        // 유저 정보 조회
        const { data: user, error: userError } = await supabase_1.supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        if (userError || !user) {
            return { user: null, credits: null };
        }
        // 크레딧 정보 조회
        const { data: credits, error: creditsError } = await supabase_1.supabase
            .from('v_user_total_credits')
            .select('*')
            .eq('user_id', userId)
            .single();
        if (creditsError || !credits) {
            return { user: user, credits: null };
        }
        return {
            user: user,
            credits: credits
        };
    }
    catch (error) {
        console.error('❌ Error in getUserWithCredits:', error);
        return { user: null, credits: null };
    }
}
/**
 * Check if user has enough credits
 */
async function hasEnoughCredits(userId, requiredAmount = 1) {
    try {
        const { data, error } = await supabase_1.supabase
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
    }
    catch (error) {
        console.error('❌ Error checking credits:', error);
        return { hasEnough: false, currentCredits: 0 };
    }
}
/**
 * Update user's last active timestamp
 */
async function updateLastActive(userId) {
    try {
        await supabase_1.supabase
            .from('users')
            .update({ last_active_at: new Date().toISOString() })
            .eq('id', userId);
    }
    catch (error) {
        console.error('❌ Error updating last active:', error);
    }
}
