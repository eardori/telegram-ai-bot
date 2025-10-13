/**
 * i18n Helper Utilities
 *
 * Simple language detection and translation functions
 */

import { Context } from 'grammy';
import { messages, Language } from '../i18n/messages';
import { User } from '../services/auth-service';

/**
 * Get user's preferred language
 * Priority:
 * 1. Database saved preference (user.language_code)
 * 2. Telegram language setting (ctx.from?.language_code)
 * 3. Default: 'ko'
 */
export function getUserLanguage(ctx: Context, user?: User | null): Language {
  // 1. Check database preference
  if (user?.language_code) {
    const dbLang = user.language_code.toLowerCase();
    if (dbLang.startsWith('en')) return 'en';
    if (dbLang.startsWith('ko')) return 'ko';
  }

  // 2. Check Telegram language setting
  if (ctx.from?.language_code) {
    const telegramLang = ctx.from.language_code.toLowerCase();
    if (telegramLang.startsWith('en')) return 'en';
    if (telegramLang.startsWith('ko')) return 'ko';
  }

  // 3. Default to Korean
  return 'ko';
}

/**
 * Get translated message
 * @param key - Message key from messages object
 * @param lang - Language code ('ko' or 'en')
 */
export function t<K extends keyof typeof messages.ko>(
  key: K,
  lang: Language
): typeof messages.ko[K] {
  return messages[lang][key] || messages['ko'][key];
}

/**
 * Get language display name
 */
export function getLanguageDisplayName(lang: Language): string {
  const names: Record<Language, string> = {
    ko: '한국어',
    en: 'English'
  };
  return names[lang];
}

/**
 * Parse language from string input
 * Supports: 'ko', 'en', 'korean', 'english', '한국어', etc.
 */
export function parseLanguage(input: string): Language | null {
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
export function toTelegramLanguageCode(lang: Language): string {
  const mapping: Record<Language, string> = {
    ko: 'ko-KR',
    en: 'en-US'
  };
  return mapping[lang];
}
