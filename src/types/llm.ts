// LLM API Types and Interfaces

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'azure' | 'huggingface' | 'ollama' | 'cohere';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

export interface LLMRequest {
  messages: LLMMessage[];
  model?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  functions?: LLMFunction[];
  function_call?: 'auto' | 'none' | { name: string };
  stream?: boolean;
  user?: string;
}

export interface LLMResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: LLMChoice[];
  usage: LLMUsage;
  system_fingerprint?: string;
}

export interface LLMChoice {
  index: number;
  message: LLMMessage;
  finish_reason: 'stop' | 'length' | 'function_call' | 'content_filter' | null;
}

export interface LLMUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface LLMFunction {
  name: string;
  description?: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface LLMStreamResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: LLMStreamChoice[];
}

export interface LLMStreamChoice {
  index: number;
  delta: {
    role?: string;
    content?: string;
    function_call?: {
      name?: string;
      arguments?: string;
    };
  };
  finish_reason?: string | null;
}

// Summary Generation Types
export type SummaryType = 'manual' | 'daily' | 'weekly' | 'topic-based' | 'user-requested';
export type MessageType = 'text' | 'photo' | 'video' | 'audio' | 'document' | 'voice' | 'sticker' | 'animation' | 'location' | 'contact' | 'poll' | 'venue' | 'dice' | 'game' | 'other';

export interface MediaInfo {
  type: MessageType;
  file_id?: string;
  file_unique_id?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  caption?: string;
  sizes?: Array<{
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    file_size?: number;
  }>;
}
export interface SummaryRequest {
  messages: ChatMessage[];
  summaryType: SummaryType;
  preferences: SummaryPreferences;
  context?: SummaryContext;
}

export interface ChatMessage {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
    username?: string;
  };
  timestamp: string;
  messageType: MessageType;
  mediaInfo?: MediaInfo;
  replyTo?: string;
}

export interface SummaryPreferences {
  format: 'brief' | 'detailed' | 'bullet_points';
  language: string;
  includeMedia: boolean;
  includeParticipants: boolean;
  includeTimestamps: boolean;
  maxLength?: number;
  focusAreas?: string[];
  excludeTopics?: string[];
}

export interface SummaryContext {
  chatType: 'private' | 'group' | 'supergroup' | 'channel';
  chatTitle?: string;
  participantCount: number;
  timeRange: {
    start: string;
    end: string;
  };
  previousSummary?: string;
  relevantEvents?: string[];
}

export interface SummaryResponse {
  summary: string;
  metadata: {
    messageCount: number;
    participantCount: number;
    keyParticipants: string[];
    mainTopics: string[];
    sentiment: 'positive' | 'neutral' | 'negative';
    confidence: number;
    processingTimeMs: number;
    tokenUsage: LLMUsage;
  };
  categories?: string[];
  highlights?: string[];
  actionItems?: string[];
  questions?: string[];
}

// Content Analysis Types
export interface ContentAnalysisRequest {
  content: string;
  analysisType: ContentAnalysisType[];
  language?: string;
}

export type ContentAnalysisType = 
  | 'sentiment' 
  | 'topics' 
  | 'entities' 
  | 'language' 
  | 'toxicity' 
  | 'spam' 
  | 'categories'
  | 'keywords'
  | 'summary';

export interface ContentAnalysisResponse {
  sentiment?: {
    score: number;
    label: 'positive' | 'neutral' | 'negative';
    confidence: number;
  };
  topics?: {
    topic: string;
    confidence: number;
  }[];
  entities?: {
    text: string;
    type: string;
    confidence: number;
  }[];
  language?: {
    code: string;
    name: string;
    confidence: number;
  };
  toxicity?: {
    isToxic: boolean;
    score: number;
    categories: string[];
  };
  spam?: {
    isSpam: boolean;
    score: number;
    reasons: string[];
  };
  categories?: {
    category: string;
    score: number;
  }[];
  keywords?: {
    keyword: string;
    relevance: number;
  }[];
  summary?: string;
}

// Translation Types
export interface TranslationRequest {
  text: string;
  sourceLanguage?: string;
  targetLanguage: string;
  context?: string;
}

export interface TranslationResponse {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
  alternatives?: string[];
}

// Question Answering Types
export interface QARequest {
  question: string;
  context: string;
  language?: string;
}

export interface QAResponse {
  answer: string;
  confidence: number;
  sources?: string[];
  followUpQuestions?: string[];
}

// Error Types
export interface LLMError {
  code: string;
  message: string;
  type: 'api_error' | 'rate_limit' | 'invalid_request' | 'authentication' | 'permission' | 'not_found' | 'server_error';
  details?: any;
}

// Provider-specific configurations
export interface OpenAIConfig extends LLMConfig {
  provider: 'openai';
  organizationId?: string;
}

export interface AnthropicConfig extends LLMConfig {
  provider: 'anthropic';
  version?: string;
}

export interface GoogleConfig extends LLMConfig {
  provider: 'google';
  projectId?: string;
  location?: string;
}

export interface AzureConfig extends LLMConfig {
  provider: 'azure';
  deploymentName?: string;
  apiVersion?: string;
}

export interface HuggingFaceConfig extends LLMConfig {
  provider: 'huggingface';
  useInference?: boolean;
}

export interface OllamaConfig extends LLMConfig {
  provider: 'ollama';
  host?: string;
  port?: number;
}

export interface CohereConfig extends LLMConfig {
  provider: 'cohere';
  version?: string;
}

// Utility types
export type ProviderConfig = 
  | OpenAIConfig 
  | AnthropicConfig 
  | GoogleConfig 
  | AzureConfig 
  | HuggingFaceConfig 
  | OllamaConfig 
  | CohereConfig;

export interface LLMClient {
  generateResponse(request: LLMRequest): Promise<LLMResponse>;
  generateStream(request: LLMRequest): AsyncGenerator<LLMStreamResponse, void, unknown>;
  generateSummary(request: SummaryRequest): Promise<SummaryResponse>;
  analyzeContent(request: ContentAnalysisRequest): Promise<ContentAnalysisResponse>;
  translate(request: TranslationRequest): Promise<TranslationResponse>;
  answerQuestion(request: QARequest): Promise<QAResponse>;
  getModels(): Promise<string[]>;
  validateConfig(): Promise<boolean>;
}