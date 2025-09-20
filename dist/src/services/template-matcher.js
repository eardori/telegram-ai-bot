"use strict";
/**
 * Template Matching Service
 * Matches image analysis results with appropriate prompt templates
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateMatcher = void 0;
const supabase_1 = require("../utils/supabase");
const image_edit_types_1 = require("../types/image-edit.types");
class TemplateMatcher {
    constructor() {
        this.templates = [];
        this.lastFetchTime = 0;
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }
    /**
     * Match templates based on image analysis
     */
    async matchTemplates(analysis) {
        // Ensure templates are loaded
        await this.loadTemplates();
        // Filter compatible templates
        const compatibleTemplates = this.templates.filter(template => this.isCompatible(template, analysis));
        // Calculate scores and sort
        const scoredTemplates = compatibleTemplates.map(template => ({
            template,
            score: this.calculateScore(template, analysis)
        }));
        // Sort by score descending
        scoredTemplates.sort((a, b) => b.score - a.score);
        // Return top templates
        return scoredTemplates.map(item => item.template);
    }
    /**
     * Calculate matching score for a template
     */
    calculateScore(template, analysis) {
        let score = 0;
        const weights = {
            category: 0.25,
            faceRequirement: 0.20,
            imageCount: 0.15,
            quality: 0.15,
            priority: 0.15,
            confidence: 0.10
        };
        // Category match
        if (analysis.suggestedCategories.includes(template.category)) {
            score += weights.category;
        }
        // Face requirements
        if (template.requirements.requiresFace) {
            if (analysis.faces.count >= (template.requirements.minFaces || 1)) {
                score += weights.faceRequirement;
                // Bonus for face clarity
                if (analysis.faces.clarity === 'high') {
                    score += 0.05;
                }
            }
            else {
                // Penalty if faces required but not found
                score -= weights.faceRequirement;
            }
        }
        else {
            // Template doesn't require faces
            score += weights.faceRequirement * 0.5;
        }
        // Image count compatibility
        if (analysis.imageCount >= template.requirements.minImages &&
            analysis.imageCount <= template.requirements.maxImages) {
            score += weights.imageCount;
        }
        // Quality score
        const qualityScore = analysis.quality.overallScore;
        score += weights.quality * qualityScore;
        // Template priority
        const priorityScore = template.priority / 100;
        score += weights.priority * priorityScore;
        // Category confidence
        const categoryConfidence = analysis.confidenceScores[template.category] || 0;
        score += weights.confidence * categoryConfidence;
        // Additional scoring factors
        score += this.calculateBonusScore(template, analysis);
        // Ensure score is between 0 and 1
        return Math.max(0, Math.min(1, score));
    }
    /**
     * Check if template is compatible with analysis
     */
    isCompatible(template, analysis) {
        // Check if template is active
        if (!template.isActive) {
            return false;
        }
        // Check image count requirements
        if (analysis.imageCount < template.requirements.minImages ||
            analysis.imageCount > template.requirements.maxImages) {
            return false;
        }
        // Check face requirements
        if (template.requirements.requiresFace && analysis.faces.count === 0) {
            return false;
        }
        // Check minimum face count
        if (template.requirements.minFaces &&
            analysis.faces.count < template.requirements.minFaces) {
            return false;
        }
        // Check maximum face count
        if (template.requirements.maxFaces !== undefined &&
            analysis.faces.count > template.requirements.maxFaces) {
            return false;
        }
        return true;
    }
    /**
     * Calculate bonus score based on specific conditions
     */
    calculateBonusScore(template, analysis) {
        let bonus = 0;
        // Specific template bonuses
        switch (template.templateKey) {
            case 'figurine_commercial':
            case 'funko_pop':
                // Bonus for single clear face
                if (analysis.faces.count === 1 && analysis.faces.clarity === 'high') {
                    bonus += 0.1;
                }
                break;
            case 'multi_merge':
                // Bonus for multiple images
                if (analysis.imageCount > 1) {
                    bonus += 0.15;
                }
                break;
            case 'background_replace':
                // Bonus for outdoor scenes
                if (analysis.scene.type === 'outdoor') {
                    bonus += 0.1;
                }
                break;
            case 'night_portrait_paris':
            case 'hollywood_70s':
                // Bonus for portrait composition
                if (analysis.composition.type === 'portrait') {
                    bonus += 0.1;
                }
                break;
            case 'dramatic_bw':
            case 'bw_professional':
                // Bonus for high quality images
                if (analysis.quality.overallScore > 0.8) {
                    bonus += 0.1;
                }
                break;
            case 'outfit_swap':
            case 'clothing_change':
                // Bonus if clothing detected
                const hasClothing = analysis.detectedObjects.some(obj => obj.name.toLowerCase().includes('clothing') ||
                    obj.name.toLowerCase().includes('shirt') ||
                    obj.name.toLowerCase().includes('dress') ||
                    obj.name.toLowerCase().includes('suit'));
                if (hasClothing) {
                    bonus += 0.15;
                }
                break;
            case 'expression_change':
                // Bonus for clear face with expression
                if (analysis.faces.count === 1 &&
                    analysis.faces.expressions &&
                    analysis.faces.expressions.length > 0) {
                    bonus += 0.1;
                }
                break;
            case 'season_change':
                // Bonus for outdoor scenes
                if (analysis.scene.type === 'outdoor') {
                    bonus += 0.12;
                }
                break;
            case 'quality_enhance':
            case 'photo_restore':
                // Bonus for lower quality images (need enhancement)
                if (analysis.quality.overallScore < 0.6) {
                    bonus += 0.2;
                }
                break;
        }
        // Category-based bonuses
        switch (template.category) {
            case image_edit_types_1.PromptCategory.PORTRAIT_STYLING:
                if (analysis.faces.count === 1) {
                    bonus += 0.05;
                }
                break;
            case image_edit_types_1.PromptCategory.THREE_D_FIGURINE:
                if (analysis.faces.count === 1 && analysis.composition.type === 'portrait') {
                    bonus += 0.08;
                }
                break;
            case image_edit_types_1.PromptCategory.IMAGE_EDITING:
                // Always slightly boost editing options
                bonus += 0.03;
                break;
            case image_edit_types_1.PromptCategory.CREATIVE_TRANSFORM:
                // Boost for fun transformations
                if (analysis.faces.count > 0) {
                    bonus += 0.05;
                }
                break;
        }
        return bonus;
    }
    /**
     * Load templates from database
     */
    async loadTemplates(forceRefresh = false) {
        const now = Date.now();
        // Check cache
        if (!forceRefresh &&
            this.templates.length > 0 &&
            now - this.lastFetchTime < this.cacheTimeout) {
            return;
        }
        try {
            const { data, error } = await supabase_1.supabase
                .from('prompt_templates')
                .select('*')
                .eq('is_active', true)
                .order('priority', { ascending: false });
            if (error) {
                console.error('Failed to load templates:', error);
                // If database fails, use hardcoded templates as fallback
                this.templates = this.getHardcodedTemplates();
                return;
            }
            if (data) {
                this.templates = data.map(this.mapDatabaseTemplate);
                this.lastFetchTime = now;
                console.log(`Loaded ${this.templates.length} templates from database`);
            }
        }
        catch (error) {
            console.error('Error loading templates:', error);
            // Fallback to hardcoded templates
            this.templates = this.getHardcodedTemplates();
        }
    }
    /**
     * Map database row to PromptTemplate type
     */
    mapDatabaseTemplate(row) {
        return {
            id: row.id,
            templateKey: row.template_key,
            templateNameKo: row.template_name_ko,
            templateNameEn: row.template_name_en,
            category: row.category,
            subcategory: row.subcategory,
            basePrompt: row.base_prompt,
            examplePrompt: row.example_prompt,
            promptVariables: row.prompt_variables || [],
            requirements: {
                minImages: row.min_images || 1,
                maxImages: row.max_images || 1,
                requiresFace: row.requires_face || false,
                minFaces: row.min_faces,
                maxFaces: row.max_faces,
                imageTypes: row.image_requirements?.types,
                optimalConditions: row.optimal_conditions
            },
            priority: row.priority || 50,
            usageCount: row.usage_count || 0,
            successCount: row.success_count || 0,
            successRate: row.success_rate,
            averageProcessingTimeMs: row.average_processing_time_ms,
            isActive: row.is_active,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
        };
    }
    /**
     * Get hardcoded templates as fallback
     */
    getHardcodedTemplates() {
        // Return top 5 essential templates as fallback
        return [
            {
                id: 1,
                templateKey: 'figurine_commercial',
                templateNameKo: '🎭 피규어 만들기',
                templateNameEn: 'Commercial Figurine',
                category: image_edit_types_1.PromptCategory.THREE_D_FIGURINE,
                subcategory: 'collectible',
                basePrompt: 'Create a 1/7 scale commercialized figurine...',
                promptVariables: [],
                requirements: {
                    minImages: 1,
                    maxImages: 1,
                    requiresFace: true,
                    minFaces: 1
                },
                priority: 95,
                usageCount: 0,
                successCount: 0,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: 2,
                templateKey: 'background_replace',
                templateNameKo: '🏞️ 배경 교체',
                templateNameEn: 'Background Replace',
                category: image_edit_types_1.PromptCategory.IMAGE_EDITING,
                subcategory: 'background',
                basePrompt: 'Replace the background of the image...',
                promptVariables: [],
                requirements: {
                    minImages: 1,
                    maxImages: 1,
                    requiresFace: false
                },
                priority: 93,
                usageCount: 0,
                successCount: 0,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: 3,
                templateKey: 'red_carpet',
                templateNameKo: '🌟 레드카펫 스타일',
                templateNameEn: 'Red Carpet Portrait',
                category: image_edit_types_1.PromptCategory.PORTRAIT_STYLING,
                subcategory: 'glamour',
                basePrompt: 'Craft a moody studio portrait...',
                promptVariables: [],
                requirements: {
                    minImages: 1,
                    maxImages: 1,
                    requiresFace: true,
                    minFaces: 1
                },
                priority: 92,
                usageCount: 0,
                successCount: 0,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: 4,
                templateKey: 'multi_merge',
                templateNameKo: '🎨 다중 이미지 합성',
                templateNameEn: 'Multi-Image Merge',
                category: image_edit_types_1.PromptCategory.IMAGE_EDITING,
                subcategory: 'composite',
                basePrompt: 'Combine multiple images into a single cohesive image...',
                promptVariables: [],
                requirements: {
                    minImages: 2,
                    maxImages: 5,
                    requiresFace: false
                },
                priority: 91,
                usageCount: 0,
                successCount: 0,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: 5,
                templateKey: 'quality_enhance',
                templateNameKo: '✨ 화질 개선',
                templateNameEn: 'Quality Enhancement',
                category: image_edit_types_1.PromptCategory.IMAGE_EDITING,
                subcategory: 'enhancement',
                basePrompt: 'Enhance uploaded photo to improve overall quality...',
                promptVariables: [],
                requirements: {
                    minImages: 1,
                    maxImages: 1,
                    requiresFace: false
                },
                priority: 89,
                usageCount: 0,
                successCount: 0,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ];
    }
    /**
     * Get template by key
     */
    async getTemplateByKey(templateKey) {
        await this.loadTemplates();
        return this.templates.find(t => t.templateKey === templateKey) || null;
    }
    /**
     * Update template usage statistics
     */
    async updateTemplateStats(templateId, success, processingTimeMs) {
        try {
            // Update usage count and success rate
            const { error } = await supabase_1.supabase.rpc('update_template_stats', {
                template_id_param: templateId,
                success_param: success,
                processing_time_param: processingTimeMs
            });
            if (error) {
                console.error('Failed to update template stats:', error);
            }
        }
        catch (error) {
            console.error('Error updating template stats:', error);
        }
    }
}
exports.TemplateMatcher = TemplateMatcher;
