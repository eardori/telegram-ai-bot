/**
 * Suggestion Engine Service
 * Generates personalized edit suggestions based on image analysis and user history
 */

import { supabase } from '../utils/supabase';
import { TemplateMatcher } from './template-matcher';
import {
  ImageAnalysis,
  EditSuggestion,
  EditResult,
  ISuggestionEngine,
  PromptTemplate,
  PromptCategory
} from '../types/image-edit.types';

export class SuggestionEngine implements ISuggestionEngine {
  private templateMatcher: TemplateMatcher;
  private maxSuggestions: number = 5;

  constructor() {
    this.templateMatcher = new TemplateMatcher();
  }

  /**
   * Generate edit suggestions
   */
  async generateSuggestions(
    analysis: ImageAnalysis,
    userHistory?: EditResult[],
    maxSuggestions: number = 5
  ): Promise<EditSuggestion[]> {
    this.maxSuggestions = maxSuggestions;

    // Get matched templates
    const matchedTemplates = await this.templateMatcher.matchTemplates(analysis);

    // Score and rank templates
    const rankedTemplates = await this.rankTemplates(
      matchedTemplates,
      analysis,
      userHistory
    );

    // Convert to suggestions
    const suggestions = this.templatesToSuggestions(
      rankedTemplates.slice(0, this.maxSuggestions),
      analysis
    );

    // Add diversity if needed
    const diverseSuggestions = this.ensureDiversity(suggestions, matchedTemplates, analysis);

    return diverseSuggestions;
  }

  /**
   * Rank templates based on multiple factors
   */
  private async rankTemplates(
    templates: PromptTemplate[],
    analysis: ImageAnalysis,
    userHistory?: EditResult[]
  ): Promise<PromptTemplate[]> {
    // Calculate composite scores
    let scoredTemplates = templates.map(template => ({
      template,
      score: this.calculateCompositeScore(template, analysis, userHistory)
    }));

    // Apply special prioritization based on image count
    scoredTemplates = this.applyImageCountPrioritization(scoredTemplates, analysis);

    // Sort by score descending
    scoredTemplates.sort((a, b) => b.score - a.score);

    return scoredTemplates.map(item => item.template);
  }

  /**
   * Apply prioritization based on image count
   */
  private applyImageCountPrioritization(
    scoredTemplates: Array<{ template: PromptTemplate; score: number }>,
    analysis: ImageAnalysis
  ): Array<{ template: PromptTemplate; score: number }> {
    if (analysis.imageCount === 1) {
      // Single image priorities
      const singleImageBoosts: Record<string, number> = {
        'figurine_commercial': 30,
        'portrait_styling_redcarpet': 25,
        'quality_enhance': 20,
        'vintage_portrait': 15,
        'black_white_dramatic': 15,
        'portrait_styling_paris': 10,
        'yarn_doll': 10
      };

      return scoredTemplates.map(item => ({
        ...item,
        score: item.score + (singleImageBoosts[item.template.templateKey] || 0)
      }));
    } else {
      // Multiple images priorities
      const multiImageBoosts: Record<string, number> = {
        'multi_image_composite': 35,
        'outfit_swap': 30,
        'background_replace': 25,
        'album_9_photos': 20,
        'sticker_photo_9': 20,
        'polaroid_couple_family': 15,
        'expression_change': 10
      };

      return scoredTemplates.map(item => ({
        ...item,
        score: item.score + (multiImageBoosts[item.template.templateKey] || 0)
      }));
    }
  }

  /**
   * Calculate composite score including user preferences
   */
  private calculateCompositeScore(
    template: PromptTemplate,
    analysis: ImageAnalysis,
    userHistory?: EditResult[]
  ): number {
    // Base score from template matcher
    const baseScore = this.templateMatcher.calculateScore(template, analysis);

    // User preference score
    const preferenceScore = this.calculatePreferenceScore(template, userHistory);

    // Novelty score (prefer templates user hasn't tried)
    const noveltyScore = this.calculateNoveltyScore(template, userHistory);

    // Trending score (based on recent popularity)
    const trendingScore = this.calculateTrendingScore(template);

    // Weighted combination
    const weights = {
      base: 0.5,
      preference: 0.2,
      novelty: 0.15,
      trending: 0.15
    };

    const compositeScore =
      weights.base * baseScore +
      weights.preference * preferenceScore +
      weights.novelty * noveltyScore +
      weights.trending * trendingScore;

    return compositeScore;
  }

