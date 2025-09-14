/**
 * TypeScript types and interfaces for the Dynamic Prompt Management System
 * Telegram Bot - Prompt Types
 */

// Enum types matching the database
export type PromptType = 
  | 'image_generation'
  | 'qa_system'
  | 'dobby_image'
  | 'dobby_qa'
  | 'error_message'
  | 'system_message';

export type PromptStatus = 'active' | 'inactive' | 'archived';

// Template variables interface
export interface TemplateVariables {
  [key: string]: any;
}

// Main Prompt interface matching database schema
export interface Prompt {
  id: string;
  key: string;
  name: string;
  type: PromptType;
  template: string;
  description?: string;
  maxTokens: number;
  temperature: number;
  variables: TemplateVariables;
  status: PromptStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

// Prompt creation interface (for inserting new prompts)
export interface CreatePromptRequest {
  key: string;
  name: string;
  type: PromptType;
  template: string;
  description?: string;
  maxTokens?: number;
  temperature?: number;
  variables?: TemplateVariables;
  status?: PromptStatus;
  createdBy?: string;
}

// Prompt update interface
export interface UpdatePromptRequest {
  name?: string;
  template?: string;
  description?: string;
  maxTokens?: number;
  temperature?: number;
  variables?: TemplateVariables;
  status?: PromptStatus;
}

// Prompt usage tracking
export interface PromptUsage {
  id: string;
  promptId: string;
  usedAt: Date;
  userId?: string;
  chatId?: string;
  responseTimeMs?: number;
  tokensUsed?: number;
  success: boolean;
  errorMessage?: string;
  inputVariables: TemplateVariables;
}

// Usage tracking creation interface
export interface CreatePromptUsageRequest {
  promptId: string;
  userId?: string;
  chatId?: string;
  responseTimeMs?: number;
  tokensUsed?: number;
  success: boolean;
  errorMessage?: string;
  inputVariables?: TemplateVariables;
}

// Processed prompt result
export interface ProcessedPrompt {
  prompt: Prompt;
  processedTemplate: string;
  variables: TemplateVariables;
}

// API response interfaces
export interface PromptAPIResponse {
  success: boolean;
  data?: Prompt | Prompt[];
  error?: string;
  message?: string;
}

export interface PromptUsageAPIResponse {
  success: boolean;
  data?: PromptUsage | PromptUsage[];
  error?: string;
  message?: string;
}

// Query interfaces for filtering prompts
export interface PromptQueryOptions {
  type?: PromptType;
  status?: PromptStatus;
  keys?: string[];
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'name' | 'key';
  orderDirection?: 'asc' | 'desc';
}

// Template processing options
export interface TemplateProcessingOptions {
  variables: TemplateVariables;
  escapeHtml?: boolean;
  allowUndefinedVariables?: boolean;
  defaultValue?: string;
}

// Error types for prompt management
export class PromptNotFoundError extends Error {
  constructor(key: string) {
    super(`Prompt not found: ${key}`);
    this.name = 'PromptNotFoundError';
  }
}

export class PromptValidationError extends Error {
  constructor(message: string) {
    super(`Prompt validation error: ${message}`);
    this.name = 'PromptValidationError';
  }
}

export class TemplateProcessingError extends Error {
  constructor(message: string) {
    super(`Template processing error: ${message}`);
    this.name = 'TemplateProcessingError';
  }
}

// Utility type for database column mapping
export interface PromptTableRow {
  id: string;
  key: string;
  name: string;
  type: PromptType;
  template: string;
  description: string | null;
  max_tokens: number;
  temperature: number;
  variables: any; // JSONB from database
  status: PromptStatus;
  version: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

// Usage table row
export interface PromptUsageTableRow {
  id: string;
  prompt_id: string;
  used_at: string;
  user_id: string | null;
  chat_id: string | null;
  response_time_ms: number | null;
  tokens_used: number | null;
  success: boolean;
  error_message: string | null;
  input_variables: any; // JSONB from database
}