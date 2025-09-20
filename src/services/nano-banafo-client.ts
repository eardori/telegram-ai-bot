/**
 * Nano Banafo API Client
 * Handles image editing requests to Nano Banafo service
 */

import {
  APIService,
  EditStatus,
  ERROR_CODES
} from '../types/image-edit.types';

interface NanoBanafoRequest {
  prompt: string;
  image?: string; // base64
  images?: string[]; // for multi-image
  negative_prompt?: string;
  num_inference_steps?: number;
  guidance_scale?: number;
  seed?: number;
  width?: number;
  height?: number;
}

interface NanoBanafoResponse {
  success: boolean;
  image?: string; // base64
  error?: string;
  processing_time?: number;
}

export class NanoBanafoClient {
  private apiKey: string;
  private apiUrl: string;
  private maxRetries: number = 3;
  private timeout: number = 30000; // 30 seconds

  constructor() {
    this.apiKey = process.env.NANO_BANAFO_API_KEY || '';
    this.apiUrl = process.env.NANO_BANAFO_API_URL || 'https://api.nanobanafo.com/v1';

    if (!this.apiKey) {
      console.warn('Nano Banafo API key not configured. Using mock mode.');
    }
  }

  /**
   * Edit a single image
   */
  async editImage(
    imageBuffer: Buffer,
    prompt: string,
    negativePrompt?: string
  ): Promise<Buffer> {
    try {
      // Convert buffer to base64
      const imageBase64 = imageBuffer.toString('base64');

      // Prepare request
      const request: NanoBanafoRequest = {
        prompt,
        image: imageBase64,
        negative_prompt: negativePrompt || this.getDefaultNegativePrompt(),
        num_inference_steps: 30,
        guidance_scale: 7.5,
        width: 1024,
        height: 1024
      };

      // Call API with retry logic
      const response = await this.callAPIWithRetry(request);

      if (!response.success || !response.image) {
        throw new Error(response.error || 'Failed to edit image');
      }

      // Convert result back to buffer
      return Buffer.from(response.image, 'base64');

    } catch (error) {
      console.error('Nano Banafo edit error:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Edit multiple images (merge/composite)
   */
  async editMultipleImages(
    imageBuffers: Buffer[],
    prompt: string,
    negativePrompt?: string
  ): Promise<Buffer> {
    try {
      // Convert buffers to base64
      const imagesBase64 = imageBuffers.map(buffer => buffer.toString('base64'));

      // Prepare request
      const request: NanoBanafoRequest = {
        prompt,
        images: imagesBase64,
        negative_prompt: negativePrompt || this.getDefaultNegativePrompt(),
        num_inference_steps: 40, // More steps for complex edits
        guidance_scale: 8.0
      };

      // Call API
      const response = await this.callAPIWithRetry(request);

      if (!response.success || !response.image) {
        throw new Error(response.error || 'Failed to merge images');
      }

      return Buffer.from(response.image, 'base64');

    } catch (error) {
      console.error('Nano Banafo multi-edit error:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Generate image from prompt only (no input image)
   */
  async generateImage(
    prompt: string,
    negativePrompt?: string,
    width: number = 1024,
    height: number = 1024
  ): Promise<Buffer> {
    try {
      const request: NanoBanafoRequest = {
        prompt,
        negative_prompt: negativePrompt || this.getDefaultNegativePrompt(),
        num_inference_steps: 30,
        guidance_scale: 7.5,
        width,
        height
      };

      const response = await this.callAPIWithRetry(request);

      if (!response.success || !response.image) {
        throw new Error(response.error || 'Failed to generate image');
      }

      return Buffer.from(response.image, 'base64');

    } catch (error) {
      console.error('Nano Banafo generate error:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Call API with retry logic
   */
  private async callAPIWithRetry(
    request: NanoBanafoRequest,
    attempt: number = 1
  ): Promise<NanoBanafoResponse> {
    try {
      // If no API key, use mock response
      if (!this.apiKey) {
        return this.getMockResponse(request);
      }

      // Make API call
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.apiUrl}/edit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as any;
        throw new Error(errorData.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      return data as NanoBanafoResponse;

    } catch (error: any) {
      // Check if we should retry
      if (attempt < this.maxRetries) {
        const shouldRetry =
          error.name === 'AbortError' || // Timeout
          error.message?.includes('500') || // Server error
          error.message?.includes('502') || // Bad gateway
          error.message?.includes('503'); // Service unavailable

        if (shouldRetry) {
          console.log(`Retrying Nano Banafo API (attempt ${attempt + 1}/${this.maxRetries})...`);

          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));

          return this.callAPIWithRetry(request, attempt + 1);
        }
      }

      throw error;
    }
  }

  /**
   * Get mock response for testing
   */
  private async getMockResponse(request: NanoBanafoRequest): Promise<NanoBanafoResponse> {
    console.log('🎨 Mock Nano Banafo API call:', {
      prompt: request.prompt.substring(0, 100),
      hasImage: !!request.image,
      hasMultipleImages: !!request.images
    });

    // Simulate processing delay
    return new Promise<NanoBanafoResponse>(resolve => {
      setTimeout(() => {
        // Return a mock edited image (1x1 transparent PNG)
        const mockImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

        resolve({
          success: true,
          image: mockImageBase64,
          processing_time: 3000
        });
      }, 3000);
    });
  }

  /**
   * Get default negative prompt
   */
  private getDefaultNegativePrompt(): string {
    return 'low quality, blurry, distorted, disfigured, bad anatomy, bad proportions, ' +
           'extra limbs, cloned face, malformed limbs, missing arms, missing legs, ' +
           'extra arms, extra legs, mutated hands, ugly, poorly drawn hands, ' +
           'poorly drawn face, mutation, deformed, bad composition, out of frame, ' +
           'duplicate, watermark, signature, text, logos';
  }

  /**
   * Handle and transform errors
   */
  private handleError(error: any): Error {
    if (error.name === 'AbortError') {
      return new Error(`${ERROR_CODES.TIMEOUT}: Request timeout after ${this.timeout}ms`);
    }

    if (error.message?.includes('API key')) {
      return new Error(`${ERROR_CODES.INVALID_REQUEST}: Invalid API key`);
    }

    if (error.message?.includes('quota') || error.message?.includes('limit')) {
      return new Error(`${ERROR_CODES.QUOTA_EXCEEDED}: API quota exceeded`);
    }

    return new Error(`${ERROR_CODES.API_ERROR}: ${error.message || 'Unknown error'}`);

  }

  /**
   * Check if API is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        return true; // Mock mode is always "healthy"
      }

      const response = await fetch(`${this.apiUrl}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Estimate cost for an edit
   */
  estimateCost(
    imageCount: number,
    isHighQuality: boolean = false
  ): number {
    const baseCost = 0.002; // $0.002 per image
    const qualityMultiplier = isHighQuality ? 1.5 : 1.0;
    const bulkDiscount = imageCount > 3 ? 0.9 : 1.0;

    return baseCost * imageCount * qualityMultiplier * bulkDiscount;
  }

  /**
   * Optimize image buffer before sending
   */
  private async optimizeImageBuffer(buffer: Buffer): Promise<Buffer> {
    // In production, use sharp or jimp to:
    // 1. Resize if too large
    // 2. Convert to JPEG if needed
    // 3. Compress if file size is too big

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB

    if (buffer.length > MAX_SIZE) {
      console.warn(`Image size (${buffer.length} bytes) exceeds limit. Should compress.`);
      // TODO: Implement compression
    }

    return buffer;
  }

  /**
   * Process image editing with specific style
   */
  async processWithStyle(
    imageBuffer: Buffer,
    style: string,
    customPrompt?: string
  ): Promise<Buffer> {
    const stylePrompts: Record<string, string> = {
      'portrait': 'professional portrait photography, studio lighting, sharp focus',
      'figurine': 'miniature figurine style, product photography, clean background',
      'vintage': 'vintage photography, film grain, nostalgic colors, retro style',
      'anime': 'anime style illustration, cel shading, vibrant colors',
      'cyberpunk': 'cyberpunk aesthetic, neon lights, futuristic, high tech',
      'fantasy': 'fantasy art style, magical atmosphere, ethereal lighting'
    };

    const basePrompt = stylePrompts[style] || style;
    const fullPrompt = customPrompt
      ? `${basePrompt}, ${customPrompt}`
      : basePrompt;

    return this.editImage(imageBuffer, fullPrompt);
  }

  /**
   * Batch process multiple edits
   */
  async batchProcess(
    imageBuffer: Buffer,
    prompts: string[]
  ): Promise<Buffer[]> {
    const results: Buffer[] = [];

    for (const prompt of prompts) {
      try {
        const result = await this.editImage(imageBuffer, prompt);
        results.push(result);
      } catch (error) {
        console.error(`Batch process error for prompt: ${prompt}`, error);
        // Continue with next prompt
      }
    }

    return results;
  }
}