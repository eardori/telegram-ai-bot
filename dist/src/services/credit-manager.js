"use strict";
/**
 * Credit Manager Service
 *
 * Handles credit operations: check, deduct, add, get packages/plans
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deductCredit = deductCredit;
exports.addCredits = addCredits;
exports.getCreditBalance = getCreditBalance;
exports.getActivePackages = getActivePackages;
exports.getActiveSubscriptionPlans = getActiveSubscriptionPlans;
exports.getPackageByKey = getPackageByKey;
exports.getPlanByKey = getPlanByKey;
exports.getTransactionHistory = getTransactionHistory;
exports.formatCredits = formatCredits;
exports.calculatePricePerCredit = calculatePricePerCredit;
exports.getDiscountPercentage = getDiscountPercentage;
const supabase_1 = require("../utils/supabase");
/**
 * Deduct credits from user
 */
async function deductCredit(userId, amount = 1, templateKey, editId) {
    try {
        console.log(`💳 Deducting ${amount} credits from user ${userId}...`);
        // Call PostgreSQL function
        const { data, error } = await supabase_1.supabase
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
        }
        else {
            console.warn(`⚠️ Credit deduction failed: ${result.message}`);
        }
        return {
            success: result.success,
            remaining_credits: result.remaining_credits,
            message: result.message
        };
    }
    catch (error) {
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
async function addCredits(userId, amount, creditType, description, packageKey) {
    try {
        console.log(`💰 Adding ${amount} ${creditType} credits to user ${userId}...`);
        // Call PostgreSQL function
        const { data, error } = await supabase_1.supabase
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
    }
    catch (error) {
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
async function getCreditBalance(userId) {
    try {
        const { data, error } = await supabase_1.supabase
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
    }
    catch (error) {
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
async function getActivePackages() {
    try {
        const { data, error } = await supabase_1.supabase
            .from('credit_packages')
            .select('*')
            .eq('is_active', true)
            .order('display_order', { ascending: true });
        if (error) {
            console.error('❌ Error fetching packages:', error);
            return [];
        }
        return data;
    }
    catch (error) {
        console.error('❌ Error in getActivePackages:', error);
        return [];
    }
}
/**
 * Get all active subscription plans
 */
async function getActiveSubscriptionPlans() {
    try {
        const { data, error } = await supabase_1.supabase
            .from('subscription_plans')
            .select('*')
            .eq('is_active', true)
            .order('display_order', { ascending: true });
        if (error) {
            console.error('❌ Error fetching subscription plans:', error);
            return [];
        }
        return data;
    }
    catch (error) {
        console.error('❌ Error in getActiveSubscriptionPlans:', error);
        return [];
    }
}
/**
 * Get package by key
 */
async function getPackageByKey(packageKey) {
    try {
        const { data, error } = await supabase_1.supabase
            .from('credit_packages')
            .select('*')
            .eq('package_key', packageKey)
            .eq('is_active', true)
            .single();
        if (error || !data) {
            return null;
        }
        return data;
    }
    catch (error) {
        console.error('❌ Error in getPackageByKey:', error);
        return null;
    }
}
/**
 * Get subscription plan by key
 */
async function getPlanByKey(planKey) {
    try {
        const { data, error } = await supabase_1.supabase
            .from('subscription_plans')
            .select('*')
            .eq('plan_key', planKey)
            .eq('is_active', true)
            .single();
        if (error || !data) {
            return null;
        }
        return data;
    }
    catch (error) {
        console.error('❌ Error in getPlanByKey:', error);
        return null;
    }
}
/**
 * Get user's credit transaction history
 */
async function getTransactionHistory(userId, limit = 10) {
    try {
        const { data, error } = await supabase_1.supabase
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
    }
    catch (error) {
        console.error('❌ Error in getTransactionHistory:', error);
        return [];
    }
}
/**
 * Format credits for display
 */
function formatCredits(credits) {
    if (credits === -1) {
        return '무제한';
    }
    return `${credits}회`;
}
/**
 * Calculate price per credit
 */
function calculatePricePerCredit(stars, credits) {
    const usdPrice = stars * 0.013; // 1 Star = $0.013
    return usdPrice / credits;
}
/**
 * Get discount percentage for package
 */
function getDiscountPercentage(pkg) {
    const basePrice = 100 * 0.013; // 스타터 팩 기준가 (100 Stars)
    const baseCredits = 30;
    const basePricePerCredit = basePrice / baseCredits; // $0.0433/credit
    const pkgPricePerCredit = calculatePricePerCredit(pkg.price_stars, pkg.credits);
    const discount = ((basePricePerCredit - pkgPricePerCredit) / basePricePerCredit) * 100;
    return Math.round(discount);
}
