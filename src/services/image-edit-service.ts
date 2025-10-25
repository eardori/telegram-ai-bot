/**
 * Image Edit Service
 *
 * Executes image editing using template prompts and AI models
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { NanoBanafoClient } from './nano-banafo-client';
import { InputFile } from 'grammy';
import { logAPIUsage } from './api-cost-tracker';
import { replicateService } from './replicate-service';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
const geminiClient = new NanoBanafoClient();

export interface ImageEditRequest {
  imageUrl: string;
  templatePrompt: string;
  templateName: string;
  category: string;
  userId?: number;  // For cost tracking
  chatId?: number;  // For cost tracking
  templateKey?: string;  // For cost tracking
}

export interface ImageEditResult {
  success: boolean;
  outputUrl?: string;
  outputFile?: InputFile;  // Added for direct file sending
  error?: string;
  processingTime?: number;
}

/**
 * Get category-specific enhancement instructions
 */
function getCategoryInstructions(category: string): string {
  const instructions: Record<string, string> = {
    '3d_figurine': `
CATEGORY-SPECIFIC INSTRUCTIONS (3D Figurine):
- Transform into miniature figurine aesthetic (Nendoroid, Funko Pop, or clay figure style)
- Use clean, simple background (solid color or subtle gradient)
- Apply toy/plastic material appearance with slight sheen
- Simplify facial features while keeping them recognizable
- Add characteristic large head and small body proportions (if full-body)
- Maintain cute, stylized appearance
- Preserve distinctive clothing and accessories in simplified form`,

    'portrait_styling': `
CATEGORY-SPECIFIC INSTRUCTIONS (Portrait Styling):
- Maintain photorealistic quality throughout
- Enhance lighting and composition professionally
- Keep natural skin tones and textures
- Preserve subject's identity 100%
- Apply professional photo studio techniques
- Enhance without over-processing
- Maintain natural expressions and features`,

    'game_animation': `
CATEGORY-SPECIFIC INSTRUCTIONS (Game/Animation):
- Apply stylized character art aesthetic (game character or anime style)
- Use vibrant, saturated colors with high contrast
- Add characteristic animation/game art shading and highlights
- Maintain recognizable facial features in stylized form
- Apply clean line work and cel-shading if appropriate
- Create dynamic, appealing character design
- Keep background simple or thematic to character`,

    'image_editing': `
CATEGORY-SPECIFIC INSTRUCTIONS (Image Editing):
- Apply requested edits precisely and realistically
- Maintain photorealistic quality
- Blend changes naturally with original image
- Preserve overall image quality and resolution
- Ensure edited areas match lighting and perspective
- Keep unedited areas unchanged
- Create seamless, professional result`,

    'creative_transform': `
CATEGORY-SPECIFIC INSTRUCTIONS (Creative Transform):
- Apply creative artistic interpretation
- Use unique visual style appropriate to theme
- Maintain subject recognition while being creative
- Add artistic flair and personality
- Balance creativity with clarity
- Create visually striking result
- Preserve key identifying features`
  };

  return instructions[category] || '';
}

/**
 * Edit image using appropriate AI model based on category
 * - NSFW category: Replicate API (Flux.1Dev Uncensored)
 * - Other categories: Gemini via NanoBanafoClient
 */
