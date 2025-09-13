// Jest Test Setup
// This file runs before all tests to configure the testing environment

import { config } from 'dotenv';
import { TextEncoder, TextDecoder } from 'util';

// Load test environment variables
config({ path: '.env.test' });

// Global test timeout
jest.setTimeout(30000);

// Add Node.js globals for compatibility
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests

// Default test environment variables (override with .env.test)
if (!process.env.TELEGRAM_BOT_TOKEN) {
  process.env.TELEGRAM_BOT_TOKEN = '123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh';
}

if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = 'https://test-project.supabase.co';
}

if (!process.env.SUPABASE_ANON_KEY) {
  process.env.SUPABASE_ANON_KEY = 'eyJ0ZXN0IjoidGVzdCJ9.test.test';
}

if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = 'sk-test-1234567890abcdef';
}

// Mock console methods for cleaner test output
const originalConsole = { ...console };
global.console = {
  ...originalConsole,
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Restore console for specific tests if needed
global.restoreConsole = () => {
  global.console = originalConsole;
};

// Global test utilities
global.mockTelegramUpdate = (overrides: any = {}) => ({
  update_id: 123456,
  message: {
    message_id: 1,
    from: {
      id: 12345,
      is_bot: false,
      first_name: 'Test',
      username: 'testuser',
      language_code: 'en',
    },
    chat: {
      id: -1001234567890,
      title: 'Test Group',
      type: 'group',
    },
    date: Math.floor(Date.now() / 1000),
    text: '/start',
    entities: [
      {
        offset: 0,
        length: 6,
        type: 'bot_command',
      },
    ],
  },
  ...overrides,
});

global.mockNetlifyEvent = (overrides: any = {}) => ({
  httpMethod: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-telegram-bot-api-secret-token': 'test-secret',
  },
  path: '/.netlify/functions/webhook',
  queryStringParameters: null,
  body: JSON.stringify(global.mockTelegramUpdate()),
  isBase64Encoded: false,
  ...overrides,
});

global.mockNetlifyContext = (overrides: any = {}) => ({
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'webhook',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:webhook',
  memoryLimitInMB: '1024',
  awsRequestId: 'test-request-id-' + Date.now(),
  logGroupName: '/aws/lambda/webhook',
  logStreamName: '2024/01/01/[$LATEST]test',
  getRemainingTimeInMillis: () => 5000,
  done: jest.fn(),
  fail: jest.fn(),
  succeed: jest.fn(),
  ...overrides,
});

// Database test utilities
global.createMockSupabaseClient = () => ({
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gt: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  then: jest.fn().mockResolvedValue({ data: [], error: null }),
});

// LLM test utilities
global.createMockLLMResponse = (overrides: any = {}) => ({
  content: 'This is a test response from the AI.',
  model: 'gpt-3.5-turbo',
  usage: {
    promptTokens: 10,
    completionTokens: 15,
    totalTokens: 25,
  },
  finishReason: 'stop',
  ...overrides,
});

global.createMockSummaryResponse = (overrides: any = {}) => ({
  summary: 'Test summary of the conversation.',
  keyTopics: ['testing', 'ai', 'chatbot'],
  participantCount: 3,
  timeRange: {
    start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString(),
  },
  model: 'gpt-3.5-turbo',
  usage: {
    promptTokens: 50,
    completionTokens: 30,
    totalTokens: 80,
  },
  ...overrides,
});

// Test data generators
global.generateTestMessages = (count: number = 5) => {
  const messages = [];
  const users = ['Alice', 'Bob', 'Charlie', 'Diana'];
  const baseTime = Date.now() - 60 * 60 * 1000; // 1 hour ago
  
  for (let i = 0; i < count; i++) {
    messages.push({
      id: i + 1,
      chat_id: -1001234567890,
      message_id: i + 1,
      user_id: 12345 + i,
      username: users[i % users.length].toLowerCase(),
      first_name: users[i % users.length],
      content: `Test message ${i + 1} from ${users[i % users.length]}`,
      message_type: 'text',
      timestamp: new Date(baseTime + i * 60 * 1000).toISOString(),
      metadata: {},
    });
  }
  
  return messages;
};

global.generateTestChat = (overrides: any = {}) => ({
  id: -1001234567890,
  title: 'Test Group Chat',
  type: 'group',
  settings: {
    summary_interval: 6,
    max_summary_length: 2000,
    llm_provider: 'openai',
    features: {
      auto_summary: true,
      image_generation: true,
    },
  },
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

// Cleanup function to reset mocks between tests
global.resetAllMocks = () => {
  jest.clearAllMocks();
  jest.resetAllMocks();
  jest.restoreAllMocks();
};

// Setup global error handling for tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock setTimeout and setInterval for deterministic testing
jest.useFakeTimers();

export {};

// Type declarations for global test utilities
declare global {
  var mockTelegramUpdate: (overrides?: any) => any;
  var mockNetlifyEvent: (overrides?: any) => any;
  var mockNetlifyContext: (overrides?: any) => any;
  var createMockSupabaseClient: () => any;
  var createMockLLMResponse: (overrides?: any) => any;
  var createMockSummaryResponse: (overrides?: any) => any;
  var generateTestMessages: (count?: number) => any[];
  var generateTestChat: (overrides?: any) => any;
  var resetAllMocks: () => void;
  var restoreConsole: () => void;
}