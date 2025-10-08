/**
 * Purchase UI Service
 *
 * Generates purchase options UI for credit packages and subscriptions
 */

import { InlineKeyboard } from 'grammy';
import { getActivePackages, getActiveSubscriptionPlans } from './credit-manager';

/**
 * Generate inline keyboard with credit package options
 */
export async function getCreditPackagesKeyboard(): Promise<InlineKeyboard> {
  const packages = await getActivePackages();
  const keyboard = new InlineKeyboard();

  packages.forEach((pkg, index) => {
    const label = pkg.badge
      ? `${pkg.badge} ${pkg.package_name_ko} - ${pkg.credits}회 (${pkg.price_stars}⭐)`
      : `${pkg.package_name_ko} - ${pkg.credits}회 (${pkg.price_stars}⭐)`;

    keyboard.text(label, `buy_credits:${pkg.package_key}`);

    // Add line break after every package
    keyboard.row();
  });

  // Add subscription option button
  keyboard.text('📅 구독 플랜 보기', 'show_subscriptions');
  keyboard.row();
  keyboard.text('❌ 취소', 'cancel_purchase');

  return keyboard;
}

/**
 * Generate inline keyboard with subscription plan options
 */
export async function getSubscriptionPlansKeyboard(): Promise<InlineKeyboard> {
  const plans = await getActiveSubscriptionPlans();
  const keyboard = new InlineKeyboard();

  plans.forEach((plan, index) => {
    const label = plan.badge
      ? `${plan.badge} ${plan.plan_name_ko} - ${plan.credits_per_month}회/월 (${plan.price_stars}⭐)`
      : `${plan.plan_name_ko} - ${plan.credits_per_month}회/월 (${plan.price_stars}⭐)`;

    keyboard.text(label, `subscribe:${plan.plan_key}`);
    keyboard.row();
  });

  // Add back button
  keyboard.text('◀️ 크레딧 패키지 보기', 'show_packages');
  keyboard.row();
  keyboard.text('❌ 취소', 'cancel_purchase');

  return keyboard;
}

/**
 * Get formatted purchase options message
 */
export async function getPurchaseOptionsMessage(): Promise<string> {
  const packages = await getActivePackages();

  let message = `💳 **크레딧 충전**\n\n`;
  message += `다음 패키지 중 하나를 선택하세요:\n\n`;

  packages.forEach(pkg => {
    const badge = pkg.badge ? `${pkg.badge} ` : '';
    const perCreditPrice = (pkg.price_stars * 0.013 / pkg.credits).toFixed(4);

    message += `${badge}**${pkg.package_name_ko}**\n`;
    message += `  • ${pkg.credits}회 편집\n`;
    message += `  • ${pkg.price_stars}⭐ Stars ($${(pkg.price_stars * 0.013).toFixed(2)})\n`;
    message += `  • 회당 $${perCreditPrice}\n`;

    if (pkg.is_popular) {
      message += `  🔥 인기 상품!\n`;
    }

    message += `\n`;
  });

  message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `💡 **구독을 원하시나요?**\n`;
  message += `정기적으로 사용하신다면 구독 플랜이 더 저렴합니다!\n`;
  message += `"📅 구독 플랜 보기" 버튼을 눌러주세요.\n\n`;
  message += `⭐ Telegram Stars로 안전하게 결제하세요!`;

  return message;
}

/**
 * Get formatted subscription options message
 */
export async function getSubscriptionOptionsMessage(): Promise<string> {
  const plans = await getActiveSubscriptionPlans();

  let message = `📅 **구독 플랜**\n\n`;
  message += `매월 자동으로 크레딧이 충전됩니다:\n\n`;

  plans.forEach(plan => {
    const badge = plan.badge ? `${plan.badge} ` : '';
    const perCreditPrice = (plan.price_stars * 0.013 / plan.credits_per_month).toFixed(4);

    message += `${badge}**${plan.plan_name_ko}**\n`;
    message += `  • 매월 ${plan.credits_per_month}회\n`;
    message += `  • ${plan.price_stars}⭐ Stars/월 ($${(plan.price_stars * 0.013).toFixed(2)})\n`;
    message += `  • 회당 $${perCreditPrice}\n`;

    if (plan.is_popular) {
      message += `  ⭐ 가장 인기 있는 플랜!\n`;
    }

    message += `\n`;
  });

  message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `💡 **구독 혜택:**\n`;
  message += `• 매월 자동 충전으로 편리함\n`;
  message += `• 크레딧 패키지보다 저렴한 가격\n`;
  message += `• 언제든지 취소 가능\n\n`;
  message += `⭐ Telegram Stars로 안전하게 결제하세요!`;

  return message;
}

/**
 * Generate simple "out of credits" message
 */
export function getOutOfCreditsMessage(isGroupChat: boolean = false): string {
  if (isGroupChat) {
    return `⚠️ **크레딧이 부족합니다!**\n\n` +
      `개인 메시지로 저에게 말을 걸어 크레딧을 충전하세요.\n` +
      `또는 /start 명령어를 사용해주세요!\n\n` +
      `🎁 신규 가입 시 5회 무료 크레딧을 드립니다!`;
  }

  return `💳 **크레딧이 부족합니다!**\n\n` +
    `계속 사용하시려면 크레딧을 충전해주세요.\n` +
    `아래 버튼을 눌러 패키지를 선택하세요!`;
}

/**
 * Get welcome message for new users
 */
export function getWelcomeMessage(freeCredits: number): string {
  return `🎉 **환영합니다!**\n\n` +
    `가입을 축하드립니다!\n\n` +
    `🎁 **무료 크레딧 ${freeCredits}개**를 드렸습니다!\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📸 **사용 방법:**\n` +
    `1. 사진을 업로드하세요\n` +
    `2. AI가 자동으로 분석하고 추천을 드립니다\n` +
    `3. 원하는 스타일을 선택하세요\n` +
    `4. 편집된 이미지를 받으세요!\n\n` +
    `💡 지금 바로 사진을 업로드하여 시작해보세요!`;
}
