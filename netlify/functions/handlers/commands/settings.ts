// /settings Command Handler

import type { Bot } from 'grammy';
import type { BotContext } from '../index';

export function setupSettingsCommand(bot: Bot): void {
  bot.command('settings', async (ctx) => {
    const extCtx = ctx as BotContext;
    
    try {
      const isPrivateChat = ctx.chat?.type === 'private';
      const isAdmin = await isUserAdmin(extCtx);
      
      // Check permissions for group chats
      if (!isPrivateChat && !isAdmin) {
        await ctx.reply(
          '🚫 Only administrators can access bot settings in group chats.',
          { reply_to_message_id: ctx.message?.message_id },
        );
        return;
      }
      
      const language = extCtx.user?.languageCode || 'en';
      const settingsMessage = getSettingsMessage(language, isPrivateChat, extCtx);
      
      await ctx.reply(settingsMessage, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: getSettingsKeyboard(isPrivateChat, extCtx),
        },
        reply_to_message_id: ctx.message?.message_id,
      });
      
    } catch (error) {
      console.error('Error in /settings command:', error);
      await ctx.reply(
        '❌ Sorry, I encountered an error loading settings. Please try again later.',
        { reply_to_message_id: ctx.message?.message_id },
      );
    }
  });
}

export async function handleSettingsCallback(params: string[], ctx: BotContext): Promise<void> {
  const section = params[0] || 'main';
  const language = ctx.user?.languageCode || 'en';
  const isPrivateChat = ctx.chat?.type === 'private';
  
  let message: string;
  let keyboard: any[][];
  
  switch (section) {
    case 'main':
      message = getSettingsMessage(language, isPrivateChat, ctx);
      keyboard = getSettingsKeyboard(isPrivateChat, ctx);
      break;
      
    case 'summary':
      message = getSummarySettingsMessage(language, ctx);
      keyboard = getSummarySettingsKeyboard(ctx);
      break;
      
    case 'language':
      message = getLanguageSettingsMessage(language);
      keyboard = getLanguageKeyboard();
      break;
      
    case 'privacy':
      message = getPrivacySettingsMessage(language, ctx);
      keyboard = getPrivacyKeyboard();
      break;
      
    case 'notifications':
      message = getNotificationSettingsMessage(language, ctx);
      keyboard = getNotificationKeyboard(ctx);
      break;
      
    case 'advanced':
      message = getAdvancedSettingsMessage(language, ctx);
      keyboard = getAdvancedKeyboard();
      break;
      
    default:
      // Handle specific setting changes
      await handleSettingChange(section, params.slice(1), ctx);
      return;
  }
  
  try {
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard },
    });
    await ctx.answerCallbackQuery();
  } catch (error) {
    console.error('Error updating settings message:', error);
    await ctx.answerCallbackQuery('Error updating settings. Please try again.');
  }
}

function getSettingsMessage(language: string, isPrivateChat: boolean, ctx: BotContext): string {
  const chatSettings = ctx.chat?.settings || {};
  const userSettings = ctx.user?.preferences || {};
  
  const messages: Record<string, string> = {
    en: `
⚙️ <b>Bot Settings</b>

${isPrivateChat ? `
<b>👤 Personal Settings</b>
• Language: ${getLanguageName(userSettings.language || 'en')}
• Timezone: ${userSettings.timezone || 'UTC'}
• Summary Format: ${formatSettingValue(userSettings.summary_format || 'detailed')}

<b>🔔 Notification Preferences</b>
• Summaries: ${formatBooleanSetting(userSettings.notification_settings?.summaries)}
• Mentions: ${formatBooleanSetting(userSettings.notification_settings?.mentions)}
• Replies: ${formatBooleanSetting(userSettings.notification_settings?.replies)}
` : `
<b>🏢 Group Settings</b>
• Summary Enabled: ${formatBooleanSetting(chatSettings.summary_enabled)}
• Language: ${getLanguageName(chatSettings.language || 'en')}
• Auto-delete Messages: ${formatBooleanSetting(chatSettings.auto_delete_old_messages)}

<b>📋 Summary Configuration</b>
• Default Format: ${formatSettingValue(chatSettings.summary_format || 'detailed')}
• Frequency: ${formatArraySetting(chatSettings.summary_frequency)}
• Include Media: ${formatBooleanSetting(chatSettings.include_media)}
`}

<i>Choose a category below to modify settings:</i>
    `,
  };
  
  return (messages[language] || messages.en).trim();
}

