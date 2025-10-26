"use strict";
/**
 * TypeScript Types and Interfaces for Chat Tracking System
 * Telegram Bot - Conversation Tracking and Summarization
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrackingErrorCode = exports.TrackingError = exports.MessageType = exports.SummaryStatus = exports.SummaryType = exports.TrackingSessionStatus = void 0;
// =============================================================================
// ENUMS AND CONSTANTS
// =============================================================================
var TrackingSessionStatus;
(function (TrackingSessionStatus) {
    TrackingSessionStatus["ACTIVE"] = "active";
    TrackingSessionStatus["STOPPED"] = "stopped";
    TrackingSessionStatus["SUMMARIZED"] = "summarized";
    TrackingSessionStatus["EXPIRED"] = "expired";
})(TrackingSessionStatus || (exports.TrackingSessionStatus = TrackingSessionStatus = {}));
var SummaryType;
(function (SummaryType) {
    SummaryType["MANUAL"] = "manual";
    SummaryType["AUTO"] = "auto";
    SummaryType["SCHEDULED"] = "scheduled";
})(SummaryType || (exports.SummaryType = SummaryType = {}));
var SummaryStatus;
(function (SummaryStatus) {
    SummaryStatus["GENERATING"] = "generating";
    SummaryStatus["COMPLETED"] = "completed";
    SummaryStatus["FAILED"] = "failed";
})(SummaryStatus || (exports.SummaryStatus = SummaryStatus = {}));
var MessageType;
(function (MessageType) {
    MessageType["TEXT"] = "text";
    MessageType["PHOTO"] = "photo";
    MessageType["VIDEO"] = "video";
    MessageType["DOCUMENT"] = "document";
    MessageType["AUDIO"] = "audio";
    MessageType["VOICE"] = "voice";
    MessageType["STICKER"] = "sticker";
    MessageType["ANIMATION"] = "animation";
    MessageType["LOCATION"] = "location";
    MessageType["CONTACT"] = "contact";
    MessageType["POLL"] = "poll";
})(MessageType || (exports.MessageType = MessageType = {}));
// =============================================================================
// ERROR TYPES
// =============================================================================
class TrackingError extends Error {
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'TrackingError';
    }
}
exports.TrackingError = TrackingError;
var TrackingErrorCode;
(function (TrackingErrorCode) {
    // Session errors
    TrackingErrorCode["SESSION_NOT_FOUND"] = "SESSION_NOT_FOUND";
    TrackingErrorCode["SESSION_ALREADY_ACTIVE"] = "SESSION_ALREADY_ACTIVE";
    TrackingErrorCode["SESSION_EXPIRED"] = "SESSION_EXPIRED";
    TrackingErrorCode["SESSION_LIMIT_EXCEEDED"] = "SESSION_LIMIT_EXCEEDED";
    // Message errors
    TrackingErrorCode["MESSAGE_TOO_SHORT"] = "MESSAGE_TOO_SHORT";
    TrackingErrorCode["MESSAGE_ALREADY_TRACKED"] = "MESSAGE_ALREADY_TRACKED";
    TrackingErrorCode["MESSAGE_LIMIT_EXCEEDED"] = "MESSAGE_LIMIT_EXCEEDED";
    // Summary errors
    TrackingErrorCode["NO_MESSAGES_TO_SUMMARIZE"] = "NO_MESSAGES_TO_SUMMARIZE";
    TrackingErrorCode["SUMMARY_GENERATION_FAILED"] = "SUMMARY_GENERATION_FAILED";
    TrackingErrorCode["SUMMARY_LIMIT_EXCEEDED"] = "SUMMARY_LIMIT_EXCEEDED";
    // Database errors
    TrackingErrorCode["DATABASE_ERROR"] = "DATABASE_ERROR";
    TrackingErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    // API errors
    TrackingErrorCode["CLAUDE_API_ERROR"] = "CLAUDE_API_ERROR";
    TrackingErrorCode["RATE_LIMIT_ERROR"] = "RATE_LIMIT_ERROR";
})(TrackingErrorCode || (exports.TrackingErrorCode = TrackingErrorCode = {}));
// =============================================================================
// TYPES EXPORTED ABOVE (no re-export needed as they use export interface/type)
// =============================================================================
