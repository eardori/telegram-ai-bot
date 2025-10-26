"use strict";
/**
 * Prompt Builder Service
 * Builds and optimizes prompts from templates
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptBuilder = void 0;
const image_edit_types_1 = require("../types/image-edit.types");
class PromptBuilder {
    /**
     * Build a prompt from template
     */
    build(template, variables, userInput) {
        let prompt = template.basePrompt;
        // Replace variables if provided
        if (variables && template.promptVariables) {
            prompt = this.replaceVariables(prompt, template.promptVariables, variables);
        }
        // Add user input if provided
        if (userInput) {
            prompt = this.integrateUserInput(prompt, userInput, template.category);
        }
        // Optimize for quality
        prompt = this.addQualityModifiers(prompt, template);
        // Optimize for target API
        prompt = this.optimize(prompt, image_edit_types_1.APIService.NANO_BANAFO);
        return prompt;
    }
    /**
     * Replace template variables
     */
    replaceVariables(prompt, templateVariables, providedVariables) {
        let result = prompt;
        templateVariables.forEach(variable => {
            const value = providedVariables[variable.key] || variable.defaultValue || '';
            const placeholder = `{${variable.key}}`;
            // Replace all occurrences
            result = result.split(placeholder).join(value);
        });
        // Remove any remaining unfilled variables
        result = result.replace(/\{[^}]+\}/g, '');
        return result;
    }
    /**
     * Integrate user input into prompt
     */
    integrateUserInput(prompt, userInput, category) {
        // Clean user input
        const cleanInput = userInput.trim();
        if (!cleanInput) {
            return prompt;
        }
        // Category-specific integration
        switch (category) {
            case 'portrait_styling':
                // Add user preferences for portrait
                if (!prompt.includes(cleanInput)) {
                    prompt += `. Additional style preferences: ${cleanInput}`;
                }
                break;
            case 'image_editing':
                // User input might specify what to edit
                if (cleanInput.toLowerCase().includes('background')) {
                    prompt = prompt.replace('new environment', cleanInput);
                }
                else if (cleanInput.toLowerCase().includes('color')) {
                    prompt += `. Color adjustment: ${cleanInput}`;
                }
                else {
                    prompt += `. User specification: ${cleanInput}`;
                }
                break;
            case '3d_figurine':
                // User might specify figurine style
                if (cleanInput.toLowerCase().includes('style') ||
                    cleanInput.toLowerCase().includes('type')) {
                    prompt = prompt.replace('realistic style', cleanInput);
                }
                else {
                    prompt += `. Style preference: ${cleanInput}`;
                }
                break;
            case 'creative_transform':
                // Creative input is more flexible
                prompt += `. Creative direction: ${cleanInput}`;
                break;
            default:
                // Generic addition
                prompt += `. ${cleanInput}`;
        }
        return prompt;
    }
    /**
     * Add quality modifiers
     */
    addQualityModifiers(prompt, template) {
        // Check if quality modifiers already exist
        const hasQualityTerms = /4K|8K|HD|high.?quality|ultra.?realistic|photorealistic|masterpiece/i.test(prompt);
        if (!hasQualityTerms) {
            // Add appropriate quality modifiers
            const qualityModifiers = this.getQualityModifiers(template.category);
            prompt += `. ${qualityModifiers}`;
        }
        // Add negative prompts if not present
        if (!prompt.includes('avoid') && !prompt.includes('not') && !prompt.includes('without')) {
            const negativePrompts = this.getNegativePrompts(template.category);
            if (negativePrompts) {
                prompt += `. Avoid: ${negativePrompts}`;
            }
        }
        return prompt;
    }
    /**
     * Get quality modifiers by category
     */
    getQualityModifiers(category) {
        const modifiers = {
            'portrait_styling': 'Ultra-realistic, 4K HD quality, professional photography, perfect lighting, sharp focus',
            '3d_figurine': 'High detail, studio lighting, photorealistic texture, professional product photography',
            'image_editing': 'Seamless integration, photorealistic result, maintain original quality',
            'creative_transform': 'Artistic quality, vibrant colors, creative composition, high resolution',
            'game_animation': 'Game-ready quality, consistent style, vibrant colors, clean design'
        };
        return modifiers[category] || 'High quality, professional result, attention to detail';
    }
    /**
     * Get negative prompts by category
     */
    getNegativePrompts(category) {
        const negatives = {
            'portrait_styling': 'blurry, distorted features, bad anatomy, low quality',
            '3d_figurine': 'broken parts, unrealistic proportions, poor quality',
            'image_editing': 'artifacts, visible seams, unnatural blending',
            'creative_transform': 'low quality, pixelated, distorted',
            'game_animation': 'inconsistent style, poor design, low resolution'
        };
        return negatives[category] || 'low quality, artifacts, distortion';
    }
    /**
     * Optimize prompt for specific API
     */
    optimize(prompt, targetAPI) {
        switch (targetAPI) {
            case image_edit_types_1.APIService.NANO_BANAFO:
                return this.optimizeForNanoBanafo(prompt);
            case image_edit_types_1.APIService.GEMINI:
                return this.optimizeForGemini(prompt);
            case image_edit_types_1.APIService.IMAGEN:
                return this.optimizeForImagen(prompt);
            default:
                return prompt;
        }
    }
    /**
     * Optimize for Nano Banafo API
     */
    optimizeForNanoBanafo(prompt) {
        // Nano Banafo specific optimizations
        let optimized = prompt;
        // Add style tags if not present
        if (!optimized.includes('[') && !optimized.includes('(')) {
            // Add emphasis to important parts
            optimized = optimized.replace(/ultra.?realistic/gi, '((ultra-realistic))');
            optimized = optimized.replace(/high.?quality/gi, '((high quality))');
            optimized = optimized.replace(/4K|8K/gi, match => `((${match}))`);
        }
        // Ensure proper formatting
        optimized = this.cleanupPrompt(optimized);
        // Length optimization (Nano Banafo has token limits)
        if (optimized.length > 1500) {
            optimized = this.truncateSmartly(optimized, 1500);
        }
        return optimized;
    }
    /**
     * Optimize for Gemini API
     */
    optimizeForGemini(prompt) {
        let optimized = prompt;
        // Gemini prefers natural language
        optimized = optimized.replace(/\(\(/g, '');
        optimized = optimized.replace(/\)\)/g, '');
        optimized = optimized.replace(/\[/g, '');
        optimized = optimized.replace(/\]/g, '');
        // Add instruction prefix
        if (!optimized.startsWith('Generate') && !optimized.startsWith('Create')) {
            optimized = 'Generate an image: ' + optimized;
        }
        return this.cleanupPrompt(optimized);
    }
    /**
     * Optimize for Imagen API
     */
    optimizeForImagen(prompt) {
        let optimized = prompt;
        // Imagen works best with clear, simple descriptions
        optimized = optimized.replace(/\(\(/g, '');
        optimized = optimized.replace(/\)\)/g, '');
        // Remove complex style modifiers
        optimized = optimized.replace(/masterpiece|trending on artstation/gi, '');
        // Ensure it starts with clear instruction
        if (!optimized.match(/^(A |An |The |Create |Generate )/i)) {
            optimized = 'A ' + optimized;
        }
        return this.cleanupPrompt(optimized);
    }
    /**
     * Clean up prompt formatting
     */
    cleanupPrompt(prompt) {
        let cleaned = prompt;
        // Remove extra spaces
        cleaned = cleaned.replace(/\s+/g, ' ');
        // Remove duplicate punctuation
        cleaned = cleaned.replace(/\.{2,}/g, '.');
        cleaned = cleaned.replace(/,{2,}/g, ',');
        // Fix spacing around punctuation
        cleaned = cleaned.replace(/\s+\./g, '.');
        cleaned = cleaned.replace(/\s+,/g, ',');
        // Trim
        cleaned = cleaned.trim();
        // Ensure ends with period
        if (!cleaned.match(/[.!?]$/)) {
            cleaned += '.';
        }
        return cleaned;
    }
    /**
     * Smart truncate to fit length limit
     */
    truncateSmartly(prompt, maxLength) {
        if (prompt.length <= maxLength) {
            return prompt;
        }
        // Try to truncate at sentence boundary
        const sentences = prompt.split(/\. /);
        let truncated = '';
        for (const sentence of sentences) {
            if (truncated.length + sentence.length + 2 <= maxLength) {
                truncated += (truncated ? '. ' : '') + sentence;
            }
            else {
                break;
            }
        }
        // If still too short, truncate at word boundary
        if (truncated.length < maxLength * 0.7) {
            truncated = prompt.substring(0, maxLength - 3) + '...';
        }
        return truncated;
    }
    /**
     * Build multiple variations of a prompt
     */
    buildVariations(template, count = 3) {
        const variations = [];
        // Base prompt
        variations.push(this.build(template));
        // Variation with different quality emphasis
        if (count > 1) {
            let variation = template.basePrompt;
            variation = this.addQualityModifiers(variation, template);
            variation = variation.replace('4K', '8K');
            variation = variation.replace('realistic', 'hyper-realistic');
            variations.push(this.cleanupPrompt(variation));
        }
        // Variation with artistic style
        if (count > 2) {
            let variation = template.basePrompt;
            variation += '. Artistic style, cinematic composition, award-winning photography';
            variations.push(this.cleanupPrompt(variation));
        }
        return variations.slice(0, count);
    }
    /**
     * Merge multiple prompts
     */
    mergePrompts(prompts) {
        if (prompts.length === 0) {
            return '';
        }
        if (prompts.length === 1) {
            return prompts[0];
        }
        // Find common elements
        const commonWords = this.findCommonWords(prompts);
        // Build merged prompt
        let merged = prompts[0];
        for (let i = 1; i < prompts.length; i++) {
            const uniqueParts = this.extractUniqueParts(prompts[i], commonWords);
            if (uniqueParts) {
                merged += `. Additionally: ${uniqueParts}`;
            }
        }
        return this.cleanupPrompt(merged);
    }
    /**
     * Find common words across prompts
     */
    findCommonWords(prompts) {
        const wordSets = prompts.map(p => new Set(p.toLowerCase().split(/\s+/)));
        // Find intersection
        let common = wordSets[0];
        for (let i = 1; i < wordSets.length; i++) {
            common = new Set([...common].filter(x => wordSets[i].has(x)));
        }
        return common;
    }
    /**
     * Extract unique parts from prompt
     */
    extractUniqueParts(prompt, commonWords) {
        const words = prompt.split(/\s+/);
        const unique = words.filter(w => !commonWords.has(w.toLowerCase()) &&
            w.length > 3);
        if (unique.length > 3) {
            return unique.join(' ');
        }
        return '';
    }
}
exports.PromptBuilder = PromptBuilder;
