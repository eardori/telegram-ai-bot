"use strict";
/**
 * Admin Alert System
 * Real-time monitoring and alert generation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSystemAlerts = getSystemAlerts;
exports.formatAlertsMessage = formatAlertsMessage;
const supabase_1 = require("../utils/supabase");
// Alert thresholds
const ALERT_THRESHOLDS = {
    apiErrorRate: 5, // 5% error rate
    apiCostDaily: 50, // $50/day
    paymentFailures: 10, // 10 failed payments/day
    revenueDrop: 20 // 20% drop from previous period
};
/**
 * Get all active system alerts
 */
async function getSystemAlerts() {
    const alerts = [];
    const now = new Date();
    // Check API error rate
    const apiErrorAlert = await checkAPIErrorRate();
    if (apiErrorAlert)
        alerts.push(apiErrorAlert);
    // Check daily API cost
    const apiCostAlert = await checkAPICost();
    if (apiCostAlert)
        alerts.push(apiCostAlert);
    // Check payment failures
    const paymentAlert = await checkPaymentFailures();
    if (paymentAlert)
        alerts.push(paymentAlert);
    // Check revenue drop
    const revenueAlert = await checkRevenueDrop();
    if (revenueAlert)
        alerts.push(revenueAlert);
    return alerts.sort((a, b) => {
        const levelOrder = { critical: 0, error: 1, warning: 2, info: 3 };
        return levelOrder[a.level] - levelOrder[b.level];
    });
}
/**
 * Check API error rate
 */
async function checkAPIErrorRate() {
    try {
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        // Get total API calls (usage transactions)
        const { count: totalCalls } = await supabase_1.supabase
            .from('credit_transactions')
            .select('*', { count: 'exact', head: true })
            .eq('transaction_type', 'usage')
            .gte('created_at', last24h);
        // Count failed edits (you'll need to track this in your system)
        // For now, we'll estimate from credit refunds or error logs
        const { count: failedCalls } = await supabase_1.supabase
            .from('credit_transactions')
            .select('*', { count: 'exact', head: true })
            .eq('transaction_type', 'refund')
            .gte('created_at', last24h);
        if (!totalCalls || totalCalls === 0)
            return null;
        const errorRate = ((failedCalls || 0) / totalCalls) * 100;
        if (errorRate >= ALERT_THRESHOLDS.apiErrorRate) {
            return {
                id: `api_error_${Date.now()}`,
                level: errorRate >= 10 ? 'critical' : 'warning',
                type: 'api_error_rate',
                message: `API 오류율이 ${errorRate.toFixed(1)}%로 높습니다`,
                value: errorRate,
                threshold: ALERT_THRESHOLDS.apiErrorRate,
                timestamp: new Date(),
                resolved: false
            };
        }
        return null;
    }
    catch (error) {
        console.error('❌ Error checking API error rate:', error);
        return null;
    }
}
/**
 * Check daily API cost
 */
async function checkAPICost() {
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const { count: apiCalls } = await supabase_1.supabase
            .from('credit_transactions')
            .select('*', { count: 'exact', head: true })
            .eq('transaction_type', 'usage')
            .gte('created_at', startOfDay.toISOString());
        const dailyCost = (apiCalls || 0) * 0.002; // $0.002 per call
        if (dailyCost >= ALERT_THRESHOLDS.apiCostDaily) {
            return {
                id: `api_cost_${Date.now()}`,
                level: dailyCost >= 100 ? 'critical' : 'warning',
                type: 'api_cost_high',
                message: `오늘 API 비용이 $${dailyCost.toFixed(2)}로 높습니다`,
                value: dailyCost,
                threshold: ALERT_THRESHOLDS.apiCostDaily,
                timestamp: new Date(),
                resolved: false
            };
        }
        return null;
    }
    catch (error) {
        console.error('❌ Error checking API cost:', error);
        return null;
    }
}
/**
 * Check payment failures
 */
async function checkPaymentFailures() {
    try {
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        // Count failed payments (pre_checkout_query rejections)
        // You'll need to log these in your payment flow
        // For now, we'll create a placeholder
        // TODO: Implement payment failure tracking
        // This requires logging rejected pre_checkout_query events
        return null;
    }
    catch (error) {
        console.error('❌ Error checking payment failures:', error);
        return null;
    }
}
/**
 * Check revenue drop
 */
async function checkRevenueDrop() {
    try {
        const STAR_TO_USD = 0.013;
        const now = new Date();
        // Get revenue for last 7 days
        const last7dStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const { data: last7d } = await supabase_1.supabase
            .from('credit_transactions')
            .select(`
        *,
        credit_packages(price_stars),
        subscription_plans(price_stars)
      `)
            .eq('transaction_type', 'purchase')
            .gte('created_at', last7dStart.toISOString());
        // Get revenue for previous 7 days
        const prev7dStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        const prev7dEnd = last7dStart;
        const { data: prev7d } = await supabase_1.supabase
            .from('credit_transactions')
            .select(`
        *,
        credit_packages(price_stars),
        subscription_plans(price_stars)
      `)
            .eq('transaction_type', 'purchase')
            .gte('created_at', prev7dStart.toISOString())
            .lt('created_at', prev7dEnd.toISOString());
        const calculateRevenue = (data) => {
            return (data || []).reduce((sum, tx) => {
                const stars = tx.credit_packages?.price_stars || tx.subscription_plans?.price_stars || 0;
                return sum + (stars * STAR_TO_USD);
            }, 0);
        };
        const currentRevenue = calculateRevenue(last7d || []);
        const previousRevenue = calculateRevenue(prev7d || []);
        if (previousRevenue === 0)
            return null;
        const dropPercentage = ((previousRevenue - currentRevenue) / previousRevenue) * 100;
        if (dropPercentage >= ALERT_THRESHOLDS.revenueDrop) {
            return {
                id: `revenue_drop_${Date.now()}`,
                level: dropPercentage >= 40 ? 'critical' : 'warning',
                type: 'revenue_drop',
                message: `지난주 대비 매출이 ${dropPercentage.toFixed(1)}% 감소했습니다`,
                value: dropPercentage,
                threshold: ALERT_THRESHOLDS.revenueDrop,
                timestamp: new Date(),
                resolved: false
            };
        }
        return null;
    }
    catch (error) {
        console.error('❌ Error checking revenue drop:', error);
        return null;
    }
}
/**
 * Format alerts for Telegram message
 */
function formatAlertsMessage(alerts) {
    if (alerts.length === 0) {
        return '✅ 시스템 정상 작동 중';
    }
    let message = `⚠️ **활성 알림 (${alerts.length}건)**\n\n`;
    alerts.forEach(alert => {
        const icon = getAlertIcon(alert.level);
        message += `${icon} **${alert.message}**\n`;
        if (alert.value !== undefined && alert.threshold !== undefined) {
            message += `   현재: ${alert.value.toFixed(1)} / 임계값: ${alert.threshold}\n`;
        }
        message += `   발생 시각: ${formatTime(alert.timestamp)}\n\n`;
    });
    return message;
}
/**
 * Get alert icon by level
 */
function getAlertIcon(level) {
    switch (level) {
        case 'critical': return '🔴';
        case 'error': return '❌';
        case 'warning': return '⚠️';
        case 'info': return 'ℹ️';
        default: return '•';
    }
}
/**
 * Format time
 */
function formatTime(date) {
    return date.toLocaleString('ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