export async function editImageWithTemplate(request: ImageEditRequest): Promise<ImageEditResult> {
  const startTime = Date.now();

  try {
    const isNSFW = request.category === 'nsfw';
    const modelName = isNSFW ? 'Replicate (NSFW)' : 'Gemini';

    console.log(`🎨 Starting image editing with ${modelName}...`);
    console.log(`📝 Template: ${request.templateName}`);
    console.log(`📋 Category: ${request.category}`);
    console.log(`🔞 NSFW: ${isNSFW}`);

    // Download image to buffer with timeout and retry
    let imageBuffer: Buffer;
    let retries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`🔄 Downloading image (attempt ${attempt}/${retries})...`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000); // 15초 타임아웃

        const imageResponse = await fetch(request.imageUrl, {
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (!imageResponse.ok) {
          throw new Error(`Failed to download image: ${imageResponse.status}`);
        }

        imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        console.log('✅ Image downloaded, size:', imageBuffer.length, 'bytes');
        break; // 성공하면 루프 탈출

      } catch (error) {
        lastError = error as Error;
        console.error(`❌ Download attempt ${attempt} failed:`, error);

        if (attempt === retries) {
          throw new Error(`Failed to download image after ${retries} attempts: ${lastError.message}`);
        }

        // 재시도 전 1초 대기
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    let editedBuffer: Buffer;

    // Route to appropriate AI model based on category
    if (isNSFW) {
      // ============================================
      // NSFW: Use Replicate API (Flux img2img)
      // ============================================
      console.log('🔄 Routing to Replicate API for NSFW content...');

      // Check if Replicate is available
      if (!replicateService.isAvailable()) {
        throw new Error('Replicate API is not configured. NSFW features are unavailable.');
      }

      // Build NSFW prompt with quality requirements
      const nsfwPrompt = `${request.templatePrompt}

QUALITY REQUIREMENTS:
- High resolution output (1024x1024)
- Professional photography quality
- Photorealistic rendering
- Sharp details and clear focus
- Proper lighting and composition
- Maintain facial features and identity of the person in the original image

STYLE:
- Professional photography aesthetic
- Natural and realistic
- High-quality professional result`;

      console.log('📝 NSFW Prompt:', nsfwPrompt.substring(0, 200) + '...');

      // Generate NSFW image using Image-to-Image (preserves original person)
      const resultUrls = await replicateService.generateNSFWImageFromImage(
        request.imageUrl,
        nsfwPrompt,
        {
          denoising: 0.75,  // Balance between transformation and preservation
          steps: 25,
          seed: -1
        }
      );

      if (!resultUrls || resultUrls.length === 0) {
        throw new Error('Replicate API returned no results');
      }

      // Download the generated image
      console.log('📥 Downloading Replicate result...');
      const replicateResponse = await fetch(resultUrls[0]);
      if (!replicateResponse.ok) {
        throw new Error(`Failed to download Replicate result: ${replicateResponse.status}`);
      }
      editedBuffer = Buffer.from(await replicateResponse.arrayBuffer());
      console.log('✅ Replicate image downloaded');

    } else {
      // ============================================
      // Regular: Use Gemini via NanoBanafoClient
      // ============================================
      console.log('🔄 Routing to Gemini for regular content...');

      // Create enhanced editing prompt with category-specific instructions
      const categoryInstructions = getCategoryInstructions(request.category);
      const editPrompt = `${request.templatePrompt}

${categoryInstructions}

QUALITY REQUIREMENTS:
- High resolution output (1024x1024 or better)
- Sharp details and clear focus
- Professional color grading
- No artifacts or distortions
- Balanced composition

SUBJECT PRESERVATION:
- Keep facial features recognizable
- Maintain body proportions naturally
- Preserve distinctive characteristics
- Natural pose and expression

Generate the edited image following all instructions above.`;

      console.log('🔄 Sending request to Gemini via NanoBanafoClient...');

      // Edit image using NanoBanafoClient (Gemini 2.5 Flash Image Preview)
      editedBuffer = await geminiClient.editImage(imageBuffer, editPrompt);
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ Image editing completed in ${processingTime}ms`);

    // Log API usage for cost tracking
    if (request.userId) {
      await logAPIUsage({
        user_id: request.userId,
        chat_id: request.chatId,
        operation: isNSFW ? 'nsfw_image_gen' : 'image_edit',
        model: isNSFW ? 'flux.1dev-uncensored-v3' : 'gemini-2.5-flash-image-preview',
        input_images: isNSFW ? 0 : 1, // Replicate is text-to-image
        output_images: 1,
        estimated_cost: 0, // Will be calculated in logAPIUsage
        template_key: request.templateKey,
        processing_time_ms: processingTime,
        success: true
      });
    }

    // Create InputFile from buffer for grammY
    const outputFile = new InputFile(editedBuffer, `edited_${Date.now()}.jpg`);

    return {
      success: true,
      outputFile,
      processingTime
    };

  } catch (error) {
    console.error('❌ Image editing error:', error);
    const processingTime = Date.now() - startTime;
    const isNSFW = request.category === 'nsfw';

    // Log failed API usage
    if (request.userId) {
      await logAPIUsage({
        user_id: request.userId,
        chat_id: request.chatId,
        operation: isNSFW ? 'nsfw_image_gen' : 'image_edit',
        model: isNSFW ? 'flux.1dev-uncensored-v3' : 'gemini-2.5-flash-image-preview',
        input_images: isNSFW ? 0 : 1,
        output_images: 0,
        estimated_cost: 0,
        template_key: request.templateKey,
        processing_time_ms: processingTime,
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime
    };
  }
}


/**
 * Generate edited image using Replicate API (better for actual image editing)
 */
export async function editImageWithReplicate(request: ImageEditRequest): Promise<ImageEditResult> {
  const startTime = Date.now();

  try {
    console.log('🎨 Using Replicate for image editing...');

    const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

    if (!REPLICATE_API_TOKEN) {
      throw new Error('Replicate API token not configured');
    }

    // Use Flux.1Dev for image-to-image editing
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'black-forest-labs/flux-dev',
        input: {
          prompt: request.templatePrompt,
          image: request.imageUrl,
          prompt_strength: 0.8, // How much to follow the prompt vs original image
          num_inference_steps: 28,
          guidance_scale: 3.5,
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Replicate API error: ${response.status} - ${errorText}`);
    }

    const prediction = await response.json() as any;
    console.log('✅ Prediction created:', prediction.id);

    // Poll for completion (with timeout)
    const maxAttempts = 30; // 30 attempts * 2 seconds = 60 seconds max
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: {
          'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
        }
      });

      const status = await statusResponse.json() as any;
      console.log(`⏳ Attempt ${attempts + 1}: ${status.status}`);

      if (status.status === 'succeeded') {
        const processingTime = Date.now() - startTime;
        const outputUrl = Array.isArray(status.output) ? status.output[0] : status.output;

        console.log('✅ Image editing completed:', outputUrl);

        return {
          success: true,
          outputUrl,
          processingTime
        };
      }

      if (status.status === 'failed') {
        throw new Error(status.error || 'Prediction failed');
      }

      attempts++;
    }

    throw new Error('Image editing timed out after 60 seconds');

  } catch (error) {
    console.error('❌ Replicate editing error:', error);
    const processingTime = Date.now() - startTime;

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime
    };
  }
}
