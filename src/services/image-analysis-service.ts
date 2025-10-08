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

export interface AISuggestion {
  title: string;          // Creative title in Korean (5-10 chars)
  description: string;    // Why this would be amazing (1 sentence)
  prompt: string;         // Full Gemini editing prompt ready to use
  style: string;          // Artistic style or category
}

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

  // Mood and context
  mood?: 'happy' | 'serious' | 'playful' | 'dramatic' | 'neutral';
  backgroundComplexity?: 'simple' | 'moderate' | 'busy';

  // AI Creative Suggestions (NEW!)
  aiSuggestions: AISuggestion[];

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

    // Create enhanced analysis prompt with AI suggestions
    const prompt = `You are an expert photo analyst for a creative AI photo editing service.

Analyze this image in detail and provide a JSON response with TWO main sections:

1. STRUCTURED DATA (for template matching):
{
  "structuredData": {
    "faceCount": <number>,
    "faceClarity": "high" | "medium" | "low",
    "facePositions": ["center", "left", "right"],
    "scene": "indoor" | "outdoor" | "studio" | "unknown",
    "objects": [array of detected objects],
    "bodyVisible": true | false,
    "clothingVisible": true | false,
    "imageType": "portrait" | "full_body" | "landscape" | "object" | "group",
    "lighting": "natural" | "artificial" | "mixed" | "poor",
    "quality": "high" | "medium" | "low",
    "mood": "happy" | "serious" | "playful" | "dramatic" | "neutral",
    "backgroundComplexity": "simple" | "moderate" | "busy",
    "dominantColors": ["#hex1", "#hex2", "#hex3"],
    "description": "brief technical description"
  }
}

2. AI CREATIVE SUGGESTIONS (unique editing ideas for THIS specific image):
{
  "aiSuggestions": [
    {
      "title": "한글 제목 (5-10자)",
      "description": "왜 이 편집이 멋질지 한 문장으로 설명",
      "prompt": "Create an edited version of this image: [FULL detailed editing instruction ready for Gemini image generation. Be specific about style, mood, lighting, colors, effects. At least 3-4 sentences describing the transformation.]",
      "style": "vintage | dramatic | artistic | playful | professional | fantasy"
    }
    // Provide exactly 3 creative suggestions tailored to THIS image
  ]
}

IMPORTANT for AI Suggestions:
- Make them UNIQUE and SPECIFIC to this image
- Each prompt must be a COMPLETE instruction ready for AI image generation
- Think creatively: vintage film, watercolor painting, dramatic lighting, anime style, etc.
- Prompts should be in English and detailed (3-4+ sentences)
- Titles and descriptions in Korean

Return the complete JSON with both sections.`;

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
    console.log('📊 Gemini analysis response:', responseText.substring(0, 500) + '...');

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const analysisData = JSON.parse(jsonMatch[0]);
    const structured = analysisData.structuredData || analysisData; // Fallback for old format

    // Map to our interface
    const analysis: ImageAnalysisResult = {
      faces: {
        count: structured.faceCount || 0,
        clarity: structured.faceClarity || 'low',
        positions: structured.facePositions || []
      },
      scene: structured.scene || 'unknown',
      objects: structured.objects || [],
      bodyVisible: structured.bodyVisible || false,
      clothingClear: structured.clothingVisible || structured.clothingClear || false,
      imageType: structured.imageType || 'portrait',
      lighting: structured.lighting || 'natural',
      quality: structured.quality || 'medium',
      mood: structured.mood || 'neutral',
      backgroundComplexity: structured.backgroundComplexity || 'moderate',
      dominantColors: structured.dominantColors || [],
      aiSuggestions: analysisData.aiSuggestions || [],
      rawAnalysis: structured.description || responseText
    };

    console.log('✅ Image analysis complete:', {
      faces: analysis.faces.count,
      scene: analysis.scene,
      type: analysis.imageType,
      aiSuggestions: analysis.aiSuggestions.length
    });

    // Log AI suggestions
    if (analysis.aiSuggestions.length > 0) {
      console.log('✨ AI Suggestions:');
      analysis.aiSuggestions.forEach((suggestion, idx) => {
        console.log(`  ${idx + 1}. ${suggestion.title} (${suggestion.style})`);
      });
    }

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
      mood: 'neutral',
      backgroundComplexity: 'moderate',
      dominantColors: [],
      aiSuggestions: [],
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
