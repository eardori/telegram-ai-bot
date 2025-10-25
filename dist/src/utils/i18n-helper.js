"use strict";
/**
 * i18n Helper Utilities
 *
 * Simple language detection and translation functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserLanguage = getUserLanguage;
exports.t = t;
exports.getLanguageDisplayName = getLanguageDisplayName;
exports.parseLanguage = parseLanguage;
exports.toTelegramLanguageCode = toTelegramLanguageCode;
const messages_1 = require("../i18n/messages");
/**
 * Get user's preferred language
 * Priority:
 * 1. Database saved preference (user.language_code)
 * 2. Telegram language setting (ctx.from?.language_code)
 * 3. Default: 'ko'
 */
function getUserLanguage(ctx, user) {
    // 1. Check database preference
    if (user?.language_code) {
        const dbLang = user.language_code.toLowerCase();
        if (dbLang.startsWith('en'))
            return 'en';
        if (dbLang.startsWith('ko'))
            return 'ko';
    }
    // 2. Check Telegram language setting
    if (ctx.from?.language_code) {
        const telegramLang = ctx.from.language_code.toLowerCase();
        if (telegramLang.startsWith('en'))
            return 'en';
        if (telegramLang.startsWith('ko'))
            return 'ko';
    }
    // 3. Default to Korean
    return 'ko';
}
/**
 * Get translated message
 * @param key - Message key from messages object
 * @param lang - Language code ('ko' or 'en')
 */
function t(key, lang) {
    return messages_1.messages[lang][key] || messages_1.messages['ko'][key];
}
/**
 * Get language display name
 */
function getLanguageDisplayName(lang) {
    const names = {
        ko: '한국어',
        en: 'English'
    };
    return names[lang];
}
/**
 * Parse language from string input
 * Supports: 'ko', 'en', 'korean', 'english', '한국어', etc.
 */
function parseLanguage(input) {
    const normalized = input.toLowerCase().trim();
    // Korean
    if (['ko', 'kor', 'korean', '한국어', '한글'].includes(normalized)) {
        return 'ko';
    }
    // English
    if (['en', 'eng', 'english', '영어'].includes(normalized)) {
        return 'en';
    }
    return null;
}
/**
 * Format language code for Telegram API
 * Converts 'ko' -> 'ko-KR', 'en' -> 'en-US'
 */
function toTelegramLanguageCode(lang) {
    const mapping = {
        ko: 'ko-KR',
        en: 'en-US'
    };
    return mapping[lang];
}
