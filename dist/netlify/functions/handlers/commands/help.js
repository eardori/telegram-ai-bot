"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupHelpCommand = setupHelpCommand;
exports.handleHelpCallback = handleHelpCallback;
function setupHelpCommand(bot) {
    bot.command('help', async (ctx) => {
        const extCtx = ctx;
        try {
            const language = extCtx.user?.languageCode || 'en';
            const isPrivateChat = ctx.chat?.type === 'private';
            const isAdmin = await isUserAdmin(extCtx);
            const helpMessage = getHelpMessage(language, isPrivateChat, isAdmin);
            await ctx.reply(helpMessage, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '🚀 Quick Start', callback_data: 'help:quickstart' },
                            { text: '📋 Commands', callback_data: 'help:commands' },
                        ],
                        [
                            { text: '⚙️ Settings', callback_data: 'help:settings' },
                            { text: '🔧 Advanced', callback_data: 'help:advanced' },
                        ],
                        [
                            { text: '❓ FAQ', callback_data: 'help:faq' },
                            { text: '💬 Support', url: 'https://t.me/multiful_support' },
                        ],
                        [
                            {
                                text: '📖 Documentation',
                                url: 'https://github.com/multiful/bot-telegram/wiki',
                            },
                        ],
                    ],
                },
                reply_to_message_id: ctx.message?.message_id,
            });
        }
        catch (error) {
            console.error('Error in /help command:', error);
            await ctx.reply('❌ Sorry, I encountered an error loading help. Please try again later.', { reply_to_message_id: ctx.message?.message_id });
        }
    });
}
async function handleHelpCallback(params, ctx) {
    const section = params[0] || 'main';
    const language = ctx.user?.languageCode || 'en';
    const isPrivateChat = ctx.chat?.type === 'private';
    const isAdmin = await isUserAdmin(ctx);
    let message;
    let keyboard;
    switch (section) {
        case 'quickstart':
            message = getQuickStartMessage(language, isPrivateChat);
            keyboard = [
                [{ text: '⬅️ Back to Help', callback_data: 'help:main' }],
            ];
            break;
        case 'commands':
            message = getCommandsMessage(language, isPrivateChat, isAdmin);
            keyboard = [
                [{ text: '⬅️ Back to Help', callback_data: 'help:main' }],
            ];
            break;
        case 'settings':
            message = getSettingsHelpMessage(language, isAdmin);
            keyboard = [
                [
                    { text: '⚙️ Open Settings', callback_data: 'settings:main' },
                    { text: '⬅️ Back to Help', callback_data: 'help:main' },
                ],
            ];
            break;
        case 'advanced':
            message = getAdvancedHelpMessage(language, isAdmin);
            keyboard = [
                [{ text: '⬅️ Back to Help', callback_data: 'help:main' }],
            ];
            break;
        case 'faq':
            message = getFAQMessage(language);
            keyboard = [
                [{ text: '⬅️ Back to Help', callback_data: 'help:main' }],
            ];
            break;
        default:
            message = getHelpMessage(language, isPrivateChat, isAdmin);
            keyboard = [
                [
                    { text: '🚀 Quick Start', callback_data: 'help:quickstart' },
                    { text: '📋 Commands', callback_data: 'help:commands' },
                ],
                [
                    { text: '⚙️ Settings', callback_data: 'help:settings' },
                    { text: '🔧 Advanced', callback_data: 'help:advanced' },
                ],
                [
                    { text: '❓ FAQ', callback_data: 'help:faq' },
                    { text: '💬 Support', url: 'https://t.me/multiful_support' },
                ],
            ];
    }
    try {
        await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard },
        });
    }
    catch (error) {
        await ctx.reply(message, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard },
        });
    }
}
function getHelpMessage(language, isPrivateChat, isAdmin) {
    const messages = {
        en: `
📖 <b>AI Summary Bot Help</b>

<b>🤖 What I Can Do:</b>
• Generate intelligent summaries of chat conversations
• Provide detailed analytics and insights
• Support multiple languages and customization
• Maintain privacy and security of your data

<b>🚀 Quick Commands:</b>
/start - Get started with the bot
/summary - Generate a summary of recent messages
/settings - Configure bot preferences ${isAdmin ? '(Admin)' : ''}
/stats - View chat statistics and analytics
/help - Show this help menu

${isPrivateChat ? '<b>💡 Tip:</b> Add me to a group to summarize group conversations!' : '<b>💡 Tip:</b> Use /summary to catch up on what you missed!'}

Choose a topic below for detailed help:
    `,
        es: `
📖 <b>Ayuda del Bot de Resumen IA</b>

<b>🤖 Lo Que Puedo Hacer:</b>
• Generar resúmenes inteligentes de conversaciones de chat
• Proporcionar análisis detallados e información
• Soportar múltiples idiomas y personalización
• Mantener la privacidad y seguridad de tus datos

<b>🚀 Comandos Rápidos:</b>
/start - Comenzar con el bot
/summary - Generar un resumen de mensajes recientes
/settings - Configurar preferencias del bot ${isAdmin ? '(Admin)' : ''}
/stats - Ver estadísticas y análisis del chat
/help - Mostrar este menú de ayuda

${isPrivateChat ? '<b>💡 Consejo:</b> ¡Agrégame a un grupo para resumir conversaciones grupales!' : '<b>💡 Consejo:</b> ¡Usa /summary para ponerte al día con lo que te perdiste!'}

Elige un tema abajo para ayuda detallada:
    `,
    };
    return (messages[language] || messages.en).trim();
}
function getQuickStartMessage(language, isPrivateChat) {
    const messages = {
        en: `
🚀 <b>Quick Start Guide</b>

<b>Step 1:</b> Add me to your group chat
${isPrivateChat ? '• Click the "Add to Group" button or manually add @your_bot_username' : '✅ Already done!'}

<b>Step 2:</b> Give me permission to read messages
• This allows me to analyze and summarize conversations

<b>Step 3:</b> Try your first summary
• Type /summary to generate a summary of recent messages
• Wait for at least 5-10 messages for better results

<b>Step 4:</b> Customize settings (Admin only)
• Use /settings to configure summary preferences
• Set language, frequency, and other options

<b>Step 5:</b> Explore advanced features
• View chat statistics with /stats
• Enable automatic summaries
• Set up scheduled summaries

<b>🎯 Pro Tips:</b>
• I work best with active group conversations
• Regular use helps me learn your group's patterns
• Check /help for all available features
    `,
    };
    return (messages[language] || messages.en).trim();
}
function getCommandsMessage(language, isPrivateChat, isAdmin) {
    const adminCommands = isAdmin ? `
<b>👑 Admin Commands:</b>
/settings - Configure bot settings and preferences
• Summary frequency and format options
• Language and timezone settings
• Privacy and permissions management

/stats admin - Access detailed admin statistics
• User activity patterns
• Message processing metrics
• Bot performance data
` : '';
    const messages = {
        en: `
📋 <b>Available Commands</b>

<b>🔥 Essential Commands:</b>
/start - Initialize bot and get welcome message
/help - Show this comprehensive help guide
/summary - Generate instant summary of recent chat
• Optional: /summary 50 (summarize last 50 messages)
• Optional: /summary today (summarize today's messages)

<b>📊 Analytics Commands:</b>
/stats - View basic chat statistics
• Message counts, active users, popular times
• Word clouds and topic trends
• Activity graphs and participation data

<b>⚙️ Customization:</b>
/lang [code] - Change your language preference
• Supported: en, es, fr, de, it, pt, ru, zh, ja, ko
/timezone [zone] - Set your timezone for scheduling

${adminCommands}

<b>💡 Message Interactions:</b>
• Reply to a message with /summary to summarize the thread
• Forward messages to me for analysis
• Use inline queries: @your_bot_username summary

<b>🔍 Advanced Usage:</b>
• Use hashtags in messages for better categorization
• Mention important topics for priority in summaries
• React to messages to influence importance scoring
    `,
    };
    return (messages[language] || messages.en).trim();
}
function getSettingsHelpMessage(language, isAdmin) {
    const messages = {
        en: `
⚙️ <b>Settings Guide</b>

${isAdmin ? `
<b>👑 Admin Settings:</b>
• <b>Summary Frequency:</b> Set automatic summary intervals
• <b>Summary Format:</b> Choose brief, detailed, or bullet points
• <b>Language:</b> Set default language for the group
• <b>Timezone:</b> Configure for accurate scheduling
• <b>Privacy Mode:</b> Control data collection and retention
• <b>User Permissions:</b> Who can request summaries
• <b>Content Filters:</b> Exclude sensitive topics
• <b>Notification Settings:</b> When and how to send summaries
` : `
<b>👤 User Settings:</b>
• <b>Language:</b> Your preferred language for responses
• <b>Notification Preferences:</b> Personal notification settings
• <b>Summary Format:</b> How you prefer to receive summaries
• <b>Privacy Settings:</b> Control your personal data usage
`}

<b>🎯 Recommended Settings:</b>
• Enable daily summaries for active groups
• Use detailed format for important discussions
• Set timezone to match your group's location
• Enable privacy mode for sensitive conversations

<b>🔧 Quick Setup:</b>
1. Open /settings
2. Configure basic preferences first
3. Test with /summary to see results
4. Adjust based on group needs

<i>Note: Some settings require admin privileges in group chats.</i>
    `,
    };
    return (messages[language] || messages.en).trim();
}
function getAdvancedHelpMessage(language, isAdmin) {
    const messages = {
        en: `
🔧 <b>Advanced Features</b>

<b>🤖 AI Capabilities:</b>
• <b>Intelligent Summarization:</b> Context-aware summaries
• <b>Topic Detection:</b> Automatic identification of main themes
• <b>Sentiment Analysis:</b> Understanding emotional tone
• <b>Language Detection:</b> Automatic language identification
• <b>Key Participant Identification:</b> Who said what

<b>📈 Analytics & Insights:</b>
• <b>Participation Patterns:</b> Who's most/least active
• <b>Time-based Analysis:</b> Peak activity hours and days
• <b>Content Analysis:</b> Most discussed topics and trends
• <b>Network Analysis:</b> Interaction patterns between users
• <b>Growth Metrics:</b> Group activity over time

<b>🔮 Smart Features:</b>
• <b>Proactive Summaries:</b> AI decides when summaries are needed
• <b>Context Preservation:</b> References to previous conversations
• <b>Multi-language Support:</b> Automatic translation when needed
• <b>Trend Prediction:</b> Forecast discussion topics
• <b>Duplicate Detection:</b> Avoid repetitive content

<b>🛡️ Privacy & Security:</b>
• <b>End-to-end Processing:</b> Messages processed securely
• <b>Data Retention Controls:</b> Configurable deletion policies
• <b>GDPR Compliance:</b> European privacy standards
• <b>Encryption:</b> All data encrypted at rest and in transit
• <b>Audit Logs:</b> Track all bot interactions

<b>🔗 Integrations:</b>
• <b>Webhook Support:</b> Connect to external services
• <b>API Access:</b> Programmatic access to summaries
• <b>Export Options:</b> PDF, HTML, and JSON formats
• <b>Calendar Integration:</b> Schedule summaries
• <b>Custom Commands:</b> Create group-specific commands

<b>⚡ Performance Features:</b>
• <b>Caching:</b> Fast response times
• <b>Rate Limiting:</b> Prevent abuse
• <b>Load Balancing:</b> Handle high traffic
• <b>Monitoring:</b> Real-time health checks
• <b>Auto-scaling:</b> Adapt to usage patterns
    `,
    };
    return (messages[language] || messages.en).trim();
}
function getFAQMessage(language) {
    const messages = {
        en: `
❓ <b>Frequently Asked Questions</b>

<b>Q: How many messages do I need for a summary?</b>
A: Minimum 5 messages, but 20+ works best for quality summaries.

<b>Q: Can the bot read all my messages?</b>
A: Only messages sent after adding the bot. Historical messages aren't accessible.

<b>Q: Is my data secure and private?</b>
A: Yes! Data is encrypted, processed securely, and deleted based on retention settings.

<b>Q: Does the bot work in private chats?</b>
A: Yes, but it's most useful in group chats with multiple participants.

<b>Q: Can I customize the summary format?</b>
A: Absolutely! Use /settings to choose brief, detailed, or bullet-point formats.

<b>Q: What languages are supported?</b>
A: English, Spanish, French, German, Italian, Portuguese, Russian, Chinese, Japanese, Korean.

<b>Q: How often can I request summaries?</b>
A: Rate limits apply: 5 summaries per hour for regular users, more for premium.

<b>Q: Can I exclude certain topics from summaries?</b>
A: Yes, admins can set content filters in /settings to exclude sensitive topics.

<b>Q: Does the bot work offline?</b>
A: No, an internet connection is required for AI processing.

<b>Q: How do I report bugs or suggest features?</b>
A: Contact support at @multiful_support or create an issue on GitHub.

<b>Q: Is there a premium version?</b>
A: Coming soon! Premium will offer unlimited summaries, advanced analytics, and priority support.

<b>Q: Can I use the bot in multiple groups?</b>
A: Yes! Add the bot to any group where you have admin permissions.
    `,
    };
    return (messages[language] || messages.en).trim();
}
async function isUserAdmin(ctx) {
    try {
        if (ctx.chat?.type === 'private')
            return true;
        if (!ctx.from || !ctx.chat)
            return false;
        const adminIds = ctx.chat.settings?.admin_users || [];
        return adminIds.includes(ctx.from.id.toString());
    }
    catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
}
//# sourceMappingURL=help.js.map