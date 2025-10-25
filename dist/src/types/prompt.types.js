"use strict";
/**
 * TypeScript types and interfaces for the Dynamic Prompt Management System
 * Telegram Bot - Prompt Types
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateProcessingError = exports.PromptValidationError = exports.PromptNotFoundError = void 0;
// Error types for prompt management
class PromptNotFoundError extends Error {
    constructor(key) {
        super(`Prompt not found: ${key}`);
        this.name = 'PromptNotFoundError';
    }
}
exports.PromptNotFoundError = PromptNotFoundError;
class PromptValidationError extends Error {
    constructor(message) {
        super(`Prompt validation error: ${message}`);
        this.name = 'PromptValidationError';
    }
}
exports.PromptValidationError = PromptValidationError;
class TemplateProcessingError extends Error {
    constructor(message) {
        super(`Template processing error: ${message}`);
        this.name = 'TemplateProcessingError';
    }
}
exports.TemplateProcessingError = TemplateProcessingError;
