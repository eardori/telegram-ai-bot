"use strict";
/**
 * Replicate API Service
 *
 * Provides NSFW image and video generation capabilities using Replicate API.
 * Used for content that cannot be generated with standard Gemini/Imagen APIs.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.replicateService = void 0;
const replicate_1 = __importDefault(require("replicate"));
class ReplicateService {
    constructor() {
        const apiToken = process.env.REPLICATE_API_TOKEN;
        const proxyUrl = process.env.REPLICATE_PROXY_URL;
        const proxyAuth = process.env.REPLICATE_PROXY_AUTH;
        if (!apiToken) {
            console.warn('⚠️ REPLICATE_API_TOKEN not configured. NSFW features will be disabled.');
            this.isEnabled = false;
            // Create dummy client to avoid crashes
            this.client = null;
        }
        else {
            const useProxy = !!(proxyUrl && proxyAuth);
            this.client = new replicate_1.default({
                auth: apiToken,
                userAgent: 'MultifulBot/1.0 (https://t.me/MultifulDobi_bot)',
                // Custom fetch with Cloudflare Workers proxy support
                fetch: (input, init) => {
                    // Extract URL from input
                    let originalUrl;
                    if (typeof input === 'string') {
                        originalUrl = input;
                    }
                    else if (input instanceof Request) {
                        originalUrl = input.url;
                    }
                    else if (typeof input === 'object' && 'url' in input) {
                        originalUrl = input.url;
                    }
                    else {
                        // Fallback: try to convert to string
                        originalUrl = String(input);
                    }
                    const headers = new Headers(init?.headers);
                    // Set User-Agent
                    if (!headers.has('User-Agent')) {
                        headers.set('User-Agent', 'MultifulBot/1.0 (https://t.me/MultifulDobi_bot)');
                    }
                    headers.set('Accept', 'application/json');
                    if (useProxy && originalUrl) {
                        // Route through Cloudflare Workers proxy
                        headers.set('X-Proxy-Auth', proxyAuth);
                        const proxyTargetUrl = `${proxyUrl}?target=${encodeURIComponent(originalUrl)}`;
                        console.log(`🔄 Proxying request: ${originalUrl.substring(0, 60)}...`);
                        return fetch(proxyTargetUrl, {
                            ...init,
                            headers,
                        });
                    }
                    else {
                        // Direct connection (fallback)
                        headers.set('X-Requested-With', 'XMLHttpRequest');
                        return fetch(input, {
                            ...init,
                            headers,
                        });
                    }
                },
            });
            this.isEnabled = true;
            if (useProxy) {
                console.log('✅ Replicate service initialized with Cloudflare Workers proxy');
            }
            else {
                console.log('✅ Replicate service initialized with direct connection');
            }
        }
    }
    /**
     * Check if Replicate service is available
     */
    isAvailable() {
        return this.isEnabled;
    }
    /**
     * Generate NSFW image from text prompt (Text-to-Image)
     * Uses Flux.1Dev Uncensored model (MSFLUX NSFW v3)
     * WARNING: This is text-to-image only, does not preserve original person
     */
    async generateNSFWImage(prompt, options = {}) {
        if (!this.isEnabled) {
            throw new Error('Replicate service is not configured. Please add REPLICATE_API_TOKEN to environment variables.');
        }
        console.log(`🎨 Generating NSFW image with Replicate Flux.1Dev: "${prompt}"`);
        try {
            const output = await this.client.run("aisha-ai-official/flux.1dev-uncensored-msfluxnsfw-v3:b477d8fc3a62e591c6224e10020538c4a9c340fb1f494891aff60019ffd5bc48", {
                input: {
                    prompt,
                    width: options.width || 1024,
                    height: options.height || 1024,
                    steps: options.steps || 20,
                    seed: options.seed || -1,
                    cfg_scale: options.cfg_scale || 5,
                    scheduler: options.scheduler || "default",
                }
            });
            console.log('✅ NSFW image generated successfully');
            return output;
        }
        catch (error) {
            console.error('❌ Replicate image generation error:', {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                stack: error.stack,
            });
            throw error;
        }
    }
    /**
     * Generate NSFW image from input image (Image-to-Image)
     * Uses Flux img2img model - preserves original person
     * @param imageBuffer - Buffer containing the original image
     * @param prompt - Transformation prompt
     * @param denoising - Strength of transformation (0.5-1.0, default 0.75)
     */
    async generateNSFWImageFromImage(imageBuffer, prompt, options = {}) {
        if (!this.isEnabled) {
            throw new Error('Replicate service is not configured. Please add REPLICATE_API_TOKEN to environment variables.');
        }
        console.log('='.repeat(80));
        console.log('🚨 NSFW IMAGE-TO-IMAGE GENERATION STARTED (v1.0.2)');
        console.log('='.repeat(80));
        console.log(`🎨 Generating NSFW image-to-image with Flux: "${prompt.substring(0, 100)}..."`);
        console.log(`📸 Source image size: ${imageBuffer.length} bytes`);
        console.log(`🔧 Denoising: ${options.denoising || 0.75}`);
        try {
            // Process the image to ensure compatible dimensions
            console.log('📐 Processing source image...');
            // Use Sharp to resize image to compatible dimensions (divisible by 8)
            console.log('🔍 Loading Sharp library...');
            const sharp = require('sharp');
            console.log('✅ Sharp loaded successfully');
            console.log('🔍 Getting image metadata...');
            const metadata = await sharp(imageBuffer).metadata();
            console.log(`📐 Original size: ${metadata.width}x${metadata.height}`);
            // Calculate target dimensions (divisible by 8, maintain aspect ratio)
            const targetWidth = Math.floor((metadata.width || 1024) / 8) * 8;
            const targetHeight = Math.floor((metadata.height || 1024) / 8) * 8;
            console.log(`📐 Target size: ${targetWidth}x${targetHeight}`);
            const processedBuffer = await sharp(imageBuffer)
                .resize(targetWidth, targetHeight, { fit: 'cover' })
                .jpeg({ quality: 95 })
                .toBuffer();
            // Convert to base64 data URI
            const base64Image = `data:image/jpeg;base64,${processedBuffer.toString('base64')}`;
            console.log(`✅ Image processed (${Math.round(base64Image.length / 1024)}KB)`);
            const output = await this.client.run("bxclib2/flux_img2img:0ce45202d83c6bd379dfe58f4c0c41e6cadf93ebbd9d938cc63cc0f2fcb729a5", {
                input: {
                    image: base64Image, // Use processed base64 image instead of URL
                    positive_prompt: prompt,
                    denoising: options.denoising || 0.75, // Lower = more similar to original
                    steps: options.steps || 20,
                    seed: options.seed || -1,
                    scheduler: "simple",
                    sampler_name: "euler"
                }
            });
            console.log('✅ NSFW image-to-image generated successfully');
            return output;
        }
        catch (error) {
            console.error('❌ Replicate image-to-image generation error:', {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                stack: error.stack,
            });
            throw error;
        }
    }
    /**
     * Generate NSFW video from text prompt
     * Uses Zeroscope text-to-video model
     */
    async generateNSFWVideo(prompt, options = {}) {
        if (!this.isEnabled) {
            throw new Error('Replicate service is not configured. Please add REPLICATE_API_TOKEN to environment variables.');
        }
        console.log(`🎬 Generating NSFW video with Replicate: "${prompt}"`);
        try {
            const output = await this.client.run("anotherjesse/zeroscope-v2-xl:9f747673945c62801b13b84701c783929c0ee784e4748ec062204894dda1a351", {
                input: {
                    prompt,
                    num_frames: options.num_frames || 24,
                    fps: options.fps || 8,
                }
            });
            console.log('✅ NSFW video generated successfully');
            return output;
        }
        catch (error) {
            console.error('❌ Replicate video generation error:', {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
            });
            throw error;
        }
    }
    /**
     * Convert image to video (animate image)
     * Uses Stable Video Diffusion model
     */
    async imageToVideo(imageUrl, options = {}) {
        if (!this.isEnabled) {
            throw new Error('Replicate service is not configured. Please add REPLICATE_API_TOKEN to environment variables.');
        }
        console.log(`🎞️ Converting image to video with Replicate: ${imageUrl}`);
        try {
            const output = await this.client.run("stability-ai/stable-video-diffusion:3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438", {
                input: {
                    input_image: imageUrl,
                    motion_bucket_id: options.motion_bucket_id || 127,
                    frames_per_second: options.frames_per_second || 8,
                }
            });
            console.log('✅ Image-to-video conversion successful');
            return output;
        }
        catch (error) {
            console.error('❌ Replicate image-to-video error:', {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
            });
            throw error;
        }
    }
    /**
     * Generate content with webhook for async processing
     * Returns prediction ID that can be used to check status
     */
    async generateWithWebhook(modelVersion, input, webhookUrl) {
        if (!this.isEnabled) {
            throw new Error('Replicate service is not configured. Please add REPLICATE_API_TOKEN to environment variables.');
        }
        console.log(`🔔 Creating prediction with webhook: ${webhookUrl}`);
        try {
            const prediction = await this.client.predictions.create({
                version: modelVersion,
                input,
                webhook: webhookUrl,
                webhook_events_filter: ["completed"],
            });
            console.log(`✅ Prediction created: ${prediction.id}`);
            return prediction.id;
        }
        catch (error) {
            console.error('❌ Replicate webhook prediction error:', error);
            throw error;
        }
    }
    /**
     * Get prediction status
     */
    async getPrediction(predictionId) {
        if (!this.isEnabled) {
            throw new Error('Replicate service is not configured.');
        }
        try {
            const prediction = await this.client.predictions.get(predictionId);
            return prediction;
        }
        catch (error) {
            console.error('❌ Failed to get prediction:', error);
            throw error;
        }
    }
}
// Export singleton instance
exports.replicateService = new ReplicateService();
