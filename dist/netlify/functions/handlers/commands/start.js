"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupStartCommand = setupStartCommand;
function setupStartCommand(bot) {
    bot.command('start', async (ctx) => {
        const extCtx = ctx;
        try {
            const language = extCtx.user?.languageCode || 'en';
            const firstName = extCtx.user?.firstName || ctx.from?.first_name || 'there';
            const isPrivateChat = ctx.chat?.type === 'private';
            const welcomeMessage = isPrivateChat
                ? getPrivateWelcomeMessage(firstName, language)
                : getGroupWelcomeMessage(firstName, language);
            await ctx.reply(welcomeMessage, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '📋 Quick Summary', callback_data: 'summary:quick' },
                            { text: '⚙️ Settings', callback_data: 'settings:main' },
                        ],
                        [
                            { text: '📊 Chat Stats', callback_data: 'stats:overview' },
                            { text: '❓ Help', callback_data: 'help:main' },
                        ],
                        [
                            {
                                text: '🌐 Visit Website',
                                url: 'https://github.com/multiful/bot-telegram',
                            },
                        ],
                    ],
                },
            });
            console.log(`User ${ctx.from?.id} started the bot in ${ctx.chat?.type} chat ${ctx.chat?.id}`);
            if (extCtx.config.app.features.analyticsEnabled) {
                await trackBotStart(extCtx);
            }
        }
        catch (error) {
            console.error('Error in /start command:', error);
            await ctx.reply('❌ Sorry, I encountered an error. Please try again later.', { reply_to_message_id: ctx.message?.message_id });
        }
    });
}
function getPrivateWelcomeMessage(firstName, language) {
    const messages = {
        en: `
🤖 <b>Welcome to AI Summary Bot, ${firstName}!</b>

I'm your intelligent chat assistant that can help you with:

🔹 <b>Smart Summaries</b> - Get concise summaries of long conversations
🔹 <b>Chat Analytics</b> - Detailed insights about group activity  
🔹 <b>Message Management</b> - Organize and search through chat history
🔹 <b>Multi-language Support</b> - Communicate in your preferred language
🔹 <b>Privacy Focused</b> - Your data stays secure and private

<b>Quick Start:</b>
• Use /help to see all available commands
• Try /summary to generate a quick chat summary
• Configure your preferences with /settings

Ready to get started? Choose an option below! 👇
    `,
        es: `
🤖 <b>¡Bienvenido al Bot de Resumen IA, ${firstName}!</b>

Soy tu asistente inteligente de chat que puede ayudarte con:

🔹 <b>Resúmenes Inteligentes</b> - Obtén resúmenes concisos de conversaciones largas
🔹 <b>Análisis de Chat</b> - Perspectivas detalladas sobre la actividad del grupo
🔹 <b>Gestión de Mensajes</b> - Organiza y busca en el historial del chat
🔹 <b>Soporte Multiidioma</b> - Comunícate en tu idioma preferido
🔹 <b>Enfocado en Privacidad</b> - Tus datos permanecen seguros y privados

<b>Inicio Rápido:</b>
• Usa /help para ver todos los comandos disponibles
• Prueba /summary para generar un resumen rápido del chat
• Configura tus preferencias con /settings

¿Listo para comenzar? ¡Elige una opción abajo! 👇
    `,
    };
    return (messages[language] || messages.en).trim();
}
function getGroupWelcomeMessage(firstName, language) {
    const messages = {
        en: `
🤖 <b>Hello ${firstName}! AI Summary Bot is now active in this chat.</b>

I can help your group with:

🔹 <b>Automatic Summaries</b> - Periodic summaries of important discussions
🔹 <b>On-demand Summaries</b> - Use /summary anytime to catch up
🔹 <b>Group Analytics</b> - Track participation and activity patterns
🔹 <b>Message Insights</b> - Understand conversation trends and topics

<b>Getting Started:</b>
• Admins can configure settings with /settings
• Anyone can request a summary with /summary
• Use /help to see all available commands

<i>Note: I only process messages sent after I was added to the group.</i>

Let's make your group conversations more organized! 🚀
    `,
        es: `
🤖 <b>¡Hola ${firstName}! El Bot de Resumen IA está ahora activo en este chat.</b>

Puedo ayudar a tu grupo con:

🔹 <b>Resúmenes Automáticos</b> - Resúmenes periódicos de discusiones importantes
🔹 <b>Resúmenes bajo Demanda</b> - Usa /summary en cualquier momento para ponerte al día
🔹 <b>Análisis de Grupo</b> - Rastrea patrones de participación y actividad
🔹 <b>Perspectivas de Mensajes</b> - Entiende tendencias y temas de conversación

<b>Empezando:</b>
• Los administradores pueden configurar ajustes con /settings
• Cualquiera puede solicitar un resumen con /summary
• Usa /help para ver todos los comandos disponibles

<i>Nota: Solo proceso mensajes enviados después de que fui agregado al grupo.</i>

¡Hagamos que las conversaciones de tu grupo sean más organizadas! 🚀
    `,
    };
    return (messages[language] || messages.en).trim();
}
async function trackBotStart(ctx) {
    try {
        const eventData = {
            event: 'bot_started',
            userId: ctx.user?.id,
            chatId: ctx.chat?.id,
            chatType: ctx.chat?.type,
            userLanguage: ctx.user?.languageCode,
            timestamp: new Date().toISOString(),
        };
        console.log('Bot start event tracked:', eventData);
    }
    catch (error) {
        console.error('Error tracking bot start:', error);
    }
}
//# sourceMappingURL=start.js.map