  /**
   * Calculate user preference score
   */
  private calculatePreferenceScore(
    template: PromptTemplate,
    userHistory?: EditResult[]
  ): number {
    if (!userHistory || userHistory.length === 0) {
      return 0.5; // Neutral score for new users
    }

    let score = 0;

    // Check category preference
    const categoryUses = userHistory.filter(h =>
      h.templateKey === template.templateKey
    );

    if (categoryUses.length > 0) {
      // Calculate average rating for this template
      const ratings = categoryUses
        .filter(h => h.userRating)
        .map(h => h.userRating!);

      if (ratings.length > 0) {
        const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
        score = avgRating / 5; // Convert to 0-1 scale
      } else {
        score = 0.6; // Slightly positive if used before
      }
    }

    // Check similar category preference
    const sameCategoryUses = userHistory.filter(h => {
      // Find template category (would need to look up from template)
      return h.templateKey.includes(template.category);
    });

    if (sameCategoryUses.length > 0 && categoryUses.length === 0) {
      score = 0.4; // Some interest in category
    }

    return score;
  }

  /**
   * Calculate novelty score
   */
  private calculateNoveltyScore(
    template: PromptTemplate,
    userHistory?: EditResult[]
  ): number {
    if (!userHistory || userHistory.length === 0) {
      return 0.8; // High novelty for new users
    }

    // Check if template was used recently
    const recentUses = userHistory.filter(h => {
      const daysSinceUse = (Date.now() - h.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      return h.templateKey === template.templateKey && daysSinceUse < 7;
    });

    if (recentUses.length > 0) {
      return 0.2; // Low novelty if used recently
    }

    // Check if template was ever used
    const anyUse = userHistory.some(h => h.templateKey === template.templateKey);
    if (!anyUse) {
      return 1.0; // Maximum novelty for never-used templates
    }

    return 0.5; // Medium novelty for old uses
  }

  /**
   * Calculate trending score
   */
  private calculateTrendingScore(template: PromptTemplate): number {
    // Simple trending based on success rate and usage
    const successWeight = template.successRate ? template.successRate / 100 : 0.5;
    const usageWeight = Math.min(template.usageCount / 1000, 1);

    return (successWeight * 0.7 + usageWeight * 0.3);
  }

  /**
   * Convert templates to suggestions
   */
  private templatesToSuggestions(
    templates: PromptTemplate[],
    analysis: ImageAnalysis
  ): EditSuggestion[] {
    return templates.map((template, index) => {
      const suggestion: EditSuggestion = {
        templateId: template.id,
        templateKey: template.templateKey,
        displayName: template.templateNameKo,
        description: this.generateDescription(template, analysis),
        confidence: this.templateMatcher.calculateScore(template, analysis),
        priority: template.priority,
        requiredImages: template.requirements.minImages,
        estimatedTime: this.estimateProcessingTime(template),
        estimatedCost: this.estimateCost(template)
      };

      // Add example image if available
      suggestion.exampleImage = this.getExampleImage(template);

      return suggestion;
    });
  }

  /**
   * Generate user-friendly description
   */
  private generateDescription(template: PromptTemplate, analysis: ImageAnalysis): string {
    let description = '';

    // Category-specific descriptions
    switch (template.category) {
      case PromptCategory.PORTRAIT_STYLING:
        description = `인물 사진을 ${template.subcategory || '특별한'} 스타일로 변환합니다`;
        break;

      case PromptCategory.THREE_D_FIGURINE:
        description = '사진을 3D 피규어나 장난감 스타일로 변환합니다';
        break;

      case PromptCategory.IMAGE_EDITING:
        description = '이미지를 편집하거나 개선합니다';
        break;

      case PromptCategory.CREATIVE_TRANSFORM:
        description = '창의적이고 재미있는 변환을 적용합니다';
        break;

      case PromptCategory.GAME_ANIMATION:
        description = '게임이나 애니메이션 스타일로 변환합니다';
        break;

      default:
        description = '이미지를 변환합니다';
    }

    // Add specific features
    if (template.requirements.requiresFace) {
      description += '. 얼굴이 잘 보이는 사진에 최적화되어 있습니다';
    }

    if (template.requirements.minImages > 1) {
      description += `. ${template.requirements.minImages}장 이상의 이미지가 필요합니다`;
    }

    return description;
  }

  /**
   * Estimate processing time
   */
  private estimateProcessingTime(template: PromptTemplate): number {
    // Use historical average if available
    if (template.averageProcessingTimeMs) {
      return Math.round(template.averageProcessingTimeMs / 1000);
    }

    // Estimate based on category
    switch (template.category) {
      case PromptCategory.THREE_D_FIGURINE:
        return 15; // seconds

      case PromptCategory.PORTRAIT_STYLING:
        return 10;

      case PromptCategory.IMAGE_EDITING:
        return 8;

      case PromptCategory.CREATIVE_TRANSFORM:
        return 12;

      case PromptCategory.GAME_ANIMATION:
        return 15;

      default:
        return 10;
    }
  }

  /**
   * Estimate cost
   */
  private estimateCost(template: PromptTemplate): number {
    // Simplified cost estimation
    const baseCost = 0.002; // $0.002 per image

    // Add complexity multiplier
    let multiplier = 1;

    switch (template.category) {
      case PromptCategory.THREE_D_FIGURINE:
        multiplier = 1.5;
        break;

      case PromptCategory.PORTRAIT_STYLING:
        multiplier = 1.2;
        break;

      case PromptCategory.IMAGE_EDITING:
        multiplier = 1.0;
        break;

      case PromptCategory.CREATIVE_TRANSFORM:
        multiplier = 1.3;
        break;

      case PromptCategory.GAME_ANIMATION:
        multiplier = 1.4;
        break;
    }

    return baseCost * multiplier;
  }

  /**
   * Get example image URL
   */
  private getExampleImage(template: PromptTemplate): string | undefined {
    // In production, these would be stored in a CDN
    const exampleImages: Record<string, string> = {
      'figurine_commercial': '/examples/figurine.jpg',
      'red_carpet': '/examples/red_carpet.jpg',
      'background_replace': '/examples/background.jpg',
      'multi_merge': '/examples/merge.jpg',
      'quality_enhance': '/examples/enhance.jpg'
    };

    return exampleImages[template.templateKey];
  }

  /**
   * Ensure diversity in suggestions
   */
  private ensureDiversity(
    suggestions: EditSuggestion[],
    allTemplates: PromptTemplate[],
    analysis: ImageAnalysis
  ): EditSuggestion[] {
    // Check category diversity
    const categories = new Set(suggestions.map(s => {
      const template = allTemplates.find(t => t.templateKey === s.templateKey);
      return template?.category;
    }));

    // If all suggestions are from same category, add diversity
    if (categories.size === 1 && suggestions.length >= 3) {
      // Find templates from different categories
      const differentCategoryTemplates = allTemplates.filter(t => {
        const existingCategory = Array.from(categories)[0];
        return t.category !== existingCategory;
      });

      if (differentCategoryTemplates.length > 0) {
        // Replace the lowest confidence suggestion
        const lowestIndex = suggestions.length - 1;
        const diverseTemplate = differentCategoryTemplates[0];

        suggestions[lowestIndex] = {
          templateId: diverseTemplate.id,
          templateKey: diverseTemplate.templateKey,
          displayName: diverseTemplate.templateNameKo,
          description: this.generateDescription(diverseTemplate, analysis),
          confidence: this.templateMatcher.calculateScore(diverseTemplate, analysis),
          priority: diverseTemplate.priority,
          requiredImages: diverseTemplate.requirements.minImages,
          estimatedTime: this.estimateProcessingTime(diverseTemplate),
          estimatedCost: this.estimateCost(diverseTemplate),
          exampleImage: this.getExampleImage(diverseTemplate)
        };
      }
    }

    // Ensure at least one easy/quick option
    const hasQuickOption = suggestions.some(s => s.estimatedTime && s.estimatedTime <= 8);
    if (!hasQuickOption && suggestions.length >= 2) {
      // Find a quick template
      const quickTemplates = allTemplates.filter(t =>
        t.category === PromptCategory.IMAGE_EDITING &&
        this.estimateProcessingTime(t) <= 8
      );

      if (quickTemplates.length > 0) {
        const quickTemplate = quickTemplates[0];
        // Add as last suggestion
        suggestions[suggestions.length - 1] = {
          templateId: quickTemplate.id,
          templateKey: quickTemplate.templateKey,
          displayName: quickTemplate.templateNameKo,
          description: '빠른 편집 옵션',
          confidence: 0.7,
          priority: quickTemplate.priority,
          requiredImages: quickTemplate.requirements.minImages,
          estimatedTime: this.estimateProcessingTime(quickTemplate),
          estimatedCost: this.estimateCost(quickTemplate),
          exampleImage: this.getExampleImage(quickTemplate)
        };
      }
    }

    return suggestions;
  }

  /**
   * Get user's favorite templates
   */
  async getUserFavorites(userId: number, limit: number = 3): Promise<PromptTemplate[]> {
    try {
      const { data, error } = await supabase
        .from('edit_history')
        .select('template_id, user_rating')
        .eq('user_id', userId)
        .gte('user_rating', 4)
        .order('user_rating', { ascending: false })
        .limit(limit);

      if (error || !data) {
        return [];
      }

      const templateIds = [...new Set(data.map(d => d.template_id))];
      const templates = await Promise.all(
        templateIds.map(id => this.templateMatcher.getTemplateByKey(String(id)))
      );

      return templates.filter(t => t !== null) as PromptTemplate[];
    } catch (error) {
      console.error('Failed to get user favorites:', error);
      return [];
    }
  }
}