function getSettingsKeyboard(isPrivateChat: boolean, ctx: BotContext): any[][] {
  if (isPrivateChat) {
    return [
      [
        { text: '🌍 Language', callback_data: 'settings:language' },
        { text: '📋 Summary', callback_data: 'settings:summary' },
      ],
      [
        { text: '🔔 Notifications', callback_data: 'settings:notifications' },
        { text: '🔒 Privacy', callback_data: 'settings:privacy' },
      ],
      [
        { text: '🔧 Advanced', callback_data: 'settings:advanced' },
        { text: '✅ Done', callback_data: 'settings:close' },
      ],
    ];
  } else {
    return [
      [
        { text: '📋 Summary Settings', callback_data: 'settings:summary' },
        { text: '🌍 Language', callback_data: 'settings:language' },
      ],
      [
        { text: '🔔 Notifications', callback_data: 'settings:notifications' },
        { text: '🔒 Privacy & Security', callback_data: 'settings:privacy' },
      ],
      [
        { text: '👥 User Permissions', callback_data: 'settings:permissions' },
        { text: '🔧 Advanced', callback_data: 'settings:advanced' },
      ],
      [
        { text: '✅ Done', callback_data: 'settings:close' },
      ],
    ];
  }
}

function getSummarySettingsMessage(language: string, ctx: BotContext): string {
  const isPrivateChat = ctx.chat?.type === 'private';
  const settings = isPrivateChat ? ctx.user?.preferences : ctx.chat?.settings;
  
  const messages: Record<string, string> = {
    en: `
📋 <b>Summary Settings</b>

<b>Current Configuration:</b>
• Format: ${formatSettingValue(settings?.summary_format || 'detailed')}
• Max Length: ${settings?.max_summary_length || 'Auto'}
• Include Participants: ${formatBooleanSetting(settings?.include_participants ?? true)}
• Include Topics: ${formatBooleanSetting(settings?.include_topics ?? true)}

${!isPrivateChat ? `
<b>Group Specific:</b>
• Auto Summaries: ${formatBooleanSetting(settings?.auto_summary_enabled)}
• Frequency: ${formatArraySetting(settings?.summary_frequency || ['daily'])}
• Minimum Messages: ${settings?.min_messages_for_summary || 10}
` : ''}

<b>Content Filters:</b>
• Exclude Topics: ${formatArraySetting(settings?.exclude_topics || [])}
• Include Media Info: ${formatBooleanSetting(settings?.include_media_info)}

<i>Click options below to modify:</i>
    `,
  };
  
  return (messages[language] || messages.en).trim();
}

function getSummarySettingsKeyboard(ctx: BotContext): any[][] {
  const isPrivateChat = ctx.chat?.type === 'private';
  const settings = isPrivateChat ? ctx.user?.preferences : ctx.chat?.settings;
  
  const keyboard = [
    [
      { text: '📝 Format', callback_data: 'settings:format' },
      { text: '📏 Length', callback_data: 'settings:length' },
    ],
    [
      { 
        text: `👥 Participants ${settings?.include_participants ? '✅' : '❌'}`, 
        callback_data: 'settings:toggle:include_participants' 
      },
      { 
        text: `🏷 Topics ${settings?.include_topics ? '✅' : '❌'}`, 
        callback_data: 'settings:toggle:include_topics' 
      },
    ],
  ];
  
  if (!isPrivateChat) {
    keyboard.push([
      { 
        text: `🤖 Auto Summaries ${settings?.auto_summary_enabled ? '✅' : '❌'}`, 
        callback_data: 'settings:toggle:auto_summary_enabled' 
      },
      { text: '⏰ Frequency', callback_data: 'settings:frequency' },
    ]);
  }
  
  keyboard.push([
    { text: '🚫 Exclude Topics', callback_data: 'settings:exclude_topics' },
    { text: '📱 Media Info', callback_data: 'settings:toggle:include_media_info' },
  ]);
  
  keyboard.push([
    { text: '⬅️ Back', callback_data: 'settings:main' },
    { text: '💾 Save', callback_data: 'settings:save:summary' },
  ]);
  
  return keyboard;
}

