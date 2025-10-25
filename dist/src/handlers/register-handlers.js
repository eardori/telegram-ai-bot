"use strict";
/**
 * Register all bot handlers
 * Central place to register all command and message handlers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAllHandlers = registerAllHandlers;
exports.isHandlerRegistered = isHandlerRegistered;
const image_edit_handler_1 = require("./image-edit-handler");
/**
 * Register all handlers to the bot
 */
function registerAllHandlers(bot) {
    // Register image editing handlers
    (0, image_edit_handler_1.registerImageEditHandlers)(bot);
    // Add more handler registrations here as needed
    // registerChatHandlers(bot);
    // registerAdminHandlers(bot);
    // etc.
}
/**
 * Helper function to check if a handler is already registered
 */
function isHandlerRegistered(bot, command) {
    // Check if command is already registered
    // This is a simplified check - in production use proper handler tracking
    return false;
}
