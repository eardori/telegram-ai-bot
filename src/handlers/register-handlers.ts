/**
 * Register all bot handlers
 * Central place to register all command and message handlers
 */

import { Bot } from 'grammy';
import { registerImageEditHandlers } from './image-edit-handler';

/**
 * Register all handlers to the bot
 */
export function registerAllHandlers(bot: Bot) {
  // Register image editing handlers
  registerImageEditHandlers(bot);

  // Add more handler registrations here as needed
  // registerChatHandlers(bot);
  // registerAdminHandlers(bot);
  // etc.
}

/**
 * Helper function to check if a handler is already registered
 */
export function isHandlerRegistered(bot: Bot, command: string): boolean {
  // Check if command is already registered
  // This is a simplified check - in production use proper handler tracking
  return false;
}