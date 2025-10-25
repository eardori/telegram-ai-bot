"use strict";
/**
 * Admin User Management Service
 * Search and manage user information
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserInfo = getUserInfo;
exports.formatUserInfo = formatUserInfo;
const supabase_1 = require("../utils/supabase");
/**
 * Search user by ID
 */
async function getUserInfo(userId) {
    try {
        // Get user basic info
        const { data: user, error: userError } = await supabase_1.supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        if (userError || !user) {
            console.error('❌ User not found:', userId);
            return null;
        }
        // Get credits
        const { data: credits } = await supabase_1.supabase
            .from('user_credits')
            .select('*')
            .eq('user_id', userId)
            .single();
        // Get subscription info
        let subscription = undefined;
        if (credits?.subscription_type && credits?.subscription_status === 'active') {
            const { data: plan } = await supabase_1.supabase
                .from('subscription_plans')
                .select('plan_key, plan_name_ko')
                .eq('plan_key', credits.subscription_type)
                .single();
            if (plan) {
                subscription = {
                    planKey: plan.plan_key,
                    planName: plan.plan_name_ko,
                    status: credits.subscription_status,
                    startDate: new Date(credits.subscription_start_date),
                    endDate: new Date(credits.subscription_end_date)
                };
            }
        }
        // Get usage statistics
        const { data: usageStats } = await supabase_1.supabase
            .from('credit_transactions')
            .select('*')
            .eq('user_id', userId)
            .eq('transaction_type', 'usage');
        const totalEdits = usageStats?.length || 0;
        // Get purchase statistics
        const { data: purchases } = await supabase_1.supabase
            .from('credit_transactions')
            .select(`
        *,
        credit_packages(price_stars)
      `)
            .eq('user_id', userId)
            .eq('transaction_type', 'purchase');
        const totalPurchases = purchases?.length || 0;
        const totalSpent = purchases?.reduce((sum, p) => {
            const stars = p.credit_packages?.price_stars || 0;
            return sum + (stars * 0.013); // Convert to USD
        }, 0) || 0;
        // Get favorite template
        const templateCounts = new Map();
        usageStats?.forEach((stat) => {
            if (stat.template_key) {
                const count = templateCounts.get(stat.template_key) || 0;
                templateCounts.set(stat.template_key, count + 1);
            }
        });
        let favoriteTemplate = undefined;
        let maxCount = 0;
        templateCounts.forEach((count, template) => {
            if (count > maxCount) {
                maxCount = count;
                favoriteTemplate = template;
            }
        });
        // Calculate average edits per week
        const firstEdit = usageStats?.[usageStats.length - 1]?.created_at;
        let avgEditsPerWeek = 0;
        if (firstEdit) {
            const daysSinceFirst = (Date.now() - new Date(firstEdit).getTime()) / (1000 * 60 * 60 * 24);
            const weeks = Math.max(daysSinceFirst / 7, 1);
            avgEditsPerWeek = totalEdits / weeks;
        }
        return {
            userId: user.id,
            username: user.username,
            firstName: user.first_name,
            lastName: user.last_name,
            joinedAt: new Date(user.created_at),
            lastActiveAt: user.last_active_at ? new Date(user.last_active_at) : undefined,
            credits: {
                free: credits?.free_credits || 0,
                paid: credits?.paid_credits || 0,
                subscription: credits?.subscription_credits || 0,
                total: (credits?.free_credits || 0) + (credits?.paid_credits || 0) + (credits?.subscription_credits || 0)
            },
            subscription,
            stats: {
                totalEdits,
                totalPurchases,
                totalSpent,
                favoriteTemplate,
                avgEditsPerWeek: Math.round(avgEditsPerWeek * 10) / 10
            },
            flags: {
                isVip: totalSpent > 20 || (credits?.subscription_status === 'active'), // VIP if spent $20+ or has subscription
                isBanned: false // TODO: Add ban system
            }
        };
    }
    catch (error) {
        console.error('❌ Error getting user info:', error);
        return null;
    }
}
/**
 * Format user info as Telegram message
 */
function formatUserInfo(user) {
    let message = `👤 **사용자 정보**\n\n`;
    // Basic info
    message += `**기본 정보:**\n`;
    message += `• User ID: \`${user.userId}\`\n`;
    if (user.username)
        message += `• Username: @${user.username}\n`;
    if (user.firstName)
        message += `• 이름: ${user.firstName}`;
    if (user.lastName)
        message += ` ${user.lastName}`;
    message += `\n`;
    message += `• 가입일: ${formatDate(user.joinedAt)}\n`;
    if (user.lastActiveAt) {
        message += `• 마지막 활동: ${formatRelativeTime(user.lastActiveAt)}\n`;
    }
    message += `\n`;
    // Credits
    message += `💳 **크레딧 현황:**\n`;
    if (user.credits.free > 0)
        message += `• 🎁 무료 크레딧: ${user.credits.free}회\n`;
    if (user.credits.paid > 0)
        message += `• 💰 충전 크레딧: ${user.credits.paid}회\n`;
    if (user.credits.subscription > 0)
        message += `• ⭐ 구독 크레딧: ${user.credits.subscription}회\n`;
    message += `• 📊 **총 사용 가능: ${user.credits.total}회**\n`;
    message += `\n`;
    // Subscription
    if (user.subscription) {
        message += `📅 **구독 정보:**\n`;
        message += `• 플랜: ${user.subscription.planName}\n`;
        message += `• 상태: ${getSubscriptionStatusLabel(user.subscription.status)}\n`;
        message += `• 다음 갱신: ${formatDate(user.subscription.endDate)}\n`;
        message += `\n`;
    }
    // Stats
    message += `📊 **사용 통계:**\n`;
    message += `• 총 편집: ${user.stats.totalEdits}회\n`;
    if (user.stats.totalPurchases > 0) {
        message += `• 총 충전 금액: $${user.stats.totalSpent.toFixed(2)}\n`;
        message += `• 충전 횟수: ${user.stats.totalPurchases}번\n`;
    }
    if (user.stats.avgEditsPerWeek > 0) {
        message += `• 평균 편집/주: ${user.stats.avgEditsPerWeek}회\n`;
    }
    if (user.stats.favoriteTemplate) {
        message += `• 선호 템플릿: ${user.stats.favoriteTemplate}\n`;
    }
    message += `\n`;
    // Flags
    message += `🎯 **상태:**\n`;
    if (user.flags.isVip)
        message += `• ⭐ VIP 사용자\n`;
    if (user.flags.isBanned)
        message += `• 🚫 제재됨\n`;
    return message;
}
/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
    return date.toISOString().split('T')[0];
}
/**
 * Format relative time (e.g., "2시간 전")
 */
function formatRelativeTime(date) {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60)
        return '방금 전';
    if (seconds < 3600)
        return `${Math.floor(seconds / 60)}분 전`;
    if (seconds < 86400)
        return `${Math.floor(seconds / 3600)}시간 전`;
    if (seconds < 604800)
        return `${Math.floor(seconds / 86400)}일 전`;
    return formatDate(date);
}
/**
 * Get subscription status label
 */
function getSubscriptionStatusLabel(status) {
    switch (status) {
        case 'active': return '✅ 활성';
        case 'cancelled': return '⏸️ 취소됨';
        case 'expired': return '❌ 만료됨';
        default: return status;
    }
}
