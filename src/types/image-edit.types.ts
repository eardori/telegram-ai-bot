/**
 * Image Edit Feature - Type Definitions
 * Version: 1.0.0
 * Description: TypeScript type definitions for AI-powered image editing
 */

// =============================================================================
// ENUMS
// =============================================================================

export enum PromptCategory {
  PORTRAIT_STYLING = 'portrait_styling',
  THREE_D_FIGURINE = '3d_figurine',
  GAME_ANIMATION = 'game_animation',
  IMAGE_EDITING = 'image_editing',
  CREATIVE_TRANSFORM = 'creative_transform'
}

export enum EditStatus {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum ImageQuality {
  FAST = 'fast',
  BALANCED = 'balanced',
  HIGH_QUALITY = 'high_quality'
}

export enum APIService {
  NANO_BANAFO = 'nano_banafo',
  GEMINI = 'gemini',
  IMAGEN = 'imagen'
}

// =============================================================================
// PROMPT TEMPLATE TYPES
// =============================================================================

export interface PromptVariable {
  key: string;
  type: 'required' | 'optional';
  defaultValue?: string;
  options?: string[];
  userInput?: boolean;
  description?: string;
}

export interface TemplateRequirements {
  minImages: number;
  maxImages: number;
  requiresFace: boolean;
  minFaces?: number;
  maxFaces?: number;
  imageTypes?: string[];
  optimalConditions?: Record<string, any>;
}

export interface PromptTemplate {
  id: number;
  templateKey: string;
  templateNameKo: string;
  templateNameEn: string;
  category: PromptCategory;
  subcategory?: string;
  basePrompt: string;
  examplePrompt?: string;
  promptVariables: PromptVariable[];
  requirements: TemplateRequirements;
  priority: number;
  usageCount: number;
  successCount: number;
  successRate?: number;
  averageProcessingTimeMs?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// IMAGE ANALYSIS TYPES
// =============================================================================

export interface FaceAnalysis {
  count: number;
  clarity: 'high' | 'medium' | 'low';
  positions: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  }>;
  expressions?: string[];
  ages?: number[];
  genders?: string[];
}

export interface DetectedObject {
  name: string;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface SceneDescription {
  type: string; // indoor, outdoor, studio, etc.
  description: string;
  lighting: string;
  mood: string;
  timeOfDay?: string;
}

export interface CompositionAnalysis {
  type: string; // portrait, landscape, close-up, etc.
  ruleOfThirds: boolean;
  leadingLines: boolean;
  symmetry: boolean;
  depth: 'shallow' | 'medium' | 'deep';
}

export interface QualityMetrics {
  resolution: {
    width: number;
    height: number;
  };
  sharpness: number; // 0-1
  exposure: number; // -1 to 1
  contrast: number; // 0-1
  saturation: number; // 0-1
  noise: number; // 0-1
  overallScore: number; // 0-1
}

export interface ImageAnalysis {
  id: string;
  sessionId: string;
  userId: number;
  chatId: number;
  messageId?: number;

  // Image data
  imageCount: number;
  imageUrls: string[];
  imageSizes: number[];
  totalSizeBytes: number;

  // Analysis results
  faces: FaceAnalysis;
  detectedObjects: DetectedObject[];
  scene: SceneDescription;
  composition: CompositionAnalysis;
  quality: QualityMetrics;
  dominantColors: string[];

  // Categorization
  suggestedCategories: string[];
  confidenceScores: Record<string, number>;

  // Metadata
  analysisTimeMs: number;
  apiCallsMade: number;
  createdAt: Date;
}

// =============================================================================
// SUGGESTION TYPES
// =============================================================================

export interface EditSuggestion {
  templateId: number;
  templateKey: string;
  displayName: string;
  description: string;
  confidence: number;
  priority: number;
  requiredImages: number;
  exampleImage?: string;
  estimatedTime?: number;
  estimatedCost?: number;
}

export interface SuggestionSet {
  id: string;
  analysisId: string;
  userId: number;
  chatId: number;
  suggestions: EditSuggestion[];
  selectedTemplateId?: number;
  selectedAt?: Date;
  customModifications?: string;
  userSatisfaction?: number;
  feedbackText?: string;
  createdAt: Date;
  expiresAt: Date;
}

// =============================================================================
// EDIT HISTORY TYPES
// =============================================================================

export interface EditResult {
  id: string;
  userId: number;
  chatId: number;
  templateId: number;
  templateKey: string;

  // Edit details
  finalPrompt: string;
  promptLanguage: string;
  customParameters?: Record<string, any>;

  // Images
  originalImageUrls: string[];
  editedImageUrl: string;
  editedImageSizeBytes: number;

  // Processing
  processingStartAt: Date;
  processingEndAt: Date;
  processingTimeMs: number;
  apiServiceUsed: APIService;

  // Cost and usage
  estimatedCost?: number;
  tokensUsed?: number;

  // User feedback
  userRating?: number;
  userComment?: string;
  isFavorite: boolean;

  // Status
  status: EditStatus;
  errorMessage?: string;
  retryCount: number;

  createdAt: Date;
}

// =============================================================================
// USER PREFERENCE TYPES
// =============================================================================

export interface UserEditPreferences {
  userId: number;