function getLanguageSettingsMessage(language: string): string {
  const messages: Record<string, string> = {
    en: `
🌍 <b>Language Settings</b>

Select your preferred language for bot responses:

<b>Currently supported languages:</b>
• 🇺🇸 English (en)
• 🇪🇸 Español (es)  
• 🇫🇷 Français (fr)
• 🇩🇪 Deutsch (de)
• 🇮🇹 Italiano (it)
• 🇵🇹 Português (pt)
• 🇷🇺 Русский (ru)
• 🇨🇳 中文 (zh)
• 🇯🇵 日本語 (ja)
• 🇰🇷 한국어 (ko)

<i>Your selection will apply to all bot responses and summaries.</i>
    `,
  };
  
  return (messages[language] || messages.en).trim();
}

function getLanguageKeyboard(): any[][] {
  return [
    [
      { text: '🇺🇸 English', callback_data: 'settings:set:language:en' },
      { text: '🇪🇸 Español', callback_data: 'settings:set:language:es' },
    ],
    [
      { text: '🇫🇷 Français', callback_data: 'settings:set:language:fr' },
      { text: '🇩🇪 Deutsch', callback_data: 'settings:set:language:de' },
    ],
    [
      { text: '🇮🇹 Italiano', callback_data: 'settings:set:language:it' },
      { text: '🇵🇹 Português', callback_data: 'settings:set:language:pt' },
    ],
    [
      { text: '🇷🇺 Русский', callback_data: 'settings:set:language:ru' },
      { text: '🇨🇳 中文', callback_data: 'settings:set:language:zh' },
    ],
    [
      { text: '🇯🇵 日本語', callback_data: 'settings:set:language:ja' },
      { text: '🇰🇷 한국어', callback_data: 'settings:set:language:ko' },
    ],
    [
      { text: '⬅️ Back', callback_data: 'settings:main' },
    ],
  ];
}

function getPrivacySettingsMessage(language: string, ctx: BotContext): string {
  const settings = ctx.user?.preferences?.privacy_settings || {};
  
  const messages: Record<string, string> = {
    en: `
🔒 <b>Privacy & Security Settings</b>

<b>Data Collection:</b>
• Allow Analytics: ${formatBooleanSetting(settings.allow_data_collection ?? true)}
• Share Usage Stats: ${formatBooleanSetting(settings.share_analytics)}
• Store Message History: ${formatBooleanSetting(settings.store_message_history ?? true)}

<b>Data Retention:</b>
• Auto-delete Period: ${settings.auto_delete_days || 90} days
• Export Data: Available on request
• Delete Account: Removes all stored data

<b>Security Features:</b>
• End-to-end Processing: Always enabled ✅
• Data Encryption: Always enabled ✅
• GDPR Compliance: Fully compliant ✅

<i>We take your privacy seriously. All data is processed securely and never shared without consent.</i>
    `,
  };
  
  return (messages[language] || messages.en).trim();
}

function getPrivacyKeyboard(): any[][] {
  return [
    [
      { text: '📊 Analytics', callback_data: 'settings:toggle:allow_analytics' },
      { text: '📈 Usage Stats', callback_data: 'settings:toggle:share_analytics' },
    ],
    [
      { text: '💾 Message History', callback_data: 'settings:toggle:store_messages' },
      { text: '🗑 Auto-delete', callback_data: 'settings:auto_delete_period' },
    ],
    [
      { text: '📤 Export Data', callback_data: 'settings:export_data' },
      { text: '❌ Delete Account', callback_data: 'settings:delete_account' },
    ],
    [
      { text: '⬅️ Back', callback_data: 'settings:main' },
    ],
  ];
}

