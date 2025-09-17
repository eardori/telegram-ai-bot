"use strict";
/**
 * Large File Handler for Telegram Bot
 * Implements progressive messaging, adaptive thresholds, and performance optimization
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.performanceTracker = exports.adaptiveThreshold = exports.PerformanceTracker = exports.AdaptiveThresholdCalculator = exports.ProgressiveMessenger = exports.MESSAGES = exports.ProcessingMethod = exports.FILE_SIZE_THRESHOLDS = void 0;
// File size thresholds and processing stages
exports.FILE_SIZE_THRESHOLDS = {
    INLINE_MAX: 15 * 1024 * 1024, // 15MB - inline processing
    MEDIUM_MAX: 100 * 1024 * 1024, // 100MB - standard Files API
    LARGE_MAX: 500 * 1024 * 1024, // 500MB - optimized Files API
    PREMIUM_MAX: 2 * 1024 * 1024 * 1024 // 2GB - premium processing
};
// Processing method based on file size
var ProcessingMethod;
(function (ProcessingMethod) {
    ProcessingMethod["INLINE"] = "inline";
    ProcessingMethod["FILES_API_STANDARD"] = "files_api_standard";
    ProcessingMethod["FILES_API_OPTIMIZED"] = "files_api_optimized";
    ProcessingMethod["FILES_API_PREMIUM"] = "files_api_premium";
})(ProcessingMethod || (exports.ProcessingMethod = ProcessingMethod = {}));
// Message templates for different languages
exports.MESSAGES = {
    ko: {
        // Size detection messages
        size_detected: '📊 파일 크기 감지: {size}',
        method_selected: '🔄 최적 처리 방식: {method}',
        // Processing stages
        processing: {
            inline: {
                initial: '⚡ 빠른 처리 모드로 진행합니다...',
                updates: ['✨ 거의 완료되었습니다...']
            },
            standard: {
                initial: '📤 대용량 이미지 업로드 중... (표준 처리)',
                updates: [
                    '📊 파일 분석 중... (25%)',
                    '🔄 AI 처리 중... (60%)',
                    '✨ 최종 단계... (90%)'
                ]
            },
            optimized: {
                initial: '🚀 대용량 이미지 최적화 처리 시작!',
                updates: [
                    '📦 파일 준비 중... (10%)',
                    '☁️ 클라우드 업로드... (30%)',
                    '🧠 AI 분석 진행... (60%)',
                    '🎨 이미지 편집 중... (80%)',
                    '🎯 마무리 작업... (95%)'
                ]
            },
            premium: {
                initial: '💎 프리미엄 초대용량 처리 모드!',
                updates: [
                    '🔐 보안 업로드 시작... (5%)',
                    '📡 고속 전송 중... (20%)',
                    '🖥️ 서버 할당 완료... (35%)',
                    '🤖 AI 모델 로딩... (50%)',
                    '🎨 정밀 편집 작업... (75%)',
                    '✅ 품질 검증 중... (90%)',
                    '📦 최종 패키징... (98%)'
                ]
            }
        },
        // Success messages
        success: {
            inline: '✅ 처리 완료! (처리 시간: {time}초)',
            standard: '🎉 대용량 파일 처리 성공! ({size}, {time}초)',
            optimized: '🚀 최적화 처리 완료! ({size}, {time}초)',
            premium: '💎 프리미엄 처리 완료! ({size}, {time}초)'
        },
        // Error messages
        errors: {
            too_large: '❌ 파일이 너무 큽니다 (최대 {max})',
            upload_failed: '📤 업로드 실패. 다시 시도해주세요.',
            processing_failed: '🔧 처리 중 오류. 다른 방법으로 시도 중...',
            timeout: '⏱️ 시간 초과. 파일을 압축 후 재시도하세요.',
            retry: '🔄 재시도 중... ({attempt}/{max})'
        },
        // Tips and suggestions
        tips: {
            large_file: '💡 팁: 대용량 파일은 처리에 시간이 걸릴 수 있습니다',
            optimize: '🎯 최상의 결과를 위해 JPEG 형식을 권장합니다',
            premium: '⭐ 프리미엄으로 더 빠른 처리를 경험하세요!'
        }
    },
    en: {
        // Size detection messages
        size_detected: '📊 File size detected: {size}',
        method_selected: '🔄 Processing method: {method}',
        // Processing stages
        processing: {
            inline: {
                initial: '⚡ Fast processing mode...',
                updates: ['✨ Almost done...']
            },
            standard: {
                initial: '📤 Uploading large image... (Standard)',
                updates: [
                    '📊 Analyzing file... (25%)',
                    '🔄 AI processing... (60%)',
                    '✨ Final stage... (90%)'
                ]
            },
            optimized: {
                initial: '🚀 Large file optimized processing!',
                updates: [
                    '📦 Preparing file... (10%)',
                    '☁️ Cloud upload... (30%)',
                    '🧠 AI analysis... (60%)',
                    '🎨 Image editing... (80%)',
                    '🎯 Finalizing... (95%)'
                ]
            },
            premium: {
                initial: '💎 Premium ultra-large processing!',
                updates: [
                    '🔐 Secure upload... (5%)',
                    '📡 High-speed transfer... (20%)',
                    '🖥️ Server allocated... (35%)',
                    '🤖 Loading AI model... (50%)',
                    '🎨 Precision editing... (75%)',
                    '✅ Quality check... (90%)',
                    '📦 Final packaging... (98%)'
                ]
            }
        },
        // Success messages
        success: {
            inline: '✅ Completed! (Time: {time}s)',
            standard: '🎉 Large file processed! ({size}, {time}s)',
            optimized: '🚀 Optimized processing done! ({size}, {time}s)',
            premium: '💎 Premium processing complete! ({size}, {time}s)'
        },
        // Error messages
        errors: {
            too_large: '❌ File too large (max {max})',
            upload_failed: '📤 Upload failed. Please try again.',
            processing_failed: '🔧 Processing error. Trying alternative...',
            timeout: '⏱️ Timeout. Try compressing the file.',
            retry: '🔄 Retrying... ({attempt}/{max})'
        },
        // Tips and suggestions
        tips: {
            large_file: '💡 Tip: Large files take more time to process',
            optimize: '🎯 For best results, use JPEG format',
            premium: '⭐ Experience faster processing with Premium!'
        }
    }
};
/**
 * Progressive message updater class
 */
