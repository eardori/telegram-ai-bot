"use strict";
/**
 * Multilingual Messages
 *
 * Simple JSON-based i18n system for Korean and English support
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.messages = void 0;
exports.messages = {
    ko: {
        // Welcome & Help
        welcome: '안녕하세요! 🎨\n\n사진을 보내주시면 AI가 자동으로 분석하여 최적의 스타일을 추천해드립니다!\n\n✨ 신규 가입 보너스: 5회 무료 편집\n🎁 친구 초대하고 크레딧 받기: /referral',
        helpMain: '📖 **도비 픽시 도움말**\n\n🎨 **AI 사진 편집 봇**\n사진을 보내면 38가지 스타일로 변환할 수 있습니다!',
        helpFeatures: '✨ **주요 기능**\n• AI 자동 분석 및 스타일 추천\n• 38+ 프리미엄 AI 스타일\n• 초고속 처리 (30초)\n• 앱 설치 불필요',
        helpCommands: '🤖 **명령어**\n/start - 봇 시작\n/help - 도움말\n/credits - 크레딧 잔액 확인\n/referral - 친구 초대\n/language - 언어 변경',
        helpSupport: '💬 **고객 지원**: @eardori',
        // Photo Upload & Processing
        photoUploadPrompt: '📸 편집할 사진을 보내주세요!',
        aiAnalyzing: (title, description) => `🎨 **AI 추천으로 편집 중...**\n\n✨ ${title}\n${description}\n\n⏳ 잠시만 기다려주세요...`,
        imageProcessing: (templateName) => `🎨 **이미지 편집 중...**\n\n✨ ${templateName}\n\n⏳ 30초 정도 소요됩니다...`,
        editComplete: '✅ 편집이 완료되었습니다!',
        aiRecommendationError: '❌ AI 추천 편집 중 오류가 발생했습니다.',
        // Credits
        creditsBalance: (free, paid, subscription, total) => `💳 **크레딧 잔액**\n\n🎁 무료: ${free}회\n💰 충전: ${paid}회\n⭐ 구독: ${subscription}회\n\n**총 ${total}회** 사용 가능`,
        creditsLow: (current, required) => `⚠️ 크레딧이 부족합니다.\n\n현재 잔액: ${current}회\n필요한 크레딧: ${required}회`,
        creditsInsufficient: '❌ 크레딧이 부족합니다.',
        topUpPrompt: '💰 크레딧을 충전하시겠어요?',
        // Referral
        referralTitle: '🎁 **친구 초대하고 크레딧 받기!**',
        referralCode: (code) => `📋 **내 추천 코드:** \`${code}\``,
        referralLink: (link) => `🔗 **초대 링크:**\n${link}`,
        referralStats: (invites, credits) => `📊 **초대 통계**\n👥 총 초대: ${invites}명\n💰 획득 크레딧: ${credits}회`,
        referralNextMilestone: (milestone, current, target) => `🎯 다음 마일스톤: ${milestone}\n진행률: ${current}/${target}명`,
        referralSharePrompt: '친구에게 공유하기',
        // Templates & Categories
        selectStyle: '🎨 **어떤 스타일로 편집할까요?**',
        selectCategory: '📂 **카테고리를 선택해주세요:**',
        templateNotFound: '❌ 선택한 템플릿을 찾을 수 없습니다.',
        categoryNotFound: (category) => `❌ ${category} 카테고리를 불러오는 중 오류가 발생했습니다.`,
        // Errors
        errorGeneric: '❌ 오류가 발생했습니다. 다시 시도해주세요.',
        errorUnexpected: '🧙‍♀️ **도비가 예상치 못한 문제를 만났습니다...**\n\n다시 시도해주세요.',
        errorImageProcessing: '❌ 사진 처리 중 오류가 발생했습니다.',
        errorTemplateList: '❌ 템플릿 목록을 가져오는 중 오류가 발생했습니다.',
        errorOriginalImageNotFound: '❌ 원본 이미지를 찾을 수 없습니다.',
        errorFileIdNotFound: '파일 ID를 찾을 수 없습니다. 사진을 다시 업로드해주세요.',
        errorRetry: '❌ 다시 시도해주세요.',
        // Buttons
        btnEditAgain: '다시 편집하기',
        btnBackToOriginal: '원본으로 돌아가기',
        btnTopUpCredits: '크레딧 충전',
        btnEnterReferralCode: '추천 코드 입력하기',
        btnSelectTemplate: '템플릿 선택',
        btnShare: '공유하기',
        // Categories
        category3DFigurine: '3D/피규어',
        categoryPortraitStyling: '인물 스타일',
        categoryGameAnimation: '게임/애니',
        categoryImageEditing: '이미지 편집',
        categoryCreativeTransform: '창의적 변환',
        // Language
        languageChanged: (lang) => `✅ 언어가 ${lang}(으)로 변경되었습니다.`,
        selectLanguage: '🌍 언어를 선택해주세요:',
        // Admin
        adminOnly: '⛔ 이 명령어는 관리자만 사용할 수 있습니다.',
    },
    en: {
        // Welcome & Help
        welcome: 'Hello! 🎨\n\nSend me a photo and AI will automatically analyze it and recommend the best style!\n\n✨ New user bonus: 5 FREE edits\n🎁 Invite friends for credits: /referral',
        helpMain: '📖 **Doby Pixie Help**\n\n🎨 **AI Photo Editor Bot**\nSend a photo to transform it with 38+ styles!',
        helpFeatures: '✨ **Key Features**\n• AI auto-analysis & style recommendations\n• 38+ premium AI styles\n• Lightning fast (30 seconds)\n• No app download needed',
        helpCommands: '🤖 **Commands**\n/start - Start bot\n/help - Help\n/credits - Check credit balance\n/referral - Invite friends\n/language - Change language',
        helpSupport: '💬 **Support**: @eardori',
        // Photo Upload & Processing
        photoUploadPrompt: '📸 Send me a photo to edit!',
        aiAnalyzing: (title, description) => `🎨 **Editing with AI recommendation...**\n\n✨ ${title}\n${description}\n\n⏳ Please wait...`,
        imageProcessing: (templateName) => `🎨 **Processing image...**\n\n✨ ${templateName}\n\n⏳ Takes about 30 seconds...`,
        editComplete: '✅ Edit complete!',
        aiRecommendationError: '❌ Error during AI recommendation editing.',
        // Credits
        creditsBalance: (free, paid, subscription, total) => `💳 **Credit Balance**\n\n🎁 Free: ${free} edits\n💰 Paid: ${paid} edits\n⭐ Subscription: ${subscription} edits\n\n**Total: ${total} edits** available`,
        creditsLow: (current, required) => `⚠️ Insufficient credits.\n\nCurrent balance: ${current} edits\nRequired: ${required} edits`,
        creditsInsufficient: '❌ Insufficient credits.',
        topUpPrompt: '💰 Would you like to top up credits?',
        // Referral
        referralTitle: '🎁 **Invite Friends & Earn Credits!**',
        referralCode: (code) => `📋 **My referral code:** \`${code}\``,
        referralLink: (link) => `🔗 **Invitation link:**\n${link}`,
        referralStats: (invites, credits) => `📊 **Referral Stats**\n👥 Total invites: ${invites}\n💰 Credits earned: ${credits}`,
        referralNextMilestone: (milestone, current, target) => `🎯 Next milestone: ${milestone}\nProgress: ${current}/${target}`,
        referralSharePrompt: 'Share with friends',
        // Templates & Categories
        selectStyle: '🎨 **Choose your editing style:**',
        selectCategory: '📂 **Select a category:**',
        templateNotFound: '❌ Selected template not found.',
        categoryNotFound: (category) => `❌ Error loading ${category} category.`,
        // Errors
        errorGeneric: '❌ An error occurred. Please try again.',
        errorUnexpected: '🧙‍♀️ **Doby encountered an unexpected issue...**\n\nPlease try again.',
        errorImageProcessing: '❌ Error processing photo.',
        errorTemplateList: '❌ Error loading template list.',
        errorOriginalImageNotFound: '❌ Original image not found.',
        errorFileIdNotFound: 'File ID not found. Please upload the photo again.',
        errorRetry: '❌ Please try again.',
        // Buttons
        btnEditAgain: 'Edit Again',
        btnBackToOriginal: 'Back to Original',
        btnTopUpCredits: 'Top Up Credits',
        btnEnterReferralCode: 'Enter Referral Code',
        btnSelectTemplate: 'Select Template',
        btnShare: 'Share',
        // Categories
        category3DFigurine: '3D/Figurine',
        categoryPortraitStyling: 'Portrait Styling',
        categoryGameAnimation: 'Game/Animation',
        categoryImageEditing: 'Image Editing',
        categoryCreativeTransform: 'Creative Transform',
        // Language
        languageChanged: (lang) => `✅ Language changed to ${lang}.`,
        selectLanguage: '🌍 Please select your language:',
        // Admin
        adminOnly: '⛔ This command is for admins only.',
    }
};