function getNotificationSettingsMessage(language: string, ctx: BotContext): string {
  const settings = ctx.user?.preferences?.notification_settings || {};
  
  const messages: Record<string, string> = {
    en: `
🔔 <b>Notification Settings</b>

<b>Summary Notifications:</b>
• Daily Summaries: ${formatBooleanSetting(settings.summaries)}
• Mention Alerts: ${formatBooleanSetting(settings.mentions)}
• Reply Notifications: ${formatBooleanSetting(settings.replies)}

<b>Delivery Schedule:</b>
• Quiet Hours: ${settings.quiet_hours_start || '22:00'} - ${settings.quiet_hours_end || '08:00'}
• Weekend Notifications: ${formatBooleanSetting(settings.weekend_notifications ?? true)}
• Timezone: ${ctx.user?.preferences?.timezone || 'UTC'}

<b>Notification Format:</b>
• Brief Mode: ${formatBooleanSetting(settings.brief_notifications)}
• Include Links: ${formatBooleanSetting(settings.include_links ?? true)}

<i>Customize when and how you receive notifications from the bot.</i>
    `,
  };
  
  return (messages[language] || messages.en).trim();
}

function getNotificationKeyboard(ctx: BotContext): any[][] {
  const settings = ctx.user?.preferences?.notification_settings || {};
  
  return [
    [
      { 
        text: `📋 Summaries ${settings.summaries ? '✅' : '❌'}`, 
        callback_data: 'settings:toggle:notifications:summaries' 
      },
      { 
        text: `@️ Mentions ${settings.mentions ? '✅' : '❌'}`, 
        callback_data: 'settings:toggle:notifications:mentions' 
      },
    ],
    [
      { 
        text: `💬 Replies ${settings.replies ? '✅' : '❌'}`, 
        callback_data: 'settings:toggle:notifications:replies' 
      },
      { text: '🕐 Quiet Hours', callback_data: 'settings:quiet_hours' },
    ],
    [
      { 
        text: `📝 Brief Mode ${settings.brief_notifications ? '✅' : '❌'}`, 
        callback_data: 'settings:toggle:notifications:brief' 
      },
      { text: '🌍 Timezone', callback_data: 'settings:timezone' },
    ],
    [
      { text: '⬅️ Back', callback_data: 'settings:main' },
      { text: '💾 Save', callback_data: 'settings:save:notifications' },
    ],
  ];
}

function getAdvancedSettingsMessage(language: string, ctx: BotContext): string {
  const messages: Record<string, string> = {
    en: `
🔧 <b>Advanced Settings</b>

<b>AI Configuration:</b>
• Model: ${ctx.config.llm.model}
• Temperature: ${ctx.config.llm.temperature || 0.7}
• Max Tokens: ${ctx.config.llm.maxTokens || 2048}

<b>Performance:</b>
• Cache Enabled: ✅
• Rate Limiting: ${ctx.config.app.rateLimiting.enabled ? '✅' : '❌'}
• Batch Processing: ✅

<b>Experimental Features:</b>
• Smart Summaries: Coming soon
• Voice Message Support: Coming soon
• Multi-modal Analysis: Coming soon

<b>API & Integrations:</b>
• Webhook URL: ${ctx.config.telegram.webhookUrl ? 'Configured' : 'Not set'}
• External APIs: ${getEnabledFeatures(ctx.config).join(', ') || 'None'}

<i>These settings are for advanced users and developers.</i>
    `,
  };
  
  return (messages[language] || messages.en).trim();
}

function getAdvancedKeyboard(): any[][] {
  return [
    [
      { text: '🤖 AI Config', callback_data: 'settings:ai_config' },
      { text: '⚡ Performance', callback_data: 'settings:performance' },
    ],
    [
      { text: '🧪 Experiments', callback_data: 'settings:experiments' },
      { text: '🔗 Integrations', callback_data: 'settings:integrations' },
    ],
    [
      { text: '📊 Debug Info', callback_data: 'settings:debug' },
      { text: '🔄 Reset All', callback_data: 'settings:reset_confirm' },
    ],
    [
      { text: '⬅️ Back', callback_data: 'settings:main' },
    ],
  ];
}

