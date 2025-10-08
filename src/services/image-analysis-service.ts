/**
 * Image Analysis Service
 *
 * Analyzes images using Gemini Vision API to detect:
 * - Faces (count, clarity, positions)
 * - Objects and scene type
 * - Overall composition and quality
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

export interface ImageAnalysisResult {
  // Face detection
  faces: {
    count: number;
    clarity: 'high' | 'medium' | 'low';
    positions?: string[];  // ['center', 'left', 'right']
  };

  // Scene and objects
  scene: 'indoor' | 'outdoor' | 'studio' | 'unknown';
  objects: string[];  // ['person', 'chair', 'table']

  // Composition
  bodyVisible: boolean;  // full body, half body, or just face
  clothingClear: boolean;
  imageType: 'portrait' | 'full_body' | 'landscape' | 'object' | 'group';

  // Quality
  lighting: 'natural' | 'artificial' | 'mixed' | 'poor';
  quality: 'high' | 'medium' | 'low';

  // Color analysis
  dominantColors?: string[];

  // Raw analysis text
  rawAnalysis: string;
}

/**
 * Analyze image using Gemini Vision
 */
export async function analyzeImage(imageUrl: string): Promise<ImageAnalysisResult> {
  console.log('🔍 Starting image analysis with Gemini Vision...');

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    // Download image
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString('base64');

    // Create analysis prompt
    const prompt = `Analyze this image in detail and provide a JSON response with the following structure:

{
  "faceCount": <number of faces detected>,
  "faceClarity": "high" | "medium" | "low",
  "facePositions": [array of positions like "center", "left", "right"],
  "scene": "indoor" | "outdoor" | "studio" | "unknown",
  "objects": [array of detected objects],
  "bodyVisible": true | false (is full body or most of body visible?),
  "clothingClear": true | false (are clothes clearly visible?),
  "imageType": "portrait" | "full_body" | "landscape" | "object" | "group",
  "lighting": "natural" | "artificial" | "mixed" | "poor",
  "quality": "high" | "medium" | "low",
  "dominantColors": [array of 3-5 dominant colors as hex codes],
  "description": "brief description of the image"
}

Be precise and analytical. Focus on technical details that would help with photo editing recommendations.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBase64
        }
      }
    ]);

    const responseText = result.response.text();
    console.log('📊 Gemini analysis response:', responseText);

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const analysisData = JSON.parse(jsonMatch[0]);

    // Map to our interface
    const analysis: ImageAnalysisResult = {
      faces: {
        count: analysisData.faceCount || 0,
        clarity: analysisData.faceClarity || 'low',
        positions: analysisData.facePositions || []
      },
      scene: analysisData.scene || 'unknown',
      objects: analysisData.objects || [],
      bodyVisible: analysisData.bodyVisible || false,
      clothingClear: analysisData.clothingClear || false,
      imageType: analysisData.imageType || 'portrait',
      lighting: analysisData.lighting || 'natural',
      quality: analysisData.quality || 'medium',
      dominantColors: analysisData.dominantColors || [],
      rawAnalysis: analysisData.description || responseText
    };

    console.log('✅ Image analysis complete:', {
      faces: analysis.faces.count,
      scene: analysis.scene,
      type: analysis.imageType
    });

    return analysis;

  } catch (error) {
    console.error('❌ Image analysis error:', error);

    // Return minimal analysis on error
    return {
      faces: { count: 0, clarity: 'low' },
      scene: 'unknown',
      objects: [],
      bodyVisible: false,
      clothingClear: false,
      imageType: 'portrait',
      lighting: 'natural',
      quality: 'medium',
      rawAnalysis: 'Analysis failed: ' + (error instanceof Error ? error.message : 'Unknown error')
    };
  }
}

/**
 * Quick face detection (faster, less detailed)
 */
export async function quickFaceDetection(imageUrl: string): Promise<number> {
  console.log('👤 Quick face detection...');

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString('base64');

    const result = await model.generateContent([
      'How many human faces are in this image? Reply with just a number.',
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBase64
        }
      }
    ]);

    const responseText = result.response.text().trim();
    const faceCount = parseInt(responseText) || 0;

    console.log('✅ Face count:', faceCount);
    return faceCount;

  } catch (error) {
    console.error('❌ Face detection error:', error);
    return 0;
  }
}

/**
 * Get human-readable analysis summary
 */
export function getAnalysisSummary(analysis: ImageAnalysisResult): string {
  const parts: string[] = [];

  // Face info
  if (analysis.faces.count > 0) {
    parts.push(`👤 인물 ${analysis.faces.count}명 감지`);
    if (analysis.faces.clarity === 'high') {
      parts.push('(선명함)');
    }
  }

  // Image type
  const typeMap: Record<string, string> = {
    'portrait': '인물 사진',
    'full_body': '전신 사진',
    'landscape': '풍경 사진',
    'object': '사물 사진',
    'group': '단체 사진'
  };
  parts.push(`📸 ${typeMap[analysis.imageType] || '일반 사진'}`);

  // Scene
  const sceneMap: Record<string, string> = {
    'indoor': '실내',
    'outdoor': '야외',
    'studio': '스튜디오',
    'unknown': '알 수 없음'
  };
  parts.push(`🏠 ${sceneMap[analysis.scene]}`);

  // Lighting
  const lightMap: Record<string, string> = {
    'natural': '자연광',
    'artificial': '인공 조명',
    'mixed': '복합 조명',
    'poor': '어두운 조명'
  };
  parts.push(`💡 ${lightMap[analysis.lighting]}`);

  return parts.join(' • ');
}
