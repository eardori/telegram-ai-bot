"use strict";
/**
 * Telegram Stars Payment Service
 *
 * Handles Telegram Stars payments for credit packages and subscriptions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCreditPackageInvoice = createCreditPackageInvoice;
exports.createSubscriptionInvoice = createSubscriptionInvoice;
exports.parsePaymentPayload = parsePaymentPayload;
exports.validatePayment = validatePayment;
exports.getPaymentSuccessMessage = getPaymentSuccessMessage;
const credit_manager_1 = require("./credit-manager");
/**
 * Create invoice for credit package purchase
 */
async function createCreditPackageInvoice(ctx, packageKey) {
    try {
        const pkg = await (0, credit_manager_1.getPackageByKey)(packageKey);
        if (!pkg) {
            await ctx.reply('❌ 패키지를 찾을 수 없습니다.');
            return false;
        }
        const payload = JSON.stringify({
            type: 'credit_package',
            package_key: packageKey,
            user_id: ctx.from?.id,
            timestamp: Date.now()
        });
        // Create invoice
        await ctx.api.sendInvoice(ctx.chat.id, pkg.package_name_ko, // title
        `${pkg.credits}회 이미지 편집 크레딧${pkg.bonus_credits > 0 ? ` + 보너스 ${pkg.bonus_credits}회` : ''}`, // description
        payload, // payload
        'XTR', // currency
        [{ label: pkg.package_name_ko, amount: pkg.price_stars }], // prices
        { provider_token: '' } // options with empty provider_token for Stars
        );
        console.log(`📧 Invoice created for package: ${packageKey}, ${pkg.price_stars} Stars`);
        return true;
    }
    catch (error) {
        console.error('❌ Error creating credit package invoice:', error);
        await ctx.reply('❌ 결제 페이지 생성 중 오류가 발생했습니다.');
        return false;
    }
}
/**
 * Create invoice for subscription plan purchase
 */
async function createSubscriptionInvoice(ctx, planKey) {
    try {
        const plan = await (0, credit_manager_1.getPlanByKey)(planKey);
        if (!plan) {
            await ctx.reply('❌ 구독 플랜을 찾을 수 없습니다.');
            return false;
        }
        const payload = JSON.stringify({
            type: 'subscription',
            plan_key: planKey,
            user_id: ctx.from?.id,
            timestamp: Date.now()
        });
        // Create invoice
        await ctx.api.sendInvoice(ctx.chat.id, `${plan.plan_name_ko} 구독`, // title
        `매월 ${plan.credits_per_month}회 자동 충전 (${plan.billing_period})`, // description
        payload, // payload
        'XTR', // currency
        [{ label: `${plan.plan_name_ko} (월간)`, amount: plan.price_stars }], // prices
        { provider_token: '' } // options with empty provider_token for Stars
        );
        console.log(`📧 Invoice created for subscription: ${planKey}, ${plan.price_stars} Stars/month`);
        return true;
    }
    catch (error) {
        console.error('❌ Error creating subscription invoice:', error);
        await ctx.reply('❌ 구독 결제 페이지 생성 중 오류가 발생했습니다.');
        return false;
    }
}
/**
 * Parse payload from pre-checkout or successful payment
 */
function parsePaymentPayload(payloadString) {
    try {
        return JSON.parse(payloadString);
    }
    catch (error) {
        console.error('❌ Error parsing payment payload:', error);
        return null;
    }
}
/**
 * Validate payment before processing
 * (Called during pre-checkout)
 */
async function validatePayment(payload, totalAmount) {
    const data = parsePaymentPayload(payload);
    if (!data) {
        return { valid: false, error: '잘못된 결제 정보입니다.' };
    }
    // Verify timestamp (prevent replay attacks)
    const age = Date.now() - data.timestamp;
    if (age > 10 * 60 * 1000) { // 10 minutes
        return { valid: false, error: '결제 세션이 만료되었습니다. 다시 시도해주세요.' };
    }
    if (data.type === 'credit_package') {
        const pkg = await (0, credit_manager_1.getPackageByKey)(data.package_key);
        if (!pkg) {
            return { valid: false, error: '패키지를 찾을 수 없습니다.' };
        }
        if (pkg.price_stars !== totalAmount) {
            return { valid: false, error: '결제 금액이 일치하지 않습니다.' };
        }
    }
    else if (data.type === 'subscription') {
        const plan = await (0, credit_manager_1.getPlanByKey)(data.plan_key);
        if (!plan) {
            return { valid: false, error: '구독 플랜을 찾을 수 없습니다.' };
        }
        if (plan.price_stars !== totalAmount) {
            return { valid: false, error: '결제 금액이 일치하지 않습니다.' };
        }
    }
    else {
        return { valid: false, error: '알 수 없는 결제 유형입니다.' };
    }
    return { valid: true };
}
/**
 * Get confirmation message for successful payment
 */
function getPaymentSuccessMessage(type, itemName, credits) {
    if (type === 'credit_package') {
        return `✅ **결제 완료!**\n\n` +
            `🎁 **${itemName}**\n` +
            `💳 **${credits}회** 크레딧이 충전되었습니다!\n\n` +
            `바로 사용하실 수 있습니다. 사진을 업로드하여 편집을 시작하세요!`;
    }
    else {
        return `✅ **구독 시작!**\n\n` +
            `📅 **${itemName}**\n` +
            `💳 매월 **${credits}회** 크레딧이 자동 충전됩니다!\n\n` +
            `첫 크레딧이 지급되었습니다. 바로 사용하실 수 있습니다!`;
    }
}
