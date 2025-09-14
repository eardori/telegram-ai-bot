/**
 * Conversation Summarization Service
 * AI-powered chat summarization with Claude API integration and Dobby personality
 */

import { supabase } from './supabase';
import { trackingService } from './tracking-service';
import {
  ConversationSummary,
  TrackedMessage,
  TrackingSession,
  GenerateSummaryRequest,
  SummaryResponse,
  SummaryPromptContext,
  ClaudeAPIResponse,
  SummaryType,
  SummaryStatus,
  TrackingError,
  TrackingErrorCode,
  DobbyResponseTemplate
} from '../types/tracking.types';

// =============================================================================
// CONFIGURATION
// =============================================================================

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY!;
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022';

// Dobby response templates
const DOBBY_TEMPLATES: DobbyResponseTemplate = {
  tracking_started: `🧙‍♀️ **도비가 대화 추적을 시작했습니다!**

✨ 이제부터 도비가 주인님들의 중요한 대화를 기억하겠습니다!

📝 **추적 중인 내용:**
• 의미 있는 대화 내용
• 질문과 답변
• 중요한 결정사항
• 유용한 정보 공유

🏠 **"도비야, 요약해줘"** 라고 말씀하시면 언제든 요약해드리겠습니다!

⏰ 추적 시작: {{timestamp}}`,

  tracking_stopped: `🧙‍♀️ **도비가 대화 추적을 중단했습니다**

📊 **수집된 정보:**
• 총 메시지: {{message_count}}개
• 의미있는 내용: {{meaningful_count}}개  
• 참여자: {{participant_count}}명
• 추적 시간: {{duration}}분

💡 **"도비야, 요약해줘"** 라고 하시면 지금까지의 대화를 정리해드리겠습니다!

🏠 도비는 언제든 주인님을 도울 준비가 되어있습니다!`,

  tracking_already_active: `🧙‍♀️ **도비는 이미 열심히 추적하고 있습니다!**

📝 현재 {{duration}}분간 {{message_count}}개의 메시지를 수집했습니다.

💡 **명령어:**
• "도비야, 대화 추적 그만해줘" - 추적 중단
• "도비야, 요약해줘" - 지금까지 요약`,

  tracking_not_active: `🧙‍♀️ **도비는 현재 추적하고 있지 않습니다**

😔 추적 중인 대화가 없어서 요약할 내용이 없습니다.

💡 **"도비야, 대화 추적 시작해줘"** 라고 하시면 대화를 기록하기 시작하겠습니다!`,

  summary_generating: `🧙‍♀️ **도비가 열심히 요약을 만들고 있습니다...**

📚 {{message_count}}개의 메시지를 분석하고 있습니다
👥 {{participant_count}}명의 대화 내용을 정리 중입니다
⏱️ {{duration}}분간의 대화를 요약하고 있습니다

🔮 잠시만 기다려주세요... 도비의 마법이 거의 완성되었습니다!`,

  summary_completed: `🧙‍♀️ **도비의 대화 요약이 완성되었습니다!**

📋 **요약 정보:**
• 분석 기간: {{duration}}분
• 총 메시지: {{message_count}}개
• 참여자: {{participant_count}}명
• 주요 내용: {{topic_count}}개 주제

📝 **대화 요약:**
{{summary_text}}

---
✨ 도비는 주인님들의 소중한 대화를 정리해드렸습니다!
🗑️ 추적된 메시지는 이제 자동으로 정리됩니다.

🏠 더 필요한 것이 있으시면 언제든 "도비야"라고 불러주세요!`,

  summary_failed: `🧙‍♀️ **도비가 실수했습니다...**

😔 요약을 만드는 중에 문제가 발생했습니다.

❌ 오류: {{error_message}}

💡 **다시 시도해보세요:**
• "도비야, 요약해줘" - 요약 재시도
• 잠시 후 다시 시도해주세요

🏠 도비는 더 나은 서비스를 위해 노력하겠습니다!`,

  no_messages_to_summarize: `🧙‍♀️ **도비가 확인했습니다**

😔 요약할 만한 의미있는 대화 내용이 없습니다.

📝 **상황:**
• 추적된 메시지가 없거나
• 너무 짧은 내용들만 있습니다

💡 더 많은 대화가 이루어진 후 다시 요약을 요청해주세요!`,

  session_expired: `🧙‍♀️ **추적 세션이 만료되었습니다**

⏰ 오래된 추적 세션은 자동으로 정리됩니다.

💡 새로운 추적을 시작하려면:
**"도비야, 대화 추적 시작해줘"**

🏠 도비는 언제든 새로운 명령을 기다리고 있습니다!`
};