class ProgressiveMessenger {
    constructor(ctx, language = 'ko') {
        this.updateIntervals = [];
        this.ctx = ctx;
        this.language = language;
        this.startTime = Date.now();
        this.method = ProcessingMethod.INLINE;
    }
    /**
     * Determine processing method based on file size
     */
    determineMethod(fileSize) {
        if (fileSize <= exports.FILE_SIZE_THRESHOLDS.INLINE_MAX) {
            return ProcessingMethod.INLINE;
        }
        else if (fileSize <= exports.FILE_SIZE_THRESHOLDS.MEDIUM_MAX) {
            return ProcessingMethod.FILES_API_STANDARD;
        }
        else if (fileSize <= exports.FILE_SIZE_THRESHOLDS.LARGE_MAX) {
            return ProcessingMethod.FILES_API_OPTIMIZED;
        }
        else {
            return ProcessingMethod.FILES_API_PREMIUM;
        }
    }
    /**
     * Format file size for display
     */
    formatFileSize(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB'];
        if (bytes === 0)
            return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
    }
    /**
     * Get processing method display name
     */
    getMethodDisplayName(method) {
        const names = {
            ko: {
                [ProcessingMethod.INLINE]: '표준 처리',
                [ProcessingMethod.FILES_API_STANDARD]: '대용량 처리',
                [ProcessingMethod.FILES_API_OPTIMIZED]: '최적화 처리',
                [ProcessingMethod.FILES_API_PREMIUM]: '프리미엄 처리'
            },
            en: {
                [ProcessingMethod.INLINE]: 'Standard',
                [ProcessingMethod.FILES_API_STANDARD]: 'Large File',
                [ProcessingMethod.FILES_API_OPTIMIZED]: 'Optimized',
                [ProcessingMethod.FILES_API_PREMIUM]: 'Premium'
            }
        };
        return names[this.language][method];
    }
    /**
     * Start progressive messaging
     */
    async startProcessing(fileSize) {
        this.method = this.determineMethod(fileSize);
        const messages = exports.MESSAGES[this.language];
        const sizeFormatted = this.formatFileSize(fileSize);
        const methodName = this.getMethodDisplayName(this.method);
        // Initial message with file size and method
        const initialMessage = `${messages.size_detected.replace('{size}', sizeFormatted)}
${messages.method_selected.replace('{method}', methodName)}

${messages.processing[this.method].initial}`;
        const sentMessage = await this.ctx.reply(initialMessage);
        this.messageId = sentMessage.message_id;
        // Set up progressive updates based on method
        this.scheduleUpdates();
    }
    /**
     * Schedule progressive updates based on processing method
     */
    scheduleUpdates() {
        const messages = exports.MESSAGES[this.language].processing[this.method].updates;
        // Calculate update intervals based on method
        const intervals = this.getUpdateIntervals();
        messages.forEach((message, index) => {
            if (index < intervals.length) {
                const timeout = setTimeout(async () => {
                    await this.updateMessage(message);
                }, intervals[index] * 1000);
                this.updateIntervals.push(timeout);
            }
        });
    }
    /**
     * Get update intervals based on processing method
     */
    getUpdateIntervals() {
        switch (this.method) {
            case ProcessingMethod.INLINE:
                return [3]; // 3 seconds
            case ProcessingMethod.FILES_API_STANDARD:
                return [5, 10, 15]; // 5s, 10s, 15s
            case ProcessingMethod.FILES_API_OPTIMIZED:
                return [5, 10, 20, 30, 40]; // 5s, 10s, 20s, 30s, 40s
            case ProcessingMethod.FILES_API_PREMIUM:
                return [5, 10, 20, 35, 50, 65, 80]; // Up to 80s
            default:
                return [5];
        }
    }
    /**
     * Update the processing message
     */
    async updateMessage(content) {
        if (!this.messageId)
            return;
        const elapsedTime = Math.round((Date.now() - this.startTime) / 1000);
        const timeDisplay = `⏱️ ${elapsedTime}s`;
        try {
            await this.ctx.api.editMessageText(this.ctx.chat.id, this.messageId, `${content}\n\n${timeDisplay}`);
        }
        catch (error) {
            console.error('Failed to update message:', error);
        }
    }
    /**
     * Complete processing with success message
     */
    async completeProcessing(fileSize) {
        this.clearIntervals();
        const messages = exports.MESSAGES[this.language];
        const elapsedTime = Math.round((Date.now() - this.startTime) / 1000);
        const sizeFormatted = this.formatFileSize(fileSize);
        const successMessage = messages.success[this.method]
            .replace('{size}', sizeFormatted)
            .replace('{time}', elapsedTime.toString());
        if (this.messageId) {
            try {
                await this.ctx.api.editMessageText(this.ctx.chat.id, this.messageId, successMessage);
            }
            catch (error) {
                console.error('Failed to update success message:', error);
            }
        }
    }
    /**
     * Handle processing error
     */
    async handleError(error, fileSize) {
        this.clearIntervals();
        const messages = exports.MESSAGES[this.language];
        const sizeFormatted = this.formatFileSize(fileSize);
        let errorMessage = messages.errors.processing_failed;
        // Specific error handling
        if (error.message.includes('timeout')) {
            errorMessage = messages.errors.timeout;
        }
        else if (error.message.includes('upload')) {
            errorMessage = messages.errors.upload_failed;
        }
        else if (fileSize > exports.FILE_SIZE_THRESHOLDS.PREMIUM_MAX) {
            errorMessage = messages.errors.too_large
                .replace('{max}', this.formatFileSize(exports.FILE_SIZE_THRESHOLDS.PREMIUM_MAX));
        }
        if (this.messageId) {
            try {
                await this.ctx.api.editMessageText(this.ctx.chat.id, this.messageId, `${errorMessage}\n\n📊 ${sizeFormatted}`);
            }
            catch (updateError) {
                console.error('Failed to update error message:', updateError);
            }
        }
    }
    /**
     * Clear all scheduled intervals
     */
    clearIntervals() {
        this.updateIntervals.forEach(interval => clearTimeout(interval));
        this.updateIntervals = [];
    }
    /**
     * Cleanup method
     */
    cleanup() {
        this.clearIntervals();
    }
}
exports.ProgressiveMessenger = ProgressiveMessenger;
/**
 * Adaptive threshold calculator
 */
