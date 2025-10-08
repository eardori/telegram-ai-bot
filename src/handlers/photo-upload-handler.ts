/**
 * Photo Upload Handler
 *
 * Handles photo uploads from users and prepares for editing
 */

import { Context } from 'grammy';
import { supabase } from '../utils/supabase';
import { analyzeImage, getAnalysisSummary, ImageAnalysisResult } from '../services/image-analysis-service';
import { getTemplateRecommendations, TemplateRecommendation } from '../services/template-recommendation-service';

interface PhotoUploadResult {
  success: boolean;
  imageUrl?: string;
  fileId?: string;
  fileSize?: number;
  analysis?: ImageAnalysisResult;
  analysisSummary?: string;
  recommendations?: TemplateRecommendation[];
  error?: string;
}

/**
 * Handle photo upload from user
 */
export async function handlePhotoUpload(ctx: Context): Promise<PhotoUploadResult> {
  try {
    console.log('📸 Photo upload received from user:', ctx.from?.id);

    // Get photo (highest resolution)
    const photos = ctx.message?.photo;
    if (!photos || photos.length === 0) {
      return {
        success: false,
        error: 'No photo found in message'
      };
    }

    // Get highest resolution photo
    const photo = photos[photos.length - 1];
    const fileId = photo.file_id;
    const fileSize = photo.file_size || 0;

    console.log(`📏 Photo details: ${photo.width}x${photo.height}, ${fileSize} bytes`);

    // Get file info from Telegram
    const file = await ctx.api.getFile(fileId);
    const filePathOnTelegram = file.file_path;

    if (!filePathOnTelegram) {
      return {
        success: false,
        error: 'Could not get file path from Telegram'
      };
    }

    // Construct download URL
    const botToken = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
    const imageUrl = `https://api.telegram.org/file/bot${botToken}/${filePathOnTelegram}`;

    console.log('✅ Photo URL constructed:', imageUrl.substring(0, 80) + '...');

    // Analyze image with Gemini Vision
    console.log('🔍 Analyzing image...');
    const analysis = await analyzeImage(imageUrl);
    const analysisSummary = getAnalysisSummary(analysis);

    console.log('📊 Analysis result:', analysisSummary);

    // Get template recommendations based on analysis
    console.log('🎯 Getting template recommendations...');
    const recommendations = await getTemplateRecommendations(analysis, 5);

    // Store upload session in database with analysis
    const uploadSession = await storeUploadSession(ctx, fileId, imageUrl, fileSize, analysis);

    if (!uploadSession) {
      console.warn('⚠️ Failed to store upload session, but continuing...');
    }

    return {
      success: true,
      imageUrl,
      fileId,
      fileSize,
      analysis,
      analysisSummary,
      recommendations
    };

  } catch (error) {
    console.error('❌ Error handling photo upload:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Store upload session in database for tracking
 */
async function storeUploadSession(
  ctx: Context,
  fileId: string,
  imageUrl: string,
  fileSize: number,
  analysis: ImageAnalysisResult
): Promise<boolean> {
  try {
    // Generate a session ID (UUID)
    const sessionId = crypto.randomUUID();

    const { data, error } = await supabase
      .from('image_analysis_results')
      .insert({
        session_id: sessionId,
        user_id: ctx.from?.id,
        chat_id: ctx.chat?.id,
        message_id: ctx.message?.message_id,
        image_count: 1,
        image_urls: [imageUrl],
        image_sizes: [fileSize],
        total_size_bytes: fileSize,
        face_count: analysis.faces.count,
        detected_objects: analysis.objects,
        scene_description: analysis.rawAnalysis,
        dominant_colors: analysis.dominantColors,
        composition_type: analysis.imageType,
        analysis_data: {
          file_id: fileId,
          status: 'analyzed',
          ...analysis
        }
      });

    if (error) {
      console.error('❌ Database error storing upload session:', error);
      return false;
    }

    console.log('✅ Upload session stored in database');
    return true;

  } catch (error) {
    console.error('❌ Error storing upload session:', error);
    return false;
  }
}

/**
 * Download image to local storage (for processing)
 */
export async function downloadImage(imageUrl: string): Promise<Buffer | null> {
  try {
    const response = await fetch(imageUrl);

    if (!response.ok) {
      console.error('❌ Failed to download image:', response.statusText);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);

  } catch (error) {
    console.error('❌ Error downloading image:', error);
    return null;
  }
}

/**
 * Get image info without downloading
 */
export async function getImageInfo(imageUrl: string): Promise<{
  contentType?: string;
  size?: number;
} | null> {
  try {
    const response = await fetch(imageUrl, { method: 'HEAD' });

    if (!response.ok) {
      return null;
    }

    return {
      contentType: response.headers.get('content-type') || undefined,
      size: parseInt(response.headers.get('content-length') || '0')
    };

  } catch (error) {
    console.error('❌ Error getting image info:', error);
    return null;
  }
}
