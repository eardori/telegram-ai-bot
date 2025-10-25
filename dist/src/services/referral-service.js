"use strict";
/**
 * Referral Service
 * 추천인 시스템 핵심 비즈니스 로직
 * CAC $3-5 → $0.04 (99% 절감)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserReferralCode = getUserReferralCode;
exports.getUserIdByReferralCode = getUserIdByReferralCode;
exports.processReferral = processReferral;
exports.getReferralStats = getReferralStats;
exports.getAllMilestones = getAllMilestones;
exports.getUserMilestones = getUserMilestones;
exports.generateReferralLink = generateReferralLink;
exports.formatReferralMessage = formatReferralMessage;
exports.formatReferrerNotification = formatReferrerNotification;
exports.formatReferredWelcome = formatReferredWelcome;
exports.formatMilestoneAchievement = formatMilestoneAchievement;
const supabase_1 = require("../utils/supabase");
/**
 * 사용자의 추천 코드 조회 (없으면 생성)
 */
async function getUserReferralCode(userId) {
    try {
        const { data: user, error } = await supabase_1.supabase
            .from('users')
            .select('referral_code')
            .eq('id', userId)
            .single();
        if (error) {
            console.error('❌ Error fetching referral code:', error);
            return null;
        }
        return user?.referral_code || null;
    }
    catch (error) {
        console.error('❌ Error in getUserReferralCode:', error);
        return null;
    }
}
/**
 * 추천 코드로 사용자 ID 조회
 */
async function getUserIdByReferralCode(referralCode) {
    try {
        const { data: user, error } = await supabase_1.supabase
            .from('users')
            .select('id')
            .eq('referral_code', referralCode)
            .single();
        if (error || !user) {
            return null;
        }
        return user.id;
    }
    catch (error) {
        console.error('❌ Error in getUserIdByReferralCode:', error);
        return null;
    }
}
/**
 * 추천 관계 생성 및 보상 지급
 */
async function processReferral(referralCode, referredUserId) {
    try {
        // 1. 추천 코드로 추천인 찾기
        const referrerUserId = await getUserIdByReferralCode(referralCode);
        if (!referrerUserId) {
            return {
                success: false,
                message: '유효하지 않은 추천 코드입니다.'
            };
        }
        // 2. 자기 자신 추천 방지
        if (referrerUserId === referredUserId) {
            return {
                success: false,
                message: '자기 자신을 추천할 수 없습니다.'
            };
        }
        // 3. 이미 추천받은 사용자인지 체크
        const { data: existing } = await supabase_1.supabase
            .from('referrals')
            .select('id')
            .eq('referred_user_id', referredUserId)
            .single();
        if (existing) {
            return {
                success: false,
                message: '이미 다른 추천인을 통해 가입하셨습니다.'
            };
        }
        // 4. 추천 보상 지급 함수 호출
        const { data, error } = await supabase_1.supabase.rpc('grant_referral_rewards', {
            p_referrer_user_id: referrerUserId,
            p_referred_user_id: referredUserId,
            p_referral_code: referralCode
        });
        if (error) {
            console.error('❌ Error granting referral rewards:', error);
            return {
                success: false,
                message: '보상 지급 중 오류가 발생했습니다.'
            };
        }
        const result = data[0];
        return {
            success: result.success,
            message: result.message,
            referrerReward: result.referrer_credits,
            referredReward: result.referred_credits
        };
    }
    catch (error) {
        console.error('❌ Error in processReferral:', error);
        return {
            success: false,
            message: '추천 처리 중 오류가 발생했습니다.'
        };
    }
}
/**
 * 사용자의 추천 통계 조회
 */
async function getReferralStats(userId) {
    try {
        // 1. 기본 통계 조회
        const { data: stats, error } = await supabase_1.supabase
            .from('v_user_referral_stats')
            .select('*')
            .eq('user_id', userId)
            .single();
        if (error || !stats) {
            console.error('❌ Error fetching referral stats:', error);
            return null;
        }
        // 2. 다음 마일스톤 찾기
        const { data: milestones } = await supabase_1.supabase
            .from('referral_milestones')
            .select('*')
            .eq('is_active', true)
            .order('required_referrals', { ascending: true });
        let nextMilestone = undefined;
        if (milestones) {
            // 아직 달성하지 않은 다음 마일스톤 찾기
            const { data: achieved } = await supabase_1.supabase
                .from('referral_milestone_achievements')
                .select('milestone_id')
                .eq('user_id', userId);
            const achievedIds = new Set(achieved?.map(a => a.milestone_id) || []);
            const next = milestones.find(m => !achievedIds.has(m.id) && m.required_referrals > (stats.total_referrals || 0));
            if (next) {
                nextMilestone = {
                    name: next.milestone_name,
                    required: next.required_referrals,
                    remaining: next.required_referrals - (stats.total_referrals || 0),
                    bonus: next.bonus_credits
                };
            }
        }
        return {
            userId,
            referralCode: stats.referral_code,
            totalReferrals: stats.total_referrals || 0,
            rewardedReferrals: stats.rewarded_referrals || 0,
            totalEarnedCredits: stats.total_earned_credits || 0,
            lastReferralAt: stats.last_referral_at ? new Date(stats.last_referral_at) : undefined,
            milestonesAchieved: stats.milestones_achieved || 0,
            nextMilestone
        };
    }
    catch (error) {
        console.error('❌ Error in getReferralStats:', error);
        return null;
    }
}
/**
 * 모든 마일스톤 조회
 */
