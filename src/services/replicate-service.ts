/**
 * Replicate API Service
 *
 * Provides NSFW image and video generation capabilities using Replicate API.
 * Used for content that cannot be generated with standard Gemini/Imagen APIs.
 */

import Replicate from 'replicate';

interface GenerateImageOptions {
  width?: number;
  height?: number;
  num_outputs?: number;
  negative_prompt?: string;
}

interface GenerateVideoOptions {
  num_frames?: number;
  fps?: number;
}

interface ImageToVideoOptions {
  motion_bucket_id?: number;
  frames_per_second?: number;
}

class ReplicateService {
  private client: Replicate;
  private isEnabled: boolean;

  constructor() {
    const apiToken = process.env.REPLICATE_API_TOKEN;

    if (!apiToken) {
      console.warn('⚠️ REPLICATE_API_TOKEN not configured. NSFW features will be disabled.');
      this.isEnabled = false;
      // Create dummy client to avoid crashes
      this.client = null as any;
    } else {
      this.client = new Replicate({
        auth: apiToken,
      });
      this.isEnabled = true;
      console.log('✅ Replicate service initialized');
    }
  }

  /**
   * Check if Replicate service is available
   */
  isAvailable(): boolean {
    return this.isEnabled;
  }

  /**
   * Generate NSFW image from text prompt
   * Uses Stable Diffusion XL model
   */
  async generateNSFWImage(
    prompt: string,
    options: GenerateImageOptions = {}
  ): Promise<string[]> {
    if (!this.isEnabled) {
      throw new Error('Replicate service is not configured. Please add REPLICATE_API_TOKEN to environment variables.');
    }

    console.log(`🎨 Generating NSFW image with Replicate: "${prompt}"`);

    try {
      const output = await this.client.run(
        "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
        {
          input: {
            prompt,
            width: options.width || 1024,
            height: options.height || 1024,
            num_outputs: options.num_outputs || 1,
            negative_prompt: options.negative_prompt || "ugly, bad quality, blurry, distorted",
          }
        }
      );

      console.log('✅ NSFW image generated successfully');
      return output as string[];
    } catch (error) {
      console.error('❌ Replicate image generation error:', error);
      throw error;
    }
  }

  /**
   * Generate NSFW video from text prompt
   * Uses Zeroscope text-to-video model
   */
  async generateNSFWVideo(
    prompt: string,
    options: GenerateVideoOptions = {}
  ): Promise<string> {
    if (!this.isEnabled) {
      throw new Error('Replicate service is not configured. Please add REPLICATE_API_TOKEN to environment variables.');
    }

    console.log(`🎬 Generating NSFW video with Replicate: "${prompt}"`);

    try {
      const output = await this.client.run(
        "anotherjesse/zeroscope-v2-xl:9f747673945c62801b13b84701c783929c0ee784e4748ec062204894dda1a351",
        {
          input: {
            prompt,
            num_frames: options.num_frames || 24,
            fps: options.fps || 8,
          }
        }
      );

      console.log('✅ NSFW video generated successfully');
      return output as unknown as string;
    } catch (error) {
      console.error('❌ Replicate video generation error:', error);
      throw error;
    }
  }

  /**
   * Convert image to video (animate image)
   * Uses Stable Video Diffusion model
   */
  async imageToVideo(
    imageUrl: string,
    options: ImageToVideoOptions = {}
  ): Promise<string> {
    if (!this.isEnabled) {
      throw new Error('Replicate service is not configured. Please add REPLICATE_API_TOKEN to environment variables.');
    }

    console.log(`🎞️ Converting image to video with Replicate: ${imageUrl}`);

    try {
      const output = await this.client.run(
        "stability-ai/stable-video-diffusion:3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438",
        {
          input: {
            input_image: imageUrl,
            motion_bucket_id: options.motion_bucket_id || 127,
            frames_per_second: options.frames_per_second || 8,
          }
        }
      );

      console.log('✅ Image-to-video conversion successful');
      return output as unknown as string;
    } catch (error) {
      console.error('❌ Replicate image-to-video error:', error);
      throw error;
    }
  }

  /**
   * Generate content with webhook for async processing
   * Returns prediction ID that can be used to check status
   */
  async generateWithWebhook(
    modelVersion: string,
    input: any,
    webhookUrl: string
  ): Promise<string> {
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
    } catch (error) {
      console.error('❌ Replicate webhook prediction error:', error);
      throw error;
    }
  }

  /**
   * Get prediction status
   */
  async getPrediction(predictionId: string): Promise<any> {
    if (!this.isEnabled) {
      throw new Error('Replicate service is not configured.');
    }

    try {
      const prediction = await this.client.predictions.get(predictionId);
      return prediction;
    } catch (error) {
      console.error('❌ Failed to get prediction:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const replicateService = new ReplicateService();