class AdaptiveThresholdCalculator {
    constructor() {
        this.baseThreshold = exports.FILE_SIZE_THRESHOLDS.INLINE_MAX;
        this.recentProcessingTimes = [];
        this.recentFailureRate = 0;
        this.maxHistorySize = 100;
    }
    /**
     * Calculate adaptive threshold based on various factors
     */
    calculateThreshold(userId, isPremium = false) {
        const timeOfDayFactor = this.getTimeOfDayFactor();
        const userTierFactor = isPremium ? 2.0 : 1.0;
        const performanceFactor = this.getPerformanceFactor();
        const failureFactor = this.getFailureFactor();
        const adaptiveThreshold = Math.round(this.baseThreshold *
            timeOfDayFactor *
            userTierFactor *
            performanceFactor *
            failureFactor);
        // Ensure threshold is within reasonable bounds
        const minThreshold = 5 * 1024 * 1024; // 5MB minimum
        const maxThreshold = isPremium
            ? exports.FILE_SIZE_THRESHOLDS.MEDIUM_MAX
            : exports.FILE_SIZE_THRESHOLDS.INLINE_MAX * 2;
        return Math.max(minThreshold, Math.min(adaptiveThreshold, maxThreshold));
    }
    /**
     * Get time of day factor (lower during peak hours)
     */
    getTimeOfDayFactor() {
        const hour = new Date().getHours();
        // Peak hours (9-11 AM, 7-10 PM KST)
        if ((hour >= 9 && hour <= 11) || (hour >= 19 && hour <= 22)) {
            return 0.7; // Lower threshold during peak
        }
        // Off-peak hours (2-6 AM)
        if (hour >= 2 && hour <= 6) {
            return 1.5; // Higher threshold during off-peak
        }
        return 1.0; // Normal hours
    }
    /**
     * Get performance factor based on recent processing times
     */
    getPerformanceFactor() {
        if (this.recentProcessingTimes.length < 10) {
            return 1.0; // Not enough data
        }
        const avgProcessingTime = this.recentProcessingTimes.reduce((a, b) => a + b, 0) /
            this.recentProcessingTimes.length;
        // If average processing time is high, lower the threshold
        if (avgProcessingTime > 30000) { // > 30 seconds
            return 0.8;
        }
        else if (avgProcessingTime < 10000) { // < 10 seconds
            return 1.2;
        }
        return 1.0;
    }
    /**
     * Get failure factor based on recent failure rate
     */
    getFailureFactor() {
        if (this.recentFailureRate > 0.2) { // >20% failure rate
            return 0.7; // Significantly lower threshold
        }
        else if (this.recentFailureRate > 0.1) { // >10% failure rate
            return 0.85;
        }
        else if (this.recentFailureRate < 0.02) { // <2% failure rate
            return 1.1; // Can handle slightly more
        }
        return 1.0;
    }
    /**
     * Record processing result for adaptation
     */
    recordProcessingResult(processingTime, success) {
        // Update processing times
        this.recentProcessingTimes.push(processingTime);
        if (this.recentProcessingTimes.length > this.maxHistorySize) {
            this.recentProcessingTimes.shift();
        }
        // Update failure rate (simple moving average)
        const alpha = 0.1; // Smoothing factor
        const currentFailure = success ? 0 : 1;
        this.recentFailureRate =
            alpha * currentFailure + (1 - alpha) * this.recentFailureRate;
    }
    /**
     * Get current statistics
     */
    getStatistics() {
        const avgProcessingTime = this.recentProcessingTimes.length > 0
            ? this.recentProcessingTimes.reduce((a, b) => a + b, 0) / this.recentProcessingTimes.length
            : 0;
        return {
            currentThreshold: this.baseThreshold,
            avgProcessingTime,
            failureRate: this.recentFailureRate,
            samplesCollected: this.recentProcessingTimes.length
        };
    }
}
exports.AdaptiveThresholdCalculator = AdaptiveThresholdCalculator;
/**
 * Performance metrics tracker
 */