async function getAllMilestones() {
    try {
        const { data: milestones, error } = await supabase_1.supabase
            .from('referral_milestones')
            .select('*')
            .eq('is_active', true)
            .order('display_order', { ascending: true });
        if (error || !milestones) {
            return [];
        }
        return milestones.map(m => ({
            id: m.id,
            milestoneName: m.milestone_name,
            requiredReferrals: m.required_referrals,
            bonusCredits: m.bonus_credits,
            specialReward: m.special_reward
        }));
    }
    catch (error) {
        console.error('❌ Error fetching milestones:', error);
        return [];
    }
}
/**
 * 사용자가 달성한 마일스톤 조회
 */
async function getUserMilestones(userId) {
    try {
        const { data, error } = await supabase_1.supabase
            .from('referral_milestone_achievements')
            .select('milestone_id')
            .eq('user_id', userId);
        if (error || !data) {
            return [];
        }
        return data.map(a => a.milestone_id);
    }
    catch (error) {
        console.error('❌ Error fetching user milestones:', error);
        return [];
    }
}
/**
 * 추천 링크 생성
 */
function generateReferralLink(referralCode, botUsername) {
    return `https://t.me/${botUsername}?start=ref_${referralCode}`;
}
/**
 * 추천 메시지 포맷팅
 */
function formatReferralMessage(stats, botUsername) {
    const link = generateReferralLink(stats.referralCode, botUsername);
    let message = `🎁 **친구 초대하고 크레딧 받기!**\n\n`;
    message += `**내 추천 코드:** \`${stats.referralCode}\`\n`;
    message += `**추천 링크:** ${link}\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `📊 **내 추천 현황:**\n`;
    message += `• 총 초대한 친구: ${stats.totalReferrals}명\n`;
    message += `• 획득한 크레딧: ${stats.totalEarnedCredits}회\n`;
    message += `• 달성한 마일스톤: ${stats.milestonesAchieved}개\n\n`;
    if (stats.nextMilestone) {
        message += `🎯 **다음 목표:**\n`;
        message += `• ${stats.nextMilestone.name}: ${stats.nextMilestone.required}명 초대\n`;
        message += `• ${stats.nextMilestone.remaining}명 남음\n`;
        message += `• 보상: ${stats.nextMilestone.bonus} 크레딧\n\n`;
    }
    message += `💡 **친구가 가입하면:**\n`;
    message += `• 나: +10 크레딧\n`;
    message += `• 친구: +10 크레딧\n\n`;
    message += `🏆 **마일스톤 보너스:**\n`;
    message += `• 5명: +20 크레딧 (브론즈)\n`;
    message += `• 10명: +50 크레딧 (실버)\n`;
    message += `• 25명: +150 크레딧 (골드)\n`;
    message += `• 50명: +500 크레딧 + VIP 혜택 (플래티넘)\n\n`;
    message += `친구들에게 링크를 공유하세요! 🚀`;
    return message;
}
/**
 * 추천 성공 메시지 (추천인용)
 */
function formatReferrerNotification(referredUsername, reward) {
    return `🎉 **새로운 친구 가입!**\n\n` +
        `@${referredUsername}님이 회원가입했습니다!\n\n` +
        `🎁 보상으로 ${reward} 크레딧을 받았습니다.\n\n` +
        `계속해서 친구를 초대하고 더 많은 보상을 받으세요!`;
}
/**
 * 추천 성공 메시지 (피추천인용)
 */
function formatReferredWelcome(reward) {
    return `🎊 **가입을 환영합니다!**\n\n` +
        `친구 추천으로 가입하여 ${reward} 크레딧을 받았습니다!\n\n` +
        `💡 당신도 친구를 초대하면:\n` +
        `• 친구 1명당 10 크레딧\n` +
        `• 마일스톤 달성 시 최대 500 크레딧\n\n` +
        `/referral 명령어로 내 추천 링크를 확인하세요! 🚀`;
}
/**
 * 마일스톤 달성 메시지
 */
function formatMilestoneAchievement(milestoneName, bonusCredits, specialReward) {
    let message = `🏆 **마일스톤 달성!**\n\n`;
    message += `**${milestoneName}** 레벨에 도달했습니다!\n\n`;
    message += `🎁 보상:\n`;
    message += `• ${bonusCredits} 크레딧 지급\n`;
    if (specialReward) {
        message += `• ${specialReward}\n`;
    }
    message += `\n계속해서 친구를 초대하고 더 큰 보상을 받으세요! 🚀`;
    return message;
}