// =============================================================================
// SUMMARIZATION SERVICE CLASS
// =============================================================================

export class SummarizationService {
  
  // ---------------------------------------------------------------------------
  // MAIN SUMMARIZATION METHODS
  // ---------------------------------------------------------------------------

  /**
   * Generate summary for a user's tracking session
   */
  async generateSummary(request: GenerateSummaryRequest): Promise<SummaryResponse> {
    const startTime = Date.now();

    try {
      console.log(`📝 Generating summary for user ${request.user_id} in chat ${request.chat_id}`);

      // Get the session to summarize
      let session: TrackingSession | null = null;
      
      if (request.session_id) {
        session = await trackingService.getSession(request.session_id);
      } else {
        // Get current or most recent session
        session = await this.getCurrentOrRecentSession(request.user_id, request.chat_id);
      }

      if (!session) {
        throw new TrackingError(
          'No tracking session found to summarize',
          TrackingErrorCode.SESSION_NOT_FOUND
        );
      }

      // Get messages for the session
      const messages = await trackingService.getSessionMessages(session.id, true);
      
      if (messages.length === 0) {
        throw new TrackingError(
          'No meaningful messages found to summarize',
          TrackingErrorCode.NO_MESSAGES_TO_SUMMARIZE
        );
      }

      console.log(`📊 Found ${messages.length} messages to summarize`);

      // Create summary prompt context
      const promptContext = await this.createPromptContext(messages, request, session);

      // Generate summary using Claude
      const claudeResponse = await this.callClaudeForSummary(promptContext);

      if (!claudeResponse.success) {
        throw new TrackingError(
          claudeResponse.error_message || 'Failed to generate summary',
          TrackingErrorCode.SUMMARY_GENERATION_FAILED
        );
      }

      // Calculate processing time
      const processingTime = Date.now() - startTime;

      // Save summary to database
      const summary = await this.saveSummary({
        tracking_session_id: session.id,
        chat_id: request.chat_id,
        user_id: request.user_id,
        summary_text: claudeResponse.content!,
        summary_language: request.summary_language || 'ko',
        summary_type: SummaryType.MANUAL,
        participant_count: session.unique_participants,
        message_count: messages.length,
        meaningful_message_count: messages.length,
        conversation_start_time: new Date(messages[0].message_timestamp),
        conversation_end_time: new Date(messages[messages.length - 1].message_timestamp),
        ai_model: CLAUDE_MODEL,
        prompt_tokens: claudeResponse.prompt_tokens,
        completion_tokens: claudeResponse.completion_tokens,
        total_tokens: claudeResponse.total_tokens,
        processing_time_ms: processingTime,
        include_usernames: request.include_usernames ?? true,
        include_timestamps: request.include_timestamps ?? false,
        focus_on_decisions: request.focus_on_decisions ?? true,
        focus_on_questions: request.focus_on_questions ?? true
      });

      // Update session to mark as summarized
      await this.markSessionAsSummarized(session.id, summary.id);

      // Clean up tracked messages after summarization
      await this.cleanupSessionMessages(session.id);

      console.log(`✅ Summary generated successfully: ${summary.id}`);

      return {
        success: true,
        summary_id: summary.id,
        summary_text: summary.summary_text,
        message_count: summary.message_count,
        participant_count: summary.participant_count,
        processing_time_ms: processingTime
      };

    } catch (error) {
      console.error('❌ Error generating summary:', error);
      
      if (error instanceof TrackingError) {
        return {
          success: false,
          error_message: error.message
        };
      }

      return {
        success: false,
        error_message: 'An unexpected error occurred while generating summary'
      };
    }
  }