class PerformanceTracker {
    constructor() {
        this.metrics = new Map();
    }
    /**
     * Track image processing event
     */
    trackImageProcessing(data) {
        const timestamp = new Date().toISOString();
        // Store in metrics map (in production, send to analytics service)
        const key = `process_${timestamp}_${data.userId}`;
        this.metrics.set(key, {
            ...data,
            timestamp
        });
        // Log for debugging
        console.log('📊 Performance metric:', {
            ...data,
            timestamp
        });
        // Clean old metrics (keep last 1000)
        if (this.metrics.size > 1000) {
            const oldestKey = this.metrics.keys().next().value;
            this.metrics.delete(oldestKey);
        }
    }
    /**
     * Get performance summary
     */
    getSummary(timeWindowMinutes = 60) {
        const cutoffTime = Date.now() - (timeWindowMinutes * 60 * 1000);
        const recentMetrics = Array.from(this.metrics.values()).filter(m => new Date(m.timestamp).getTime() > cutoffTime);
        if (recentMetrics.length === 0) {
            return {
                totalProcessed: 0,
                successRate: 0,
                avgProcessingTime: 0,
                costPerImage: 0,
                methodDistribution: {
                    [ProcessingMethod.INLINE]: 0,
                    [ProcessingMethod.FILES_API_STANDARD]: 0,
                    [ProcessingMethod.FILES_API_OPTIMIZED]: 0,
                    [ProcessingMethod.FILES_API_PREMIUM]: 0
                }
            };
        }
        const successful = recentMetrics.filter(m => m.success).length;
        const totalProcessingTime = recentMetrics.reduce((sum, m) => sum + m.processingTime, 0);
        const totalCost = recentMetrics.reduce((sum, m) => sum + m.cost, 0);
        const methodDistribution = recentMetrics.reduce((acc, m) => {
            acc[m.method] = (acc[m.method] || 0) + 1;
            return acc;
        }, {});
        return {
            totalProcessed: recentMetrics.length,
            successRate: successful / recentMetrics.length,
            avgProcessingTime: totalProcessingTime / recentMetrics.length,
            costPerImage: totalCost / recentMetrics.length,
            methodDistribution
        };
    }
}
exports.PerformanceTracker = PerformanceTracker;
// Export singleton instances
exports.adaptiveThreshold = new AdaptiveThresholdCalculator();
exports.performanceTracker = new PerformanceTracker();