  // Style preferences
  preferredStyles: string[];
  preferredCategories: string[];
  avoidedStyles: string[];

  // Language
  interfaceLanguage: string;
  promptLanguage: string;

  // Quality
  preferredQuality: ImageQuality;
  autoEnhance: boolean;

  // History
  totalEdits: number;
  favoriteTemplateIds: number[];
  lastUsedTemplateId?: number;
  averageRating?: number;

  // Settings
  showCostEstimates: boolean;
  saveHistory: boolean;
  enableSuggestions: boolean;
  maxSuggestions: number;

  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// BATCH EDIT TYPES
// =============================================================================

export interface BatchEditJob {
  id: string;
  userId: number;
  chatId: number;

  // Job details
  totalEdits: number;
  completedEdits: number;
  failedEdits: number;

  // Templates
  templateIds: number[];

  // Status
  status: EditStatus;

  // Results
  resultUrls: string[];

  // Timing
  startedAt?: Date;
  completedAt?: Date;
  estimatedCompletionAt?: Date;

  createdAt: Date;
}

// =============================================================================
// REQUEST/RESPONSE TYPES
// =============================================================================

export interface ImageEditRequest {
  userId: number;
  chatId: number;
  messageId?: number;
  imageBuffers: Buffer[];
  templateKey?: string;
  customPrompt?: string;
  userPreferences?: Partial<UserEditPreferences>;
  quality?: ImageQuality;
}

export interface ImageEditResponse {
  success: boolean;
  editResult?: EditResult;
  suggestions?: EditSuggestion[];
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface AnalysisRequest {
  userId: number;
  chatId: number;
  imageBuffers: Buffer[];
  includesSuggestions?: boolean;
  maxSuggestions?: number;
}

export interface AnalysisResponse {
  success: boolean;
  analysis?: ImageAnalysis;
  suggestions?: EditSuggestion[];
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// =============================================================================
// SERVICE INTERFACES
// =============================================================================

export interface IImageAnalyzer {
  analyze(imageBuffer: Buffer): Promise<ImageAnalysis>;
  analyzeMultiple(imageBuffers: Buffer[]): Promise<ImageAnalysis>;
}

export interface ITemplateMatcher {
  matchTemplates(analysis: ImageAnalysis): Promise<PromptTemplate[]>;
  calculateScore(template: PromptTemplate, analysis: ImageAnalysis): number;
}

export interface ISuggestionEngine {
  generateSuggestions(
    analysis: ImageAnalysis,
    userHistory?: EditResult[],
    maxSuggestions?: number
  ): Promise<EditSuggestion[]>;
}

export interface IPromptBuilder {
  build(
    template: PromptTemplate,
    variables?: Record<string, string>,
    userInput?: string
  ): string;

  optimize(prompt: string, targetAPI: APIService): string;
}

export interface IImageEditor {
  edit(
    imageBuffer: Buffer,
    prompt: string,
    service?: APIService
  ): Promise<Buffer>;

  editMultiple(
    imageBuffers: Buffer[],
    prompt: string,
    service?: APIService
  ): Promise<Buffer>;
}

// =============================================================================
// TELEGRAM BOT TYPES
// =============================================================================

export interface PhotoMessage {
  fileId: string;
  fileSize: number;
  width: number;
  height: number;
  caption?: string;
}

export interface EditSession {
  sessionId: string;
  userId: number;
  chatId: number;
  state: 'awaiting_images' | 'analyzing' | 'showing_suggestions' | 'processing' | 'completed';
  images: PhotoMessage[];
  analysis?: ImageAnalysis;
  suggestions?: EditSuggestion[];
  selectedTemplate?: PromptTemplate;
  startedAt: Date;
  lastActivityAt: Date;
}

export interface InlineKeyboardButton {
  text: string;
  callbackData: string;
  emoji?: string;
}

export interface EditCallbackData {
  action: 'select_template' | 'custom_edit' | 'cancel' | 'retry' | 'save_favorite';
  templateKey?: string;
  sessionId?: string;
  data?: any;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type PartialTemplate = Partial<PromptTemplate> & {
  templateKey: string;
};

export type ImageBuffer = {
  data: Buffer;
  mimeType: string;
  size: number;
};

export type ProcessingCallback = (progress: number, message?: string) => void;

export type ErrorCallback = (error: Error) => void;

// =============================================================================
// CONSTANTS
// =============================================================================

export const MAX_IMAGE_SIZE_MB = 20;
export const MAX_IMAGES_PER_EDIT = 5;
export const SUGGESTION_EXPIRY_MINUTES = 60;
export const DEFAULT_MAX_SUGGESTIONS = 5;
export const DEFAULT_QUALITY = ImageQuality.BALANCED;
export const DEFAULT_LANGUAGE = 'ko';

export const ERROR_CODES = {
  IMAGE_TOO_LARGE: 'IMAGE_TOO_LARGE',
  NO_FACE_DETECTED: 'NO_FACE_DETECTED',
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
  API_ERROR: 'API_ERROR',
  TIMEOUT: 'TIMEOUT',
  INVALID_REQUEST: 'INVALID_REQUEST',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED'
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];