  // ---------------------------------------------------------------------------
  // CLAUDE API INTEGRATION
  // ---------------------------------------------------------------------------

  private async callClaudeForSummary(context: SummaryPromptContext): Promise<ClaudeAPIResponse> {
    const startTime = Date.now();

    try {
      const prompt = this.buildSummaryPrompt(context);
      
      console.log(`🤖 Calling Claude API for summary generation...`);

      const response = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 1500,
          temperature: 0.3,
          messages: [{
            role: 'user',
            content: prompt
          }]
        })
      });

      const data = await response.json() as any;
      const processingTime = Date.now() - startTime;

      if (!response.ok) {
        return {
          success: false,
          processing_time_ms: processingTime,
          error_message: data.error?.message || `API error: ${response.status}`
        };
      }

      return {
        success: true,
        content: data.content[0]?.text || '',
        prompt_tokens: data.usage?.input_tokens,
        completion_tokens: data.usage?.output_tokens,
        total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        processing_time_ms: processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('Claude API error:', error);
      
      return {
        success: false,
        processing_time_ms: processingTime,
        error_message: error instanceof Error ? error.message : 'Unknown API error'
      };
    }
  }

  // ---------------------------------------------------------------------------
  // PROMPT GENERATION
  // ---------------------------------------------------------------------------

  private buildSummaryPrompt(context: SummaryPromptContext): string {
    const {
      messages,
      chat_title,
      participant_count,
      conversation_duration,
      language,
      include_usernames,
      include_timestamps,
      focus_on_decisions,
      focus_on_questions
    } = context;

    // Build conversation text
    let conversationText = '';
    
    for (const message of messages) {
      let line = '';
      
      if (include_timestamps) {
        const timestamp = new Date(message.message_timestamp).toLocaleString('ko-KR');
        line += `[${timestamp}] `;
      }
      
      if (include_usernames && message.user_first_name) {
        line += `${message.user_first_name}: `;
      }
      
      line += message.content;
      conversationText += line + '\n';
    }

    // Base prompt in Korean for Dobby personality
    let prompt = `안녕하세요! 도비입니다. 주인님들의 소중한 대화를 요약해달라고 하셨네요!

다음은 ${participant_count}명이 ${Math.round(conversation_duration)}분 동안 나눈 대화입니다:

=== 대화 내용 ===
${conversationText}

=== 요약 지침 ===
저는 해리포터의 도비처럼 충실하고 정중하게 요약하겠습니다:

1. **주요 내용 정리**: 가장 중요한 대화 주제들을 중심으로 정리
2. **핵심 정보 추출**: 유용한 정보, 팁, 링크 등을 빠뜨리지 않고 포함`;

    if (focus_on_decisions) {
      prompt += `
3. **결정사항 강조**: 그룹에서 내린 결정이나 합의사항을 명확히 표시`;
    }

    if (focus_on_questions) {
      prompt += `
4. **질문과 답변**: 중요한 질문과 그에 대한 답변을 정리`;
    }

    prompt += `
5. **참여자 존중**: ${include_usernames ? '발언자 이름과 함께' : '익명으로'} 대화 맥락 보존
6. **도비 스타일**: 정중하고 친근하게, 하지만 핵심은 놓치지 않게

=== 요약 형식 ===
다음과 같은 형식으로 작성해주세요:

## 📋 대화 요약

### 🎯 주요 주제
- [주제 1]: [간단한 설명]
- [주제 2]: [간단한 설명]

### 💡 핵심 내용
[대화의 핵심 내용을 자연스럽게 정리]

### 📌 중요 정보
- [유용한 정보나 링크가 있다면]

### ✅ 결정사항 (있다면)
- [그룹에서 결정된 사항들]

### ❓ 미해결 질문 (있다면)
- [답변되지 않은 중요한 질문들]

---

**참고**: ${messages.length}개 메시지 중 의미있는 내용만 선별하여 요약했습니다.

도비는 주인님들의 대화를 가장 유용한 형태로 정리해드렸습니다! 🏠✨`;

    return prompt;
  }

  // ---------------------------------------------------------------------------
  // UTILITY METHODS
  // ---------------------------------------------------------------------------

  private async createPromptContext(
    messages: TrackedMessage[],
    request: GenerateSummaryRequest,
    session: TrackingSession
  ): Promise<SummaryPromptContext> {
    const startTime = new Date(messages[0].message_timestamp);
    const endTime = new Date(messages[messages.length - 1].message_timestamp);
    const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

    // Get chat title from database
    const { data: chatGroup } = await supabase
      .from('chat_groups')
      .select('chat_title')
      .eq('chat_id', request.chat_id)
      .single();

    return {
      messages,
      chat_title: chatGroup?.chat_title,
      participant_count: session.unique_participants,
      conversation_duration: duration,
      language: request.summary_language || 'ko',
      include_usernames: request.include_usernames ?? true,
      include_timestamps: request.include_timestamps ?? false,
      focus_on_decisions: request.focus_on_decisions ?? true,
      focus_on_questions: request.focus_on_questions ?? true
    };
  }

  private async getCurrentOrRecentSession(user_id: number, chat_id: number): Promise<TrackingSession | null> {
    // First try to get active session
    const { data: activeSession } = await supabase
      .from('tracking_sessions')
      .select('*')
      .eq('user_id', user_id)
      .eq('chat_id', chat_id)
      .eq('status', 'active')
      .single();

    if (activeSession) {
      return activeSession;
    }

    // If no active session, get most recent stopped session
    const { data: recentSession } = await supabase
      .from('tracking_sessions')
      .select('*')
      .eq('user_id', user_id)
      .eq('chat_id', chat_id)
      .eq('status', 'stopped')
      .order('ended_at', { ascending: false })
      .limit(1)
      .single();

    return recentSession;
  }

  private async saveSummary(data: Partial<ConversationSummary>): Promise<ConversationSummary> {
    const { data: summary, error } = await supabase
      .from('conversation_summaries')
      .insert({
        ...data,
        status: SummaryStatus.COMPLETED,
        delivered_to_user: false
      })
      .select()
      .single();

    if (error) {
      throw new TrackingError(
        'Failed to save summary',
        TrackingErrorCode.DATABASE_ERROR,
        error
      );
    }

    return summary;
  }

  private async markSessionAsSummarized(session_id: string, summary_id: string): Promise<void> {
    const { error } = await supabase
      .from('tracking_sessions')
      .update({
        status: 'summarized',
        summary_generated: true,
        summary_generated_at: new Date().toISOString(),
        summary_id: summary_id
      })
      .eq('id', session_id);

    if (error) {
      console.error('Error marking session as summarized:', error);
    }
  }

  private async cleanupSessionMessages(session_id: string): Promise<void> {
    try {
      // Keep messages for a short period before cleanup for debugging
      const { error } = await supabase
        .from('tracked_messages')
        .delete()
        .eq('tracking_session_id', session_id);

      if (error) {
        console.error('Error cleaning up session messages:', error);
      } else {
        console.log(`🗑️ Cleaned up messages for session ${session_id}`);
      }

    } catch (error) {
      console.error('Error during message cleanup:', error);
    }
  }

  // ---------------------------------------------------------------------------
  // DOBBY RESPONSE HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Get Dobby-style response for tracking status
   */
  getDobbyTrackingResponse(
    action: 'started' | 'stopped' | 'already_active' | 'not_active' | 'expired',
    context: {
      message_count?: number;
      meaningful_count?: number;
      participant_count?: number;
      duration?: number;
      timestamp?: string;
    } = {}
  ): string {
    let template = '';
    
    switch (action) {
      case 'started':
        template = DOBBY_TEMPLATES.tracking_started;
        break;
      case 'stopped':
        template = DOBBY_TEMPLATES.tracking_stopped;
        break;
      case 'already_active':
        template = DOBBY_TEMPLATES.tracking_already_active;
        break;
      case 'not_active':
        template = DOBBY_TEMPLATES.tracking_not_active;
        break;
      case 'expired':
        template = DOBBY_TEMPLATES.session_expired;
        break;
    }

    // Replace template variables
    return template
      .replace(/\{\{message_count\}\}/g, (context.message_count || 0).toString())
      .replace(/\{\{meaningful_count\}\}/g, (context.meaningful_count || 0).toString())
      .replace(/\{\{participant_count\}\}/g, (context.participant_count || 0).toString())
      .replace(/\{\{duration\}\}/g, (context.duration || 0).toString())
      .replace(/\{\{timestamp\}\}/g, context.timestamp || new Date().toLocaleString('ko-KR'));
  }

  /**
   * Get Dobby-style response for summary generation
   */
  getDobbySummaryResponse(
    stage: 'generating' | 'completed' | 'failed' | 'no_messages',
    context: {
      message_count?: number;
      participant_count?: number;
      duration?: number;
      summary_text?: string;
      topic_count?: number;
      error_message?: string;
    } = {}
  ): string {
    let template = '';
    
    switch (stage) {
      case 'generating':
        template = DOBBY_TEMPLATES.summary_generating;
        break;
      case 'completed':
        template = DOBBY_TEMPLATES.summary_completed;
        break;
      case 'failed':
        template = DOBBY_TEMPLATES.summary_failed;
        break;
      case 'no_messages':
        template = DOBBY_TEMPLATES.no_messages_to_summarize;
        break;
    }

    // Replace template variables
    return template
      .replace(/\{\{message_count\}\}/g, (context.message_count || 0).toString())
      .replace(/\{\{participant_count\}\}/g, (context.participant_count || 0).toString())
      .replace(/\{\{duration\}\}/g, (context.duration || 0).toString())
      .replace(/\{\{summary_text\}\}/g, context.summary_text || '')
      .replace(/\{\{topic_count\}\}/g, (context.topic_count || 3).toString())
      .replace(/\{\{error_message\}\}/g, context.error_message || '알 수 없는 오류');
  }

  // ---------------------------------------------------------------------------
  // BULK OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Process all sessions ready for summary (for scheduled processing)
   */
  async processReadySummaries(): Promise<{
    processed: number;
    successful: number;
    failed: number;
  }> {
    try {
      const readySessions = await trackingService.getSessionsReadyForSummary();
      let successful = 0;
      let failed = 0;

      console.log(`📋 Processing ${readySessions.length} sessions ready for summary`);

      for (const session of readySessions) {
        try {
          const result = await this.generateSummary({
            user_id: session.user_id,
            chat_id: session.chat_id,
            session_id: session.id
          });

          if (result.success) {
            successful++;
          } else {
            failed++;
          }

        } catch (error) {
          console.error(`Error processing session ${session.id}:`, error);
          failed++;
        }
      }

      console.log(`✅ Batch processing complete: ${successful} successful, ${failed} failed`);

      return {
        processed: readySessions.length,
        successful,
        failed
      };

    } catch (error) {
      console.error('Error in batch summary processing:', error);
      return { processed: 0, successful: 0, failed: 0 };
    }
  }
}

// =============================================================================
// EXPORT
// =============================================================================

export const summarizationService = new SummarizationService();