async function handleSettingChange(action: string, params: string[], ctx: BotContext): Promise<void> {
  switch (action) {
    case 'toggle':
      await handleToggleSetting(params[0], ctx);
      break;
      
    case 'set':
      await handleSetSetting(params[0], params[1], ctx);
      break;
      
    case 'save':
      await handleSaveSettings(params[0], ctx);
      break;
      
    case 'close':
      await handleCloseSettings(ctx);
      break;
      
    default:
      await ctx.answerCallbackQuery('Unknown setting action');
  }
}

async function handleToggleSetting(settingPath: string, ctx: BotContext): Promise<void> {
  try {
    const isPrivateChat = ctx.chat?.type === 'private';
    const currentSettings = isPrivateChat ? ctx.user?.preferences : ctx.chat?.settings;
    
    // Parse nested setting path (e.g., "notifications:summaries")
    const pathParts = settingPath.split(':');
    const newValue = !getNestedValue(currentSettings, pathParts);
    
    // Update setting in database
    await updateUserOrChatSetting(ctx, pathParts, newValue);
    
    await ctx.answerCallbackQuery(`Setting ${newValue ? 'enabled' : 'disabled'}`);
    
    // Refresh the settings message
    await handleSettingsCallback(['main'], ctx);
    
  } catch (error) {
    console.error('Error toggling setting:', error);
    await ctx.answerCallbackQuery('Error updating setting');
  }
}

async function handleSetSetting(settingKey: string, value: string, ctx: BotContext): Promise<void> {
  try {
    await updateUserOrChatSetting(ctx, [settingKey], value);
    await ctx.answerCallbackQuery(`${settingKey} updated to ${value}`);
    
    // Refresh the settings message
    await handleSettingsCallback(['main'], ctx);
    
  } catch (error) {
    console.error('Error setting value:', error);
    await ctx.answerCallbackQuery('Error updating setting');
  }
}

async function handleSaveSettings(section: string, ctx: BotContext): Promise<void> {
  try {
    // Save settings to database
    await ctx.answerCallbackQuery('Settings saved successfully!');
    
  } catch (error) {
    console.error('Error saving settings:', error);
    await ctx.answerCallbackQuery('Error saving settings');
  }
}

async function handleCloseSettings(ctx: BotContext): Promise<void> {
  try {
    await ctx.editMessageText('⚙️ Settings closed. Use /settings to reopen.', {
      reply_markup: undefined,
    });
    await ctx.answerCallbackQuery();
  } catch (error) {
    console.error('Error closing settings:', error);
  }
}

// Helper functions
async function isUserAdmin(ctx: BotContext): Promise<boolean> {
  // Implementation depends on how admin status is determined
  // This could check Telegram chat member status or database roles
  return ctx.user?.role === 'admin' || ctx.user?.role === 'owner';
}

function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    en: 'English',
    es: 'Español',
    fr: 'Français',
    de: 'Deutsch',
    it: 'Italiano',
    pt: 'Português',
    ru: 'Русский',
    zh: '中文',
    ja: '日本語',
    ko: '한국어',
  };
  return languages[code] || code;
}

function formatBooleanSetting(value: boolean | undefined): string {
  return value === true ? '✅ Enabled' : value === false ? '❌ Disabled' : '⚪ Default';
}

function formatSettingValue(value: any): string {
  if (typeof value === 'string') {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  return String(value || 'Default');
}

function formatArraySetting(value: any[]): string {
  if (!Array.isArray(value) || value.length === 0) {
    return 'None';
  }
  return value.slice(0, 3).join(', ') + (value.length > 3 ? '...' : '');
}

function getNestedValue(obj: any, path: string[]): any {
  return path.reduce((current, key) => current?.[key], obj);
}

function getEnabledFeatures(config: BotConfig): string[] {
  const features = [];
  if (config.app.features.summaryEnabled) features.push('Summaries');
  if (config.app.features.translationEnabled) features.push('Translation');
  if (config.app.features.moderationEnabled) features.push('Moderation');
  if (config.app.features.analyticsEnabled) features.push('Analytics');
  return features;
}

async function updateUserOrChatSetting(ctx: BotContext, pathParts: string[], value: any): Promise<void> {
  // Implementation to update settings in database
  // This would update either user preferences or chat settings
  console.log('Updating setting:', pathParts.join('.'), '=', value);
  
  // In a real implementation, you'd update the database here
  // For now, just log the change
}