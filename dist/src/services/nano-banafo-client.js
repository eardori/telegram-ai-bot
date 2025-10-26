"use strict";
/**
 * Gemini Image Edit Client (formerly Nano Banafo)
 * Handles image editing requests using Google Gemini API
 *
 * IMPORTANT: Google Gemini CAN edit and generate images!
 * Model: gemini-2.5-flash-image-preview (ONLY this model supports image generation)
 * Docs: https://ai.google.dev/gemini-api/docs/image-generation
 * Uses GOOGLE_API_KEY environment variable
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NanoBanafoClient = void 0;
const image_edit_types_1 = require("../types/image-edit.types");
class NanoBanafoClient {
    constructor() {
        // IMPORTANT: Use image generation capable model
        // gemini-2.5-flash-image-preview is the ONLY model that supports image generation
        // Docs: https://ai.google.dev/gemini-api/docs/image-generation
        this.model = 'gemini-2.5-flash-image-preview';
        this.maxRetries = 3;
        this.timeout = 30000; // 30 seconds
        this.apiKey = process.env.GOOGLE_API_KEY || '';
        if (!this.apiKey) {
            console.warn('Google API key not configured. Using mock mode.');
        }
    }
    /**
     * Edit a single image
     */
    async editImage(imageBuffer, prompt, negativePrompt) {
        try {
            // Convert buffer to base64
            const imageBase64 = imageBuffer.toString('base64');
            // Prepare request
            const request = {
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
        }
        catch (error) {
            console.error('Nano Banafo edit error:', error);
            throw this.handleError(error);
        }
    }
    /**
     * Edit multiple images (merge/composite)
     */
    async editMultipleImages(imageBuffers, prompt, negativePrompt) {
        try {
            // Convert buffers to base64
            const imagesBase64 = imageBuffers.map(buffer => buffer.toString('base64'));
            // Prepare request
            const request = {
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
        }
        catch (error) {
            console.error('Nano Banafo multi-edit error:', error);
            throw this.handleError(error);
        }
    }
    /**
     * Generate image from prompt only (no input image)
     */
    async generateImage(prompt, negativePrompt, width = 1024, height = 1024) {
        try {
            const request = {
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
        }
        catch (error) {
            console.error('Nano Banafo generate error:', error);
            throw this.handleError(error);
        }
    }
    /**
     * Call API with retry logic
     */
    async callAPIWithRetry(request, attempt = 1) {
        const startTime = Date.now();
        try {
            // If no API key, use mock response
            if (!this.apiKey) {
                return this.getMockResponse(request);
            }
            // Make Gemini API call
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
            // Build edit prompt that explicitly requests image generation
            const editPrompt = request.image
                ? `Generate an edited version of this image with the following changes: ${request.prompt}\nReturn the edited image, not a text description.`
                : `Generate an image based on this description: ${request.prompt}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                            parts: [
                                { text: editPrompt },
                                request.image ? {
                                    inline_data: {
                                        mime_type: 'image/jpeg',
                                        data: request.image
                                    }
                                } : null
                            ].filter(Boolean)
                        }],
                    generationConfig: {
                        temperature: 0.4, // Lower temperature for more consistent edits
                        maxOutputTokens: 8192
                    }
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `API error: ${response.status}`);
            }
            const data = await response.json();
            // Extract image from Gemini response
            // Gemini returns image in inline_data or inlineData field
            const parts = data.candidates?.[0]?.content?.parts || [];
            const imagePart = parts.find((part) => part.inline_data || part.inlineData);
            const generatedImage = imagePart?.inline_data?.data || imagePart?.inlineData?.data;
            if (!generatedImage) {
                throw new Error('No image generated');
            }
            return {
                success: true,
                image: generatedImage,
                processing_time: Date.now() - startTime
            };
        }
        catch (error) {
            // Check if we should retry
            if (attempt < this.maxRetries) {
                const shouldRetry = error.name === 'AbortError' || // Timeout
                    error.message?.includes('500') || // Server error
                    error.message?.includes('502') || // Bad gateway
                    error.message?.includes('503'); // Service unavailable
                if (shouldRetry) {
                    console.log(`Retrying Gemini API (attempt ${attempt + 1}/${this.maxRetries})...`);
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
    async getMockResponse(request) {
        console.log('🎨 Mock Gemini Image Edit API call:', {
            prompt: request.prompt.substring(0, 100),
            hasImage: !!request.image,
            hasMultipleImages: !!request.images
        });
        // Simulate processing delay
        return new Promise(resolve => {
            setTimeout(() => {
                // Return a better mock image for testing (red square)
                // This is a 100x100 red square PNG in base64
                const mockImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC';
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
    getDefaultNegativePrompt() {
        return 'low quality, blurry, distorted, disfigured, bad anatomy, bad proportions, ' +
            'extra limbs, cloned face, malformed limbs, missing arms, missing legs, ' +
            'extra arms, extra legs, mutated hands, ugly, poorly drawn hands, ' +
            'poorly drawn face, mutation, deformed, bad composition, out of frame, ' +
            'duplicate, watermark, signature, text, logos';
    }
    /**
     * Handle and transform errors
     */
    handleError(error) {
        if (error.name === 'AbortError') {
            return new Error(`${image_edit_types_1.ERROR_CODES.TIMEOUT}: Request timeout after ${this.timeout}ms`);
        }
        if (error.message?.includes('API key')) {
            return new Error(`${image_edit_types_1.ERROR_CODES.INVALID_REQUEST}: Invalid API key`);
        }
        if (error.message?.includes('quota') || error.message?.includes('limit')) {
            return new Error(`${image_edit_types_1.ERROR_CODES.QUOTA_EXCEEDED}: API quota exceeded`);
        }
        return new Error(`${image_edit_types_1.ERROR_CODES.API_ERROR}: ${error.message || 'Unknown error'}`);
    }
    /**
     * Check if API is available
     */
    async checkHealth() {
        try {
            if (!this.apiKey) {
                return true; // Mock mode is always "healthy"
            }
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`);
            return response.ok;
        }
        catch {
            return false;
        }
    }
    /**
     * Estimate cost for an edit
     */
    estimateCost(imageCount, isHighQuality = false) {
        const baseCost = 0.002; // $0.002 per image
        const qualityMultiplier = isHighQuality ? 1.5 : 1.0;
        const bulkDiscount = imageCount > 3 ? 0.9 : 1.0;
        return baseCost * imageCount * qualityMultiplier * bulkDiscount;
    }
    /**
     * Optimize image buffer before sending
     */
    async optimizeImageBuffer(buffer) {
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
    async processWithStyle(imageBuffer, style, customPrompt) {
        const stylePrompts = {
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
    async batchProcess(imageBuffer, prompts) {
        const results = [];
        for (const prompt of prompts) {
            try {
                const result = await this.editImage(imageBuffer, prompt);
                results.push(result);
            }
            catch (error) {
                console.error(`Batch process error for prompt: ${prompt}`, error);
                // Continue with next prompt
            }
        }
        return results;
    }
}
exports.NanoBanafoClient = NanoBanafoClient;
