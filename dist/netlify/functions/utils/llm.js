"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLLMClient = createLLMClient;
function createLLMClient(config) {
    switch (config.provider) {
        case 'openai':
            return new OpenAIClient(config);
        case 'anthropic':
            return new AnthropicClient(config);
        case 'google':
            return new GoogleClient(config);
        case 'azure':
            return new AzureClient(config);
        case 'huggingface':
            return new HuggingFaceClient(config);
        case 'ollama':
            return new OllamaClient(config);
        default:
            throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
}
class BaseLLMClient {
    constructor(config) {
        this.config = config;
    }
    async generateSummary(request) {
        const startTime = Date.now();
        const messagesText = request.messages
            .map(msg => `${msg.author.name}: ${msg.content}`)
            .join('\n');
        const systemPrompt = this.buildSummaryPrompt(request);
        const llmRequest = {
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: messagesText },
            ],
            max_tokens: request.preferences.maxLength || 2048,
            temperature: 0.3,
        };
        const response = await this.generateResponse(llmRequest);
        const processingTimeMs = Date.now() - startTime;
        const summary = response.choices[0]?.message?.content || 'Unable to generate summary';
        return {
            summary,
            metadata: {
                messageCount: request.messages.length,
                participantCount: new Set(request.messages.map(m => m.author.id)).size,
                keyParticipants: this.extractKeyParticipants(request.messages),
                mainTopics: this.extractTopics(summary),
                sentiment: this.analyzeSentiment(summary),
                confidence: 0.8,
                processingTimeMs,
                tokenUsage: response.usage,
            },
        };
    }
    async analyzeContent(request) {
        const response = {};
        for (const analysisType of request.analysisType) {
            switch (analysisType) {
                case 'sentiment':
                    response.sentiment = await this.analyzeSentimentDetailed(request.content);
                    break;
                case 'topics':
                    response.topics = await this.extractTopicsDetailed(request.content);
                    break;
                case 'language':
                    response.language = await this.detectLanguage(request.content);
                    break;
                case 'summary':
                    response.summary = await this.generateContentSummary(request.content);
                    break;
            }
        }
        return response;
    }
    async translate(request) {
        const systemPrompt = `Translate the following text from ${request.sourceLanguage || 'auto-detect'} to ${request.targetLanguage}. Maintain the original tone and meaning. Only return the translation, no explanations.`;
        const llmRequest = {
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: request.text },
            ],
            max_tokens: Math.max(request.text.length * 2, 1024),
            temperature: 0.2,
        };
        const response = await this.generateResponse(llmRequest);
        const translatedText = response.choices[0]?.message?.content || request.text;
        return {
            translatedText,
            sourceLanguage: request.sourceLanguage || 'auto',
            targetLanguage: request.targetLanguage,
            confidence: 0.9,
        };
    }
    async answerQuestion(request) {
        const systemPrompt = `Answer the following question based on the provided context. Be concise and accurate. If the answer is not in the context, say "I don't have enough information to answer this question."`;
        const userPrompt = `Context: ${request.context}\n\nQuestion: ${request.question}`;
        const llmRequest = {
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            max_tokens: 1024,
            temperature: 0.1,
        };
        const response = await this.generateResponse(llmRequest);
        const answer = response.choices[0]?.message?.content || 'Unable to generate answer';
        return {
            answer,
            confidence: 0.8,
        };
    }
    async validateConfig() {
        try {
            const models = await this.getModels();
            return models.length > 0;
        }
        catch {
            return false;
        }
    }
    buildSummaryPrompt(request) {
        const { preferences, context } = request;
        let prompt = 'You are an AI assistant that creates concise summaries of chat conversations. ';
        switch (preferences.format) {
            case 'brief':
                prompt += 'Create a brief summary in 2-3 sentences highlighting the main points discussed.';
                break;
            case 'detailed':
                prompt += 'Create a detailed summary covering all major topics, key decisions, and important discussions.';
                break;
            case 'bullet_points':
                prompt += 'Create a summary using bullet points to organize the main topics and key points discussed.';
                break;
        }
        if (context?.chatType === 'group' || context?.chatType === 'supergroup') {
            prompt += ' Include key participants in group discussions.';
        }
        if (preferences.includeParticipants) {
            prompt += ' Mention active participants and their contributions.';
        }
        if (preferences.excludeTopics && preferences.excludeTopics.length > 0) {
            prompt += ` Avoid discussing these topics: ${preferences.excludeTopics.join(', ')}.`;
        }
        if (preferences.focusAreas && preferences.focusAreas.length > 0) {
            prompt += ` Focus on these areas: ${preferences.focusAreas.join(', ')}.`;
        }
        prompt += ` Respond in ${preferences.language}.`;
        return prompt;
    }
    extractKeyParticipants(messages) {
        const participantCounts = new Map();
        messages.forEach(msg => {
            const current = participantCounts.get(msg.author.name) || 0;
            participantCounts.set(msg.author.name, current + 1);
        });
        return Array.from(participantCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name]) => name);
    }
    extractTopics(text) {
        const words = text.toLowerCase().split(/\W+/);
        const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now']);
        const wordCounts = new Map();
        words.forEach(word => {
            if (word.length > 3 && !commonWords.has(word)) {
                wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
            }
        });
        return Array.from(wordCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([word]) => word);
    }
    analyzeSentiment(text) {
        const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'awesome', 'perfect', 'love', 'like', 'happy', 'pleased', 'satisfied'];
        const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'worst', 'hate', 'dislike', 'angry', 'frustrated', 'disappointed', 'sad', 'upset'];
        const words = text.toLowerCase().split(/\W+/);
        let positiveCount = 0;
        let negativeCount = 0;
        words.forEach(word => {
            if (positiveWords.includes(word))
                positiveCount++;
            if (negativeWords.includes(word))
                negativeCount++;
        });
        if (positiveCount > negativeCount)
            return 'positive';
        if (negativeCount > positiveCount)
            return 'negative';
        return 'neutral';
    }
    async analyzeSentimentDetailed(content) {
        return {
            score: 0.0,
            label: 'neutral',
            confidence: 0.8,
        };
    }
    async extractTopicsDetailed(content) {
        return [
            { topic: 'general', confidence: 0.8 },
        ];
    }
    async detectLanguage(content) {
        return {
            code: 'en',
            name: 'English',
            confidence: 0.9,
        };
    }
    async generateContentSummary(content) {
        const llmRequest = {
            messages: [
                {
                    role: 'system',
                    content: 'Summarize the following content in 2-3 sentences, highlighting the main points.',
                },
                { role: 'user', content },
            ],
            max_tokens: 200,
            temperature: 0.3,
        };
        const response = await this.generateResponse(llmRequest);
        return response.choices[0]?.message?.content || 'Unable to generate summary';
    }
    async makeRequest(url, options) {
        const response = await fetch(url, {
            ...options,
            timeout: this.config.timeout || 30000,
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response;
    }
}
class OpenAIClient extends BaseLLMClient {
    async generateResponse(request) {
        const response = await this.makeRequest(`${this.config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: this.config.model,
                messages: request.messages,
                max_tokens: request.max_tokens || this.config.maxTokens,
                temperature: request.temperature ?? this.config.temperature,
                top_p: request.top_p ?? this.config.topP,
                frequency_penalty: request.frequency_penalty ?? this.config.frequencyPenalty,
                presence_penalty: request.presence_penalty ?? this.config.presencePenalty,
                stop: request.stop,
                user: request.user,
            }),
        });
        return response.json();
    }
    async *generateStream(request) {
        throw new Error('Streaming not implemented for OpenAI client');
    }
    async getModels() {
        const response = await this.makeRequest(`${this.config.baseUrl}/models`, {
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
            },
        });
        const data = await response.json();
        return data.data?.map((model) => model.id) || [];
    }
}
class AnthropicClient extends BaseLLMClient {
    async generateResponse(request) {
        const prompt = this.convertMessagesToPrompt(request.messages);
        const response = await this.makeRequest(`${this.config.baseUrl}/v1/messages`, {
            method: 'POST',
            headers: {
                'x-api-key': this.config.apiKey,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: this.config.model,
                max_tokens: request.max_tokens || this.config.maxTokens,
                messages: request.messages,
                temperature: request.temperature ?? this.config.temperature,
                top_p: request.top_p ?? this.config.topP,
            }),
        });
        const data = await response.json();
        return {
            id: data.id || 'anthropic-' + Date.now(),
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: this.config.model,
            choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: data.content?.[0]?.text || '',
                    },
                    finish_reason: data.stop_reason || 'stop',
                }],
            usage: {
                prompt_tokens: data.usage?.input_tokens || 0,
                completion_tokens: data.usage?.output_tokens || 0,
                total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
            },
        };
    }
    async *generateStream(request) {
        throw new Error('Streaming not implemented for Anthropic client');
    }
    async getModels() {
        return ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'];
    }
    convertMessagesToPrompt(messages) {
        return messages
            .map(msg => `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`)
            .join('\n\n');
    }
}
class GoogleClient extends BaseLLMClient {
    async generateResponse() {
        throw new Error('Google client not implemented yet');
    }
    async *generateStream() {
        throw new Error('Google streaming not implemented yet');
    }
    async getModels() {
        return ['gemini-pro', 'gemini-pro-vision'];
    }
}
class AzureClient extends BaseLLMClient {
    async generateResponse() {
        throw new Error('Azure client not implemented yet');
    }
    async *generateStream() {
        throw new Error('Azure streaming not implemented yet');
    }
    async getModels() {
        return ['gpt-4', 'gpt-35-turbo'];
    }
}
class HuggingFaceClient extends BaseLLMClient {
    async generateResponse() {
        throw new Error('HuggingFace client not implemented yet');
    }
    async *generateStream() {
        throw new Error('HuggingFace streaming not implemented yet');
    }
    async getModels() {
        return [];
    }
}
class OllamaClient extends BaseLLMClient {
    async generateResponse() {
        throw new Error('Ollama client not implemented yet');
    }
    async *generateStream() {
        throw new Error('Ollama streaming not implemented yet');
    }
    async getModels() {
        return [];
    }
}
//# sourceMappingURL=llm.js.map