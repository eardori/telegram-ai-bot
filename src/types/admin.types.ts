/**
 * Admin Feature Types
 * Types for admin dashboard, monitoring, and management
 */

// Dashboard Statistics
export interface DashboardStats {
  realtime: RealtimeStats;
  revenue: RevenueStats;
  credits: CreditStats;
  alerts: SystemAlert[];
}

export interface RealtimeStats {
  period: '24h' | '7d' | '30d';
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  imageEdits: number;
  creditPurchases: number;
}

export interface RevenueStats {
  period: '24h' | '7d' | '30d';
  totalRevenue: number;        // Total Stars revenue in USD
  telegramFee: number;          // 30% fee in USD
  netRevenue: number;           // After Telegram fee
  apiCost: number;              // API costs
  profit: number;               // Net profit
  packageSales: PackageSale[];
  subscriptionSales: SubscriptionSale[];
}

export interface PackageSale {
  packageKey: string;
  packageName: string;
  count: number;
  revenue: number;              // In USD
}

export interface SubscriptionSale {
  planKey: string;
  planName: string;
  activeCount: number;
  mrr: number;                  // Monthly Recurring Revenue in USD
}

export interface CreditStats {
  totalIssued: number;          // Total credits issued
  totalUsed: number;            // Total credits used
  remaining: number;            // Remaining credits
  freeCredits: number;
  paidCredits: number;
  subscriptionCredits: number;
}

// System Alerts
export interface SystemAlert {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  type: AlertType;
  message: string;
  value?: number;
  threshold?: number;
  timestamp: Date;
  resolved: boolean;
}

export type AlertType =
  | 'api_error_rate'
  | 'api_cost_high'
  | 'payment_failures'
  | 'revenue_drop'
  | 'user_churn'
  | 'system_error';

export interface AlertCondition {
  type: AlertType;
  threshold: number;
  enabled: boolean;
  notifyAdmin: boolean;
}

// User Search
export interface UserInfo {
  userId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  joinedAt: Date;
  lastActiveAt?: Date;

  credits: {
    free: number;
    paid: number;
    subscription: number;
    total: number;
  };

  subscription?: {
    planKey: string;
    planName: string;
    status: 'active' | 'cancelled' | 'expired';
    startDate: Date;
    endDate: Date;
  };

  stats: {
    totalEdits: number;
    totalPurchases: number;
    totalSpent: number;           // In USD
    favoriteTemplate?: string;
    avgEditsPerWeek: number;
  };

  flags: {
    isVip: boolean;
    isBanned: boolean;
  };
}

// Credit Grant
export interface CreditGrantRequest {
  userId: number;
  amount: number;
  reason: string;
  grantedBy: number;              // Admin user ID
}

export interface CreditGrantResult {
  success: boolean;
  userId: number;
  amountGranted: number;
  previousBalance: number;
  newBalance: number;
  message?: string;
}

// Alert Settings
export interface AlertSettings {
  apiErrorRate: {
    enabled: boolean;
    threshold: number;            // Percentage (e.g., 5 = 5%)
  };
  apiCostDaily: {
    enabled: boolean;
    threshold: number;            // USD
  };
  paymentFailures: {
    enabled: boolean;
    threshold: number;            // Count
  };
  revenueDrop: {
    enabled: boolean;
    threshold: number;            // Percentage (e.g., 20 = 20%)
  };
}

// Admin Activity Log
export interface AdminActivity {
  id: number;
  adminUserId: number;
  action: AdminActionType;
  targetUserId?: number;
  details: Record<string, any>;
  timestamp: Date;
}

export type AdminActionType =
  | 'credit_grant'
  | 'credit_revoke'
  | 'user_ban'
  | 'user_unban'
  | 'prompt_enable'
  | 'prompt_disable'
  | 'alert_dismiss'
  | 'settings_change';
