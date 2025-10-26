"use strict";
/**
 * Image Edit Feature - Type Definitions
 * Version: 1.0.0
 * Description: TypeScript type definitions for AI-powered image editing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERROR_CODES = exports.DEFAULT_LANGUAGE = exports.DEFAULT_QUALITY = exports.DEFAULT_MAX_SUGGESTIONS = exports.SUGGESTION_EXPIRY_MINUTES = exports.MAX_IMAGES_PER_EDIT = exports.MAX_IMAGE_SIZE_MB = exports.APIService = exports.ImageQuality = exports.EditStatus = exports.PromptCategory = void 0;
// =============================================================================
// ENUMS
// =============================================================================
var PromptCategory;
(function (PromptCategory) {
    PromptCategory["PORTRAIT_STYLING"] = "portrait_styling";
    PromptCategory["THREE_D_FIGURINE"] = "3d_figurine";
    PromptCategory["GAME_ANIMATION"] = "game_animation";
    PromptCategory["IMAGE_EDITING"] = "image_editing";
    PromptCategory["CREATIVE_TRANSFORM"] = "creative_transform";
})(PromptCategory || (exports.PromptCategory = PromptCategory = {}));
var EditStatus;
(function (EditStatus) {
    EditStatus["PROCESSING"] = "processing";
    EditStatus["COMPLETED"] = "completed";
    EditStatus["FAILED"] = "failed";
    EditStatus["CANCELLED"] = "cancelled";
})(EditStatus || (exports.EditStatus = EditStatus = {}));
var ImageQuality;
(function (ImageQuality) {
    ImageQuality["FAST"] = "fast";
    ImageQuality["BALANCED"] = "balanced";
    ImageQuality["HIGH_QUALITY"] = "high_quality";
})(ImageQuality || (exports.ImageQuality = ImageQuality = {}));
var APIService;
(function (APIService) {
    APIService["NANO_BANAFO"] = "nano_banafo";
    APIService["GEMINI"] = "gemini";
    APIService["IMAGEN"] = "imagen";
})(APIService || (exports.APIService = APIService = {}));
// =============================================================================
// CONSTANTS
// =============================================================================
exports.MAX_IMAGE_SIZE_MB = 20;
exports.MAX_IMAGES_PER_EDIT = 5;
exports.SUGGESTION_EXPIRY_MINUTES = 60;
exports.DEFAULT_MAX_SUGGESTIONS = 5;
exports.DEFAULT_QUALITY = ImageQuality.BALANCED;
exports.DEFAULT_LANGUAGE = 'ko';
exports.ERROR_CODES = {
    IMAGE_TOO_LARGE: 'IMAGE_TOO_LARGE',
    NO_FACE_DETECTED: 'NO_FACE_DETECTED',
    TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
    API_ERROR: 'API_ERROR',
    TIMEOUT: 'TIMEOUT',
    INVALID_REQUEST: 'INVALID_REQUEST',
    QUOTA_EXCEEDED: 'QUOTA_EXCEEDED'
};
