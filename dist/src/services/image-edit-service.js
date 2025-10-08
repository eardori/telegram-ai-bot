"use strict";
/**
 * Image Edit Service
 *
 * Executes image editing using template prompts and AI models
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.editImageWithTemplate = editImageWithTemplate;
exports.editImageWithReplicate = editImageWithReplicate;
const generative_ai_1 = require("@google/generative-ai");
const nano_banafo_client_1 = require("./nano-banafo-client");
const grammy_1 = require("grammy");
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
const genAI = new generative_ai_1.GoogleGenerativeAI(GOOGLE_API_KEY);
const geminiClient = new nano_banafo_client_1.NanoBanafoClient();
/**
 * Edit image using Gemini vision model with template prompt (NanoBanafoClient)
 */
async function editImageWithTemplate(request) {
    const startTime = Date.now();
    try {
        console.log('🎨 Starting image editing with Gemini...');
        console.log(`📝 Template: ${request.templateName}`);
        console.log(`📋 Category: ${request.category}`);
        // Download image to buffer
        const imageResponse = await fetch(request.imageUrl);
        if (!imageResponse.ok) {
            throw new Error(`Failed to download image: ${imageResponse.status}`);
        }
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        console.log('✅ Image downloaded, size:', imageBuffer.length, 'bytes');
        // Create enhanced editing prompt
        const editPrompt = `${request.templatePrompt}

IMPORTANT INSTRUCTIONS:
- Analyze the input image carefully
- Apply the requested style transformation precisely
- Maintain the subject's identity and key features
- Enhance quality while preserving important details
- Create a visually appealing, high-quality result

Generate the edited image following the style description above.`;
        console.log('🔄 Sending request to Gemini via NanoBanafoClient...');
        // Edit image using NanoBanafoClient (Gemini 2.5 Flash Image Preview)
        const editedBuffer = await geminiClient.editImage(imageBuffer, editPrompt);
        const processingTime = Date.now() - startTime;
        console.log(`✅ Image editing completed in ${processingTime}ms`);
        // Create InputFile from buffer for grammY
        const outputFile = new grammy_1.InputFile(editedBuffer, `edited_${Date.now()}.jpg`);
        return {
            success: true,
            outputFile,
            processingTime
        };
    }
    catch (error) {
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
 * Generate edited image using Replicate API (better for actual image editing)
 */
async function editImageWithReplicate(request) {
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
        const prediction = await response.json();
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
            const status = await statusResponse.json();
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
    }
    catch (error) {
        console.error('❌ Replicate editing error:', error);
        const processingTime = Date.now() - startTime;
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            processingTime
        };
    }
}
