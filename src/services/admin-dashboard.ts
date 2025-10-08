/**
 * Admin Dashboard Service
 * Provides real-time statistics and monitoring for administrators
 */

import { supabase } from '../utils/supabase';
import {
  DashboardStats,
  RealtimeStats,
  RevenueStats,
  CreditStats,
  PackageSale,
  SubscriptionSale
} from '../types/admin.types';

const TELEGRAM_FEE = 0.30; // 30%
const STAR_TO_USD = 0.013;

/**
 * Get complete dashboard statistics
 */
export async function getDashboardStats(period: '24h' | '7d' | '30d' = '24h'): Promise<DashboardStats> {
  const [realtime, revenue, credits, alerts] = await Promise.all([
    getRealtimeStats(period),
    getRevenueStats(period),
    getCreditStats(),
    getSystemAlerts()
  ]);

  return {
    realtime,
    revenue,
    credits,
    alerts
  };
}

/**
 * Get real-time user and activity statistics
 */
async function getRealtimeStats(period: '24h' | '7d' | '30d'): Promise<RealtimeStats> {
  const startDate = getStartDate(period);

  // Total users
  const { count: totalUsers } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  // New users in period
  const { count: newUsers } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startDate);

  // Active users (users who made edits in period)
  const { data: activeUsersData } = await supabase
    .from('credit_transactions')
    .select('user_id')
    .eq('transaction_type', 'usage')
    .gte('created_at', startDate);

  const activeUsers = new Set(activeUsersData?.map(t => t.user_id) || []).size;

  // Image edits count
  const { count: imageEdits } = await supabase
    .from('credit_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('transaction_type', 'usage')
    .gte('created_at', startDate);

  // Credit purchases count
  const { count: creditPurchases } = await supabase
    .from('credit_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('transaction_type', 'purchase')
    .gte('created_at', startDate);

  return {
    period,
    totalUsers: totalUsers || 0,
    activeUsers,
    newUsers: newUsers || 0,
    imageEdits: imageEdits || 0,
    creditPurchases: creditPurchases || 0
  };
}

/**
 * Get revenue statistics with Telegram fee calculation
 */
async function getRevenueStats(period: '24h' | '7d' | '30d'): Promise<RevenueStats> {
  const startDate = getStartDate(period);

  // Get all purchases in period
  const { data: purchases } = await supabase
    .from('credit_transactions')
    .select(`
      *,
      credit_packages(package_key, package_name_ko, price_stars),
      subscription_plans(plan_key, plan_name_ko, price_stars)
    `)
    .eq('transaction_type', 'purchase')
    .gte('created_at', startDate);

  let totalStars = 0;
  const packageSales: Map<string, PackageSale> = new Map();
  const subscriptionSales: Map<string, SubscriptionSale> = new Map();

  purchases?.forEach((purchase: any) => {
    if (purchase.package_key) {
      // Credit package purchase
      const pkg = purchase.credit_packages;
      if (pkg) {
        totalStars += pkg.price_stars;

        const existing = packageSales.get(pkg.package_key);
        if (existing) {
          existing.count++;
          existing.revenue += pkg.price_stars * STAR_TO_USD;
        } else {
          packageSales.set(pkg.package_key, {
            packageKey: pkg.package_key,
            packageName: pkg.package_name_ko,
            count: 1,
            revenue: pkg.price_stars * STAR_TO_USD
          });
        }
      }
    } else if (purchase.subscription_plan_key) {
      // Subscription purchase
      const plan = purchase.subscription_plans;
      if (plan) {
        totalStars += plan.price_stars;

        const existing = subscriptionSales.get(plan.plan_key);
        if (existing) {
          existing.activeCount++;
          existing.mrr += plan.price_stars * STAR_TO_USD;
        } else {
          subscriptionSales.set(plan.plan_key, {
            planKey: plan.plan_key,
            planName: plan.plan_name_ko,
            activeCount: 1,
            mrr: plan.price_stars * STAR_TO_USD
          });
        }
      }
    }
  });

  const totalRevenue = totalStars * STAR_TO_USD;
  const telegramFee = totalRevenue * TELEGRAM_FEE;
  const netRevenue = totalRevenue - telegramFee;

  // Get API costs from usage
  const { data: apiUsage } = await supabase
    .from('credit_transactions')
    .select('amount')
    .eq('transaction_type', 'usage')
    .gte('created_at', startDate);

  const apiCost = (apiUsage?.length || 0) * 0.002; // $0.002 per edit
  const profit = netRevenue - apiCost;

  return {
    period,
    totalRevenue,
    telegramFee,
    netRevenue,
    apiCost,
    profit,
    packageSales: Array.from(packageSales.values()),
    subscriptionSales: Array.from(subscriptionSales.values())
  };
}

/**
 * Get credit statistics
 */
async function getCreditStats(): Promise<CreditStats> {
  // Sum all credits from user_credits table
  const { data: credits } = await supabase
    .from('user_credits')
    .select('free_credits, paid_credits, subscription_credits');

  let totalFree = 0;
  let totalPaid = 0;
  let totalSubscription = 0;

  credits?.forEach((c: any) => {
    totalFree += c.free_credits || 0;
    totalPaid += c.paid_credits || 0;
    totalSubscription += c.subscription_credits || 0;
  });

  const remaining = totalFree + totalPaid + totalSubscription;

  // Get total issued from transactions
  const { data: issued } = await supabase
    .from('credit_transactions')
    .select('amount')
    .in('transaction_type', ['signup', 'purchase', 'grant']);

  const totalIssued = issued?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

  // Get total used
  const { data: used } = await supabase
    .from('credit_transactions')
    .select('amount')
    .eq('transaction_type', 'usage');

  const totalUsed = used?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

  return {
    totalIssued,
    totalUsed,
    remaining,
    freeCredits: totalFree,
    paidCredits: totalPaid,
    subscriptionCredits: totalSubscription
  };
}

/**
 * Get system alerts (imported from admin-alerts.ts)
 */
async function getSystemAlerts() {
  // Will be implemented in admin-alerts.ts
  return [];
}

/**
 * Format dashboard stats as Telegram message
 */
export function formatDashboardMessage(stats: DashboardStats): string {
  const { realtime, revenue, credits } = stats;

  let message = `📊 **Multiful Bot 관리자 대시보드**\n\n`;

  // Realtime stats
  message += `🔢 **실시간 통계 (${getPeriodLabel(realtime.period)})**\n`;
  message += `• 총 사용자: ${realtime.totalUsers.toLocaleString()}명\n`;
  message += `• 활성 사용자: ${realtime.activeUsers.toLocaleString()}명\n`;
  message += `• 신규 가입: ${realtime.newUsers.toLocaleString()}명\n`;
  message += `• 이미지 편집: ${realtime.imageEdits.toLocaleString()}회\n`;
  message += `• 크레딧 충전: ${realtime.creditPurchases.toLocaleString()}건\n\n`;

  // Revenue stats
  message += `💰 **수익 현황 (${getPeriodLabel(revenue.period)})**\n`;
  message += `• 총 매출: $${revenue.totalRevenue.toFixed(2)}\n`;
  message += `• Telegram 수수료 (30%): -$${revenue.telegramFee.toFixed(2)}\n`;
  message += `• 순매출: $${revenue.netRevenue.toFixed(2)}\n`;
  message += `• API 비용: -$${revenue.apiCost.toFixed(2)}\n`;
  message += `• **순이익: $${revenue.profit.toFixed(2)}**\n\n`;

  // Credit stats
  message += `💳 **크레딧 현황**\n`;
  message += `• 총 발행: ${credits.totalIssued.toLocaleString()} 크레딧\n`;
  message += `• 사용됨: ${credits.totalUsed.toLocaleString()} (${((credits.totalUsed / credits.totalIssued) * 100).toFixed(1)}%)\n`;
  message += `• 남은 크레딧: ${credits.remaining.toLocaleString()}\n\n`;

  // Alerts
  if (stats.alerts.length > 0) {
    message += `⚠️ **알림 (${stats.alerts.length}건)**\n`;
    stats.alerts.slice(0, 3).forEach(alert => {
      const icon = getAlertIcon(alert.level);
      message += `${icon} ${alert.message}\n`;
    });
    message += `\n`;
  }

  return message;
}

/**
 * Get period label in Korean
 */
function getPeriodLabel(period: '24h' | '7d' | '30d'): string {
  switch (period) {
    case '24h': return '24시간';
    case '7d': return '7일';
    case '30d': return '30일';
  }
}

/**
 * Get alert icon
 */
function getAlertIcon(level: string): string {
  switch (level) {
    case 'critical': return '🔴';
    case 'error': return '❌';
    case 'warning': return '⚠️';
    case 'info': return 'ℹ️';
    default: return '•';
  }
}

/**
 * Get start date for period
 */
function getStartDate(period: '24h' | '7d' | '30d'): string {
  const now = new Date();
  let hours = 24;

  switch (period) {
    case '24h': hours = 24; break;
    case '7d': hours = 24 * 7; break;
    case '30d': hours = 24 * 30; break;
  }

  const startDate = new Date(now.getTime() - hours * 60 * 60 * 1000);
  return startDate.toISOString();
}
