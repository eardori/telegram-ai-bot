/**
 * Image Edit Service
 *
 * Executes image editing using template prompts and AI models
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

export interface ImageEditRequest {
  imageUrl: string;
  templatePrompt: string;
  templateName: string;
  category: string;
}

export interface ImageEditResult {
  success: boolean;
  outputUrl?: string;
  error?: string;
  processingTime?: number;
}

/**
 * Edit image using Gemini vision model with template prompt
 */
export async function editImageWithTemplate(request: ImageEditRequest): Promise<ImageEditResult> {
  const startTime = Date.now();

  try {
    console.log('🎨 Starting image editing with Gemini...');
    console.log(`📝 Template: ${request.templateName}`);
    console.log(`📋 Category: ${request.category}`);

    // Download image
    const imageResponse = await fetch(request.imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString('base64');

    console.log('✅ Image downloaded, size:', imageBuffer.byteLength, 'bytes');

    // Use Gemini 2.0 Flash Exp for image generation
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    // Create detailed editing prompt
    const editPrompt = `${request.templatePrompt}

IMPORTANT INSTRUCTIONS:
- Analyze the input image carefully
- Apply the requested style transformation
- Maintain the subject's identity and key features
- Enhance quality while preserving important details
- Create a visually appealing result

Please generate a transformed version of this image following the style description above.`;

    console.log('🔄 Sending request to Gemini...');

    // Generate edited image description (Gemini can't directly output images, so we describe the edit)
    const result = await model.generateContent([
      editPrompt,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBase64
        }
      }
    ]);

    const responseText = result.response.text();
    console.log('📊 Gemini response:', responseText.substring(0, 200) + '...');

    // Since Gemini Flash doesn't generate images directly, we need to use a different approach
    // For now, we'll use Imagen 3 via the same API
    return await generateEditedImageWithImagen(request, imageBase64);

  } catch (error) {
    console.error('❌ Image editing error:', error);
    const processingTime = Date.now() - startTime;

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime
    };
  }
}

/**
 * Generate edited image using Imagen 3 (Google's image generation model)
 */
async function generateEditedImageWithImagen(
  request: ImageEditRequest,
  imageBase64: string
): Promise<ImageEditResult> {
  const startTime = Date.now();

  try {
    console.log('🎨 Using Imagen 3 for image generation...');

    // Use Imagen 3 model (newer and better quality)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    // Create image generation prompt based on template
    const imageGenPrompt = `Create a high-quality image based on this description:

${request.templatePrompt}

Style: ${request.category}
Quality: Professional, high-resolution
Details: Photorealistic, well-composed, visually appealing

Generate an image that matches this description perfectly.`;

    console.log('🔄 Generating new image with Gemini...');

    const result = await model.generateContent([imageGenPrompt]);
    const responseText = result.response.text();

    console.log('📊 Image generation response:', responseText);

    // Note: Gemini currently doesn't directly output image files
    // We need to use a different service for actual image generation
    // For now, we'll return a placeholder and implement proper image generation later

    const processingTime = Date.now() - startTime;

    // TODO: Integrate with actual image generation service (Replicate, etc.)
    return {
      success: false,
      error: 'Image generation not yet implemented - need to integrate image generation API',
      processingTime
    };

  } catch (error) {
    console.error('❌ Imagen generation error:', error);
    const processingTime = Date.now() - startTime;

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
