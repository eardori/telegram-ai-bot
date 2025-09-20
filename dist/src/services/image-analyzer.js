"use strict";
/**
 * Image Analysis Service
 * Analyzes uploaded images using Gemini Vision API
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageAnalyzer = void 0;
// Environment variables
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
const GEMINI_MODEL = 'gemini-1.5-pro-latest';
class ImageAnalyzer {
    constructor(apiKey, model) {
        this.apiKey = apiKey || GOOGLE_API_KEY;
        this.model = model || GEMINI_MODEL;
        if (!this.apiKey) {
            throw new Error('Google API key is required for image analysis');
        }
    }
    /**
     * Analyze a single image
     */
    async analyze(imageBuffer) {
        const startTime = Date.now();
        const imageBase64 = imageBuffer.toString('base64');
        try {
            // Parallel analysis for better performance
            const [faceAnalysis, objectDetection, sceneAnalysis, compositionAnalysis, qualityMetrics, colorAnalysis] = await Promise.all([
                this.analyzeFaces(imageBase64),
                this.detectObjects(imageBase64),
                this.analyzeScene(imageBase64),
                this.analyzeComposition(imageBase64),
                this.analyzeQuality(imageBuffer),
                this.analyzeDominantColors(imageBase64)
            ]);
            // Generate categories based on analysis
            const suggestedCategories = this.suggestCategories(faceAnalysis, objectDetection, sceneAnalysis);
            // Calculate confidence scores
            const confidenceScores = this.calculateConfidenceScores(faceAnalysis, objectDetection, sceneAnalysis, qualityMetrics);
            const analysis = {
                id: this.generateId(),
                sessionId: this.generateId(),
                userId: 0, // Will be set by caller
                chatId: 0, // Will be set by caller
                imageCount: 1,
                imageUrls: [], // Will be set by caller
                imageSizes: [imageBuffer.length],
                totalSizeBytes: imageBuffer.length,
                faces: faceAnalysis,
                detectedObjects: objectDetection,
                scene: sceneAnalysis,
                composition: compositionAnalysis,
                quality: qualityMetrics,
                dominantColors: colorAnalysis,
                suggestedCategories,
                confidenceScores,
                analysisTimeMs: Date.now() - startTime,
                apiCallsMade: 6,
                createdAt: new Date()
            };
            return analysis;
        }
        catch (error) {
            console.error('Image analysis failed:', error);
            throw new Error(`Failed to analyze image: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Analyze multiple images
     */
    async analyzeMultiple(imageBuffers) {
        const startTime = Date.now();
        // Analyze each image
        const analyses = await Promise.all(imageBuffers.map(buffer => this.analyze(buffer)));
        // Merge results
        const mergedAnalysis = this.mergeAnalyses(analyses);
        mergedAnalysis.analysisTimeMs = Date.now() - startTime;
        return mergedAnalysis;
    }
    /**
     * Analyze faces in the image
     */
    async analyzeFaces(imageBase64) {
        const prompt = `Analyze the faces in this image. Provide:
1. Number of faces detected
2. Position of each face (approximate coordinates as percentages)
3. Clarity of faces (high/medium/low)
4. Facial expressions if visible
5. Approximate age and gender if detectable

Return as JSON format:
{
  "count": number,
  "clarity": "high/medium/low",
  "faces": [
    {
      "x": percentage,
      "y": percentage,
      "width": percentage,
      "height": percentage,
      "expression": string,
      "age": number,
      "gender": string
    }
  ]
}`;
        try {
            const response = await this.callGeminiVision(imageBase64, prompt);
            const result = this.parseJsonResponse(response);
            const faceAnalysis = {
                count: result.count || 0,
                clarity: result.clarity || 'low',
                positions: (result.faces || []).map((face) => ({
                    x: face.x || 0,
                    y: face.y || 0,
                    width: face.width || 0,
                    height: face.height || 0,
                    confidence: 0.8
                })),
                expressions: result.faces?.map((f) => f.expression).filter(Boolean),
                ages: result.faces?.map((f) => f.age).filter(Boolean),
                genders: result.faces?.map((f) => f.gender).filter(Boolean)
            };
            return faceAnalysis;
        }
        catch (error) {
            console.error('Face analysis failed:', error);
            return {
                count: 0,
                clarity: 'low',
                positions: []
            };
        }
    }
    /**
     * Detect objects in the image
     */
    async detectObjects(imageBase64) {
        const prompt = `Identify all significant objects in this image. For each object provide:
1. Object name/type
2. Confidence level (0-1)
3. Approximate bounding box if applicable

Return as JSON array:
[
  {
    "name": string,
    "confidence": number,
    "x": percentage,
    "y": percentage,
    "width": percentage,
    "height": percentage
  }
]`;
        try {
            const response = await this.callGeminiVision(imageBase64, prompt);
            const objects = this.parseJsonResponse(response);
            return (objects || []).map((obj) => ({
                name: obj.name || 'unknown',
                confidence: obj.confidence || 0.5,
                boundingBox: obj.x ? {
                    x: obj.x,
                    y: obj.y,
                    width: obj.width || 0,
                    height: obj.height || 0
                } : undefined
            }));
        }
        catch (error) {
            console.error('Object detection failed:', error);
            return [];
        }
    }
    /**
     * Analyze the scene
     */
    async analyzeScene(imageBase64) {
        const prompt = `Analyze the scene in this image. Describe:
1. Scene type (indoor/outdoor/studio/etc)
2. Overall description
3. Lighting conditions
4. Mood/atmosphere
5. Time of day if applicable

Return as JSON:
{
  "type": string,
  "description": string,
  "lighting": string,
  "mood": string,
  "timeOfDay": string
}`;
        try {
            const response = await this.callGeminiVision(imageBase64, prompt);
            const scene = this.parseJsonResponse(response);
            return {
                type: scene.type || 'unknown',
                description: scene.description || '',
                lighting: scene.lighting || 'neutral',
                mood: scene.mood || 'neutral',
                timeOfDay: scene.timeOfDay
            };
        }
        catch (error) {
            console.error('Scene analysis failed:', error);
            return {
                type: 'unknown',
                description: '',
                lighting: 'neutral',
                mood: 'neutral'
            };
        }
    }
    /**
     * Analyze composition
     */
    async analyzeComposition(imageBase64) {
        const prompt = `Analyze the photographic composition. Check for:
1. Composition type (portrait/landscape/close-up/etc)
2. Rule of thirds
3. Leading lines
4. Symmetry
5. Depth perception (shallow/medium/deep)

Return as JSON:
{
  "type": string,
  "ruleOfThirds": boolean,
  "leadingLines": boolean,
  "symmetry": boolean,
  "depth": "shallow/medium/deep"
}`;
        try {
            const response = await this.callGeminiVision(imageBase64, prompt);
            const composition = this.parseJsonResponse(response);
            return {
                type: composition.type || 'unknown',
                ruleOfThirds: composition.ruleOfThirds || false,
                leadingLines: composition.leadingLines || false,
                symmetry: composition.symmetry || false,
                depth: composition.depth || 'medium'
            };
        }
        catch (error) {
            console.error('Composition analysis failed:', error);
            return {
                type: 'unknown',
                ruleOfThirds: false,
                leadingLines: false,
                symmetry: false,
                depth: 'medium'
            };
        }
    }
    /**
     * Analyze image quality
     */
    async analyzeQuality(imageBuffer) {
        // Get basic image info
        const sizeInBytes = imageBuffer.length;
        const sizeInKB = sizeInBytes / 1024;
        // Estimate dimensions (simplified - in production use sharp or jimp)
        const estimatedPixels = sizeInKB * 1000; // Rough estimate
        const estimatedWidth = Math.sqrt(estimatedPixels * (16 / 9));
        const estimatedHeight = estimatedWidth * (9 / 16);
        // Simple quality scoring based on size
        let overallScore = 0.5;
        if (sizeInKB > 500)
            overallScore = 0.7;
        if (sizeInKB > 1000)
            overallScore = 0.8;
        if (sizeInKB > 2000)
            overallScore = 0.9;
        return {
            resolution: {
                width: Math.round(estimatedWidth),
                height: Math.round(estimatedHeight)
            },
            sharpness: overallScore,
            exposure: 0,
            contrast: 0.5,
            saturation: 0.5,
            noise: 1 - overallScore,
            overallScore
        };
    }
    /**
     * Analyze dominant colors
     */
    async analyzeDominantColors(imageBase64) {
        const prompt = `Identify the 5 most dominant colors in this image. Return as a simple JSON array of hex color codes.`;
        try {
            const response = await this.callGeminiVision(imageBase64, prompt);
            const colors = this.parseJsonResponse(response);
            if (Array.isArray(colors)) {
                return colors.slice(0, 5);
            }
            return ['#888888', '#666666', '#444444'];
        }
        catch (error) {
            console.error('Color analysis failed:', error);
            return ['#888888', '#666666', '#444444'];
        }
    }
    /**
     * Suggest categories based on analysis
     */
    suggestCategories(faces, objects, scene) {
        const categories = [];
        // Face-based suggestions
        if (faces.count === 1 && faces.clarity === 'high') {
            categories.push('portrait_styling', '3d_figurine');
        }
        if (faces.count >= 2) {
            categories.push('creative_transform', 'image_editing');
        }
        // Object-based suggestions
        const hasClothing = objects.some(obj => obj.name.toLowerCase().includes('clothing') ||
            obj.name.toLowerCase().includes('outfit'));
        if (hasClothing) {
            categories.push('image_editing');
        }
        // Scene-based suggestions
        if (scene.type === 'outdoor') {
            categories.push('image_editing');
        }
        if (scene.type === 'studio') {
            categories.push('portrait_styling');
        }
        // Default suggestion
        if (categories.length === 0) {
            categories.push('creative_transform');
        }
        return [...new Set(categories)];
    }
    /**
     * Calculate confidence scores
     */
    calculateConfidenceScores(faces, objects, scene, quality) {
        const scores = {};
        // Portrait styling confidence
        scores.portrait_styling = 0;
        if (faces.count === 1)
            scores.portrait_styling += 0.4;
        if (faces.clarity === 'high')
            scores.portrait_styling += 0.3;
        if (quality.overallScore > 0.7)
            scores.portrait_styling += 0.3;
        // 3D figurine confidence
        scores['3d_figurine'] = 0;
        if (faces.count === 1 && faces.clarity === 'high') {
            scores['3d_figurine'] = 0.8;
        }
        // Image editing confidence
        scores.image_editing = Math.min(quality.overallScore + 0.2, 1.0);
        // Creative transform confidence
        scores.creative_transform = 0.7; // Always fairly confident
        // Game animation confidence
        scores.game_animation = faces.count > 0 ? 0.6 : 0.3;
        return scores;
    }
    /**
     * Call Gemini Vision API
     */
    async callGeminiVision(imageBase64, prompt) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                        parts: [
                            { text: prompt },
                            {
                                inline_data: {
                                    mime_type: 'image/jpeg',
                                    data: imageBase64
                                }
                            }
                        ]
                    }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 2048
                }
            })
        });
        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
        }
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
    /**
     * Parse JSON response from Gemini
     */
    parseJsonResponse(response) {
        try {
            // Extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return {};
        }
        catch (error) {
            console.error('Failed to parse JSON response:', error);
            return {};
        }
    }
    /**
     * Merge multiple analyses
     */
    mergeAnalyses(analyses) {
        if (analyses.length === 0) {
            throw new Error('No analyses to merge');
        }
        if (analyses.length === 1) {
            return analyses[0];
        }
        // Merge face analyses
        const totalFaces = analyses.reduce((sum, a) => sum + a.faces.count, 0);
        const allPositions = analyses.flatMap(a => a.faces.positions);
        // Merge objects
        const allObjects = analyses.flatMap(a => a.detectedObjects);
        // Merge categories
        const allCategories = [...new Set(analyses.flatMap(a => a.suggestedCategories))];
        // Calculate average quality
        const avgQuality = analyses.reduce((sum, a) => sum + a.quality.overallScore, 0) / analyses.length;
        const merged = analyses[0];
        merged.imageCount = analyses.length;
        merged.faces.count = totalFaces;
        merged.faces.positions = allPositions;
        merged.detectedObjects = allObjects;
        merged.suggestedCategories = allCategories;
        merged.quality.overallScore = avgQuality;
        return merged;
    }
    /**
     * Generate unique ID
     */
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.ImageAnalyzer = ImageAnalyzer;
