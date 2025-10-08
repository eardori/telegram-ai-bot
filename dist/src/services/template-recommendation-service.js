"use strict";
/**
 * Template Recommendation Service
 *
 * Recommends editing templates based on image analysis results
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTemplateRecommendations = getTemplateRecommendations;
exports.getPopularTemplates = getPopularTemplates;
const supabase_1 = require("../utils/supabase");
/**
 * Get template recommendations based on image analysis
 */
async function getTemplateRecommendations(analysis, limit = 5) {
    console.log('🎯 Generating template recommendations...');
    const recommendations = [];
    // Fetch all active templates
    const templates = await fetchActiveTemplates();
    if (templates.length === 0) {
        console.warn('⚠️ No templates found in database');
        return [];
    }
    // Score each template based on analysis
    for (const template of templates) {
        const score = calculateTemplateScore(template, analysis);
        if (score.confidence > 30) { // Only recommend if confidence > 30%
            recommendations.push({
                templateKey: template.template_key,
                nameKo: template.template_name_ko,
                nameEn: template.template_name_en,
                category: template.category,
                basePrompt: template.base_prompt,
                confidence: score.confidence,
                reason: score.reason,
                emoji: getCategoryEmoji(template.category)
            });
        }
    }
    // Sort by confidence (highest first)
    recommendations.sort((a, b) => b.confidence - a.confidence);
    // Apply diversity: Select top recommendations with category diversity
    const diverseRecommendations = [];
    const usedCategories = new Set();
    for (const rec of recommendations) {
        // Add if category not yet used, or if we need to fill remaining slots
        if (!usedCategories.has(rec.category) || diverseRecommendations.length >= limit - 2) {
            diverseRecommendations.push(rec);
            usedCategories.add(rec.category);
            if (diverseRecommendations.length >= limit) {
                break;
            }
        }
    }
    // If we still need more, add remaining high-confidence ones
    if (diverseRecommendations.length < limit) {
        for (const rec of recommendations) {
            if (!diverseRecommendations.includes(rec)) {
                diverseRecommendations.push(rec);
                if (diverseRecommendations.length >= limit) {
                    break;
                }
            }
        }
    }
    const topRecommendations = diverseRecommendations;
    console.log(`✅ Generated ${topRecommendations.length} recommendations`);
    topRecommendations.forEach(rec => {
        console.log(`  ${rec.emoji} ${rec.nameKo} (${rec.confidence}%) - ${rec.reason}`);
    });
    return topRecommendations;
}
/**
 * Fetch active templates from database
 */
async function fetchActiveTemplates() {
    try {
        const { data, error } = await supabase_1.supabase
            .from('prompt_templates')
            .select('*')
            .eq('is_active', true)
            .order('priority', { ascending: false });
        if (error) {
            console.error('❌ Error fetching templates:', error);
            return [];
        }
        return data;
    }
    catch (error) {
        console.error('❌ Error in fetchActiveTemplates:', error);
        return [];
    }
}
/**
 * Calculate template score based on analysis
 */
function calculateTemplateScore(template, analysis) {
    let confidence = 0;
    const reasons = [];
    // Check face requirements
    if (template.requires_face) {
        if (analysis.faces.count === 0) {
            return { confidence: 0, reason: '얼굴이 필요하지만 감지되지 않음' };
        }
        if (analysis.faces.count >= template.min_faces) {
            confidence += 30;
            reasons.push('얼굴 조건 충족');
            // Bonus for high clarity faces
            if (analysis.faces.clarity === 'high') {
                confidence += 15;
                reasons.push('선명한 얼굴');
            }
        }
    }
    // Category-specific scoring
    switch (template.category) {
        case '3d_figurine':
            // 3D figurine works best with clear single person
            if (analysis.faces.count === 1 && analysis.faces.clarity === 'high') {
                confidence += 25;
                reasons.push('피규어에 적합한 인물 사진');
            }
            if (analysis.imageType === 'portrait' || analysis.imageType === 'full_body') {
                confidence += 15;
                reasons.push('적절한 구도');
            }
            break;
        case 'portrait_styling':
            // Portrait styling needs clear face
            if (analysis.imageType === 'portrait') {
                confidence += 30;
                reasons.push('인물 사진');
            }
            if (analysis.faces.count === 1) {
                confidence += 15;
                reasons.push('단독 인물');
            }
            if (analysis.scene === 'studio' || analysis.scene === 'indoor') {
                confidence += 10;
                reasons.push('스튜디오/실내');
            }
            break;
        case 'game_animation':
            // Game/animation works with any clear person
            if (analysis.faces.count >= 1) {
                confidence += 20;
                reasons.push('캐릭터화 가능');
            }
            if (analysis.imageType === 'portrait' || analysis.imageType === 'full_body') {
                confidence += 20;
                reasons.push('적합한 구도');
            }
            break;
        case 'image_editing':
            // Editing tools are versatile
            confidence += 15;
            reasons.push('범용 편집 가능');
            // Background replacement works better outdoors
            if (template.template_key === 'background_replace' && analysis.scene === 'outdoor') {
                confidence += 20;
                reasons.push('배경 교체 적합');
            }
            // Outfit swap needs full body
            if (template.template_key === 'outfit_swap' && analysis.bodyVisible && analysis.clothingClear) {
                confidence += 25;
                reasons.push('의상 교체 적합');
            }
            break;
        case 'creative_transform':
            // Creative transforms work with most images
            confidence += 10;
            reasons.push('창의적 변환 가능');
            // Photo album works with any image
            if (template.template_key === 'photo_album_cover') {
                confidence += 15;
                reasons.push('앨범 제작 가능');
            }
            // Family polaroid needs multiple faces
            if (template.template_key === 'polaroid_family' && analysis.faces.count >= 2) {
                confidence += 30;
                reasons.push('가족 사진 적합');
            }
            break;
    }
    // Quality bonus
    if (analysis.quality === 'high') {
        confidence += 10;
        reasons.push('고품질 이미지');
    }
    // Lighting bonus
    if (analysis.lighting === 'natural' && template.category === 'portrait_styling') {
        confidence += 5;
        reasons.push('자연광');
    }
    // Cap confidence at 100
    confidence = Math.min(confidence, 100);
    const reason = reasons.join(', ') || '기본 적합성';
    return { confidence, reason };
}
/**
 * Get emoji for category
 */
function getCategoryEmoji(category) {
    const emojiMap = {
        '3d_figurine': '🎭',
        'portrait_styling': '📸',
        'game_animation': '🎮',
        'image_editing': '🛠️',
        'creative_transform': '✨'
    };
    return emojiMap[category] || '🎨';
}
/**
 * Get popular templates (fallback if analysis fails)
 */
async function getPopularTemplates(limit = 5) {
    try {
        const { data, error } = await supabase_1.supabase
            .from('prompt_templates')
            .select('*')
            .eq('is_active', true)
            .order('priority', { ascending: false })
            .limit(limit);
        if (error) {
            console.error('❌ Error fetching popular templates:', error);
            return [];
        }
        return data.map(template => ({
            templateKey: template.template_key,
            nameKo: template.template_name_ko,
            nameEn: template.template_name_en,
            category: template.category,
            basePrompt: template.base_prompt,
            confidence: 50, // Default confidence
            reason: '인기 템플릿',
            emoji: getCategoryEmoji(template.category)
        }));
    }
    catch (error) {
        console.error('❌ Error in getPopularTemplates:', error);
        return [];
    }
}
