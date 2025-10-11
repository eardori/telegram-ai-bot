/**
 * Admin Prompt Manager Service
 * Manage, edit, and monitor prompt templates
 */

import { supabase } from '../utils/supabase';
import { InlineKeyboard } from 'grammy';

// =============================================================================
// Types
// =============================================================================

export interface PromptTemplate {
  template_key: string;
  template_name_ko: string;
  template_name_en: string;
  category: string;
  subcategory: string;
  base_prompt: string;
  template_type: 'fixed' | 'parameterized';
  min_images: number;
  max_images: number;
  requires_face: boolean;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PromptListItem {
  template_key: string;
  template_name_ko: string;
  category: string;
  priority: number;
  is_active: boolean;
  usage_count: number;
  last_used: string | null;
}

export interface PromptStats {
  template_key: string;
  usage_count: number;
  success_count: number;
  failure_count: number;
  success_rate: number;
  avg_processing_time: number;
  last_used: string | null;
}

// =============================================================================
// List Prompts
// =============================================================================

/**
 * Get list of prompts, optionally filtered by category
 */
export async function getPromptList(category?: string): Promise<PromptListItem[]> {
  try {
    let query = supabase
      .from('prompt_templates')
      .select(`
        template_key,
        template_name_ko,
        category,
        priority,
        is_active
      `)
      .order('priority', { ascending: false })
      .order('template_name_ko', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    const { data: templates, error } = await query;

    if (error) throw error;

    // Get usage stats for each template
    const templateKeys = templates?.map(t => t.template_key) || [];

    const { data: usageData } = await supabase
      .from('credit_transactions')
      .select('related_template_key, created_at')
      .eq('transaction_type', 'usage')
      .in('related_template_key', templateKeys);

    // Calculate usage count and last used
    const usageMap = new Map<string, { count: number; last_used: string | null }>();

    usageData?.forEach(u => {
      const key = u.related_template_key;
      if (!key) return;

      const existing = usageMap.get(key) || { count: 0, last_used: null };
      existing.count++;

      if (!existing.last_used || u.created_at > existing.last_used) {
        existing.last_used = u.created_at;
      }

      usageMap.set(key, existing);
    });

    return templates?.map(t => ({
      template_key: t.template_key,
      template_name_ko: t.template_name_ko,
      category: t.category,
      priority: t.priority,
      is_active: t.is_active,
      usage_count: usageMap.get(t.template_key)?.count || 0,
      last_used: usageMap.get(t.template_key)?.last_used || null
    })) || [];

  } catch (error) {
    console.error('❌ Error getting prompt list:', error);
    throw error;
  }
}

/**
 * Get detailed prompt information
 */
export async function getPromptDetail(templateKey: string): Promise<PromptTemplate | null> {
  try {
    const { data, error } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('template_key', templateKey)
      .single();

    if (error) throw error;
    return data;

  } catch (error) {
    console.error('❌ Error getting prompt detail:', error);
    return null;
  }
}

/**
 * Get prompt usage statistics
 */
export async function getPromptStats(templateKey: string): Promise<PromptStats | null> {
  try {
    // Get all usage transactions
    const { data: usageData, error: usageError } = await supabase
      .from('credit_transactions')
      .select('created_at')
      .eq('transaction_type', 'usage')
      .eq('related_template_key', templateKey);

    if (usageError) throw usageError;

    const usage_count = usageData?.length || 0;

    // Get edit results for success/failure stats
    const { data: resultsData, error: resultsError } = await supabase
      .from('image_edit_results')
      .select('status, processing_time')
      .eq('template_key', templateKey);

    if (resultsError) throw resultsError;

    const success_count = resultsData?.filter(r => r.status === 'completed').length || 0;
    const failure_count = resultsData?.filter(r => r.status === 'failed').length || 0;
    const success_rate = usage_count > 0 ? (success_count / usage_count) * 100 : 0;

    const avg_processing_time = resultsData && resultsData.length > 0
      ? resultsData.reduce((sum, r) => sum + (r.processing_time || 0), 0) / resultsData.length
      : 0;

    const last_used = usageData && usageData.length > 0
      ? usageData.sort((a, b) => b.created_at.localeCompare(a.created_at))[0].created_at
      : null;

    return {
      template_key: templateKey,
      usage_count,
      success_count,
      failure_count,
      success_rate,
      avg_processing_time,
      last_used
    };

  } catch (error) {
    console.error('❌ Error getting prompt stats:', error);
    return null;
  }
}

// =============================================================================
// Edit Prompts
// =============================================================================

/**
 * Update prompt template
 */
export async function updatePrompt(
  templateKey: string,
  updates: Partial<PromptTemplate>
): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase
      .from('prompt_templates')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('template_key', templateKey);

    if (error) throw error;

    console.log(`✅ Prompt updated: ${templateKey}`);
    return {
      success: true,
      message: `프롬프트가 성공적으로 업데이트되었습니다.`
    };

  } catch (error) {
    console.error('❌ Error updating prompt:', error);
    return {
      success: false,
      message: `업데이트 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Toggle prompt active status
 */
export async function togglePromptStatus(
  templateKey: string
): Promise<{ success: boolean; is_active: boolean; message: string }> {
  try {
    // Get current status
    const { data: current } = await supabase
      .from('prompt_templates')
      .select('is_active')
      .eq('template_key', templateKey)
      .single();

    if (!current) {
      return {
        success: false,
        is_active: false,
        message: '프롬프트를 찾을 수 없습니다.'
      };
    }

    const newStatus = !current.is_active;

    // Update status
    const { error } = await supabase
      .from('prompt_templates')
      .update({
        is_active: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('template_key', templateKey);

    if (error) throw error;

    console.log(`✅ Prompt status toggled: ${templateKey} → ${newStatus ? 'active' : 'inactive'}`);
    return {
      success: true,
      is_active: newStatus,
      message: `프롬프트가 ${newStatus ? '활성화' : '비활성화'}되었습니다.`
    };

  } catch (error) {
    console.error('❌ Error toggling prompt status:', error);
    return {
      success: false,
      is_active: false,
      message: `상태 변경 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Update prompt priority
 */
export async function updatePromptPriority(
  templateKey: string,
  priority: number
): Promise<{ success: boolean; message: string }> {
  try {
    if (priority < 0 || priority > 100) {
      return {
        success: false,
        message: '우선순위는 0-100 사이여야 합니다.'
      };
    }

    const { error } = await supabase
      .from('prompt_templates')
      .update({
        priority,
        updated_at: new Date().toISOString()
      })
      .eq('template_key', templateKey);

    if (error) throw error;

    console.log(`✅ Prompt priority updated: ${templateKey} → ${priority}`);
    return {
      success: true,
      message: `우선순위가 ${priority}로 변경되었습니다.`
    };

  } catch (error) {
    console.error('❌ Error updating prompt priority:', error);
    return {
      success: false,
      message: `우선순위 변경 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Delete prompt template
 */
export async function deletePrompt(
  templateKey: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Check if prompt has been used
    const { count } = await supabase
      .from('credit_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('transaction_type', 'usage')
      .eq('related_template_key', templateKey);

    if (count && count > 0) {
      return {
        success: false,
        message: `이 프롬프트는 ${count}번 사용되었습니다. 삭제 대신 비활성화를 권장합니다.`
      };
    }

    // Delete parameters and options first (cascade should handle this, but being explicit)
    await supabase
      .from('template_parameters')
      .delete()
      .eq('template_key', templateKey);

    // Delete template
    const { error } = await supabase
      .from('prompt_templates')
      .delete()
      .eq('template_key', templateKey);

    if (error) throw error;

    console.log(`✅ Prompt deleted: ${templateKey}`);
    return {
      success: true,
      message: '프롬프트가 성공적으로 삭제되었습니다.'
    };

  } catch (error) {
    console.error('❌ Error deleting prompt:', error);
    return {
      success: false,
      message: `삭제 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// =============================================================================
// UI Formatting
// =============================================================================

/**
 * Format prompt list message
 */
export function formatPromptList(prompts: PromptListItem[], category?: string): string {
  const categoryName = category ? getCategoryName(category) : '전체';

  let message = `📝 **프롬프트 목록 - ${categoryName}**\n\n`;
  message += `총 ${prompts.length}개의 템플릿\n\n`;

  if (prompts.length === 0) {
    message += '등록된 프롬프트가 없습니다.';
    return message;
  }

  // Group by category if showing all
  if (!category) {
    const byCategory = new Map<string, PromptListItem[]>();
    prompts.forEach(p => {
      const list = byCategory.get(p.category) || [];
      list.push(p);
      byCategory.set(p.category, list);
    });

    byCategory.forEach((list, cat) => {
      message += `**${getCategoryName(cat)}** (${list.length}개)\n`;
      list.slice(0, 5).forEach(p => {
        const status = p.is_active ? '✅' : '❌';
        message += `${status} \`${p.template_key}\` - ${p.template_name_ko}\n`;
        message += `   우선순위: ${p.priority} | 사용: ${p.usage_count}회\n`;
      });
      if (list.length > 5) {
        message += `   ... 외 ${list.length - 5}개\n`;
      }
      message += `\n`;
    });
  } else {
    // Show detailed list for single category
    prompts.forEach((p, idx) => {
      const status = p.is_active ? '✅' : '❌';
      const lastUsed = p.last_used ? formatRelativeTime(new Date(p.last_used)) : '사용 안 됨';

      message += `${idx + 1}. ${status} **${p.template_name_ko}**\n`;
      message += `   • Key: \`${p.template_key}\`\n`;
      message += `   • 우선순위: ${p.priority} | 사용: ${p.usage_count}회\n`;
      message += `   • 마지막 사용: ${lastUsed}\n\n`;
    });
  }

  return message;
}

/**
 * Format prompt detail message
 */
export function formatPromptDetail(prompt: PromptTemplate, stats?: PromptStats): string {
  let message = `📋 **프롬프트 상세 정보**\n\n`;

  message += `**기본 정보:**\n`;
  message += `• Template Key: \`${prompt.template_key}\`\n`;
  message += `• 이름 (한글): ${prompt.template_name_ko}\n`;
  message += `• 이름 (영문): ${prompt.template_name_en}\n`;
  message += `• 카테고리: ${getCategoryName(prompt.category)}\n`;
  message += `• 서브카테고리: ${prompt.subcategory}\n`;
  message += `• 타입: ${prompt.template_type === 'parameterized' ? '파라미터형' : '고정형'}\n`;
  message += `• 상태: ${prompt.is_active ? '✅ 활성' : '❌ 비활성'}\n`;
  message += `• 우선순위: ${prompt.priority}/100\n\n`;

  message += `**이미지 요구사항:**\n`;
  message += `• 최소 이미지: ${prompt.min_images}장\n`;
  message += `• 최대 이미지: ${prompt.max_images}장\n`;
  message += `• 얼굴 필요: ${prompt.requires_face ? '예' : '아니오'}\n\n`;

  message += `**프롬프트 내용:**\n`;
  message += `\`\`\`\n${prompt.base_prompt.substring(0, 300)}${prompt.base_prompt.length > 300 ? '...' : ''}\n\`\`\`\n\n`;

  if (stats) {
    message += `**사용 통계:**\n`;
    message += `• 총 사용: ${stats.usage_count}회\n`;
    message += `• 성공: ${stats.success_count}회 (${stats.success_rate.toFixed(1)}%)\n`;
    message += `• 실패: ${stats.failure_count}회\n`;
    message += `• 평균 처리 시간: ${stats.avg_processing_time.toFixed(1)}초\n`;
    message += `• 마지막 사용: ${stats.last_used ? formatRelativeTime(new Date(stats.last_used)) : '사용 안 됨'}\n\n`;
  }

  message += `**생성 정보:**\n`;
  message += `• 생성일: ${formatDate(new Date(prompt.created_at))}\n`;
  message += `• 수정일: ${formatDate(new Date(prompt.updated_at))}\n`;

  return message;
}

/**
 * Create keyboard for prompt detail
 */
export function createPromptDetailKeyboard(templateKey: string, isActive: boolean): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  keyboard
    .text(isActive ? '❌ 비활성화' : '✅ 활성화', `toggle_prompt:${templateKey}`)
    .text('📊 통계', `stats_prompt:${templateKey}`)
    .row()
    .text('✏️ 이름 변경', `edit_name:${templateKey}`)
    .text('🔢 우선순위', `edit_priority:${templateKey}`)
    .row()
    .text('📝 프롬프트 수정', `edit_prompt:${templateKey}`)
    .row()
    .text('🗑️ 삭제', `delete_prompt:${templateKey}`)
    .row()
    .text('◀️ 목록으로', 'prompt_list');

  return keyboard;
}

/**
 * Create keyboard for category selection
 */
export function createCategoryKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  keyboard
    .text('🎨 전체', 'list_prompts:all')
    .row()
    .text('🗿 3D 피규어', 'list_prompts:3d_figurine')
    .text('👔 포트레이트', 'list_prompts:portrait_styling')
    .row()
    .text('✂️ 이미지 편집', 'list_prompts:image_editing')
    .text('🎮 게임/애니', 'list_prompts:game_animation')
    .row()
    .text('🎭 크리에이티브', 'list_prompts:creative_transform');

  return keyboard;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getCategoryName(category: string): string {
  const names: Record<string, string> = {
    '3d_figurine': '🗿 3D 피규어',
    'portrait_styling': '👔 포트레이트 스타일링',
    'image_editing': '✂️ 이미지 편집',
    'game_animation': '🎮 게임/애니메이션',
    'creative_transform': '🎭 크리에이티브 변환'
  };
  return names[category] || category;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return '방금 전';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}일 전`;

  return formatDate(date);
}
