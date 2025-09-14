/**
 * Admin Utilities for Prompt Management
 * Useful functions for managing prompts programmatically
 */

import { supabase } from './supabase';
import { 
  Prompt, 
  CreatePromptRequest, 
  UpdatePromptRequest,
  PromptType,
  PromptStatus 
} from '../types/prompt.types';

/**
 * Bulk create prompts from JSON configuration
 */
export async function bulkCreatePrompts(prompts: CreatePromptRequest[]): Promise<Prompt[]> {
  try {
    const { data, error } = await supabase
      .from('prompts')
      .insert(prompts.map(p => ({
        key: p.key,
        name: p.name,
        type: p.type,
        template: p.template,
        description: p.description,
        max_tokens: p.maxTokens || 2000,
        temperature: p.temperature || 0.7,
        variables: p.variables || {},
        status: p.status || 'active',
        created_by: p.createdBy || 'admin'
      })))
      .select();

    if (error) {
      throw new Error(`Bulk create error: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('❌ Error bulk creating prompts:', error);
    throw error;
  }
}

/**
 * Export all prompts to JSON
 */
export async function exportPrompts(includeInactive: boolean = false): Promise<Prompt[]> {
  try {
    let query = supabase.from('prompts').select('*');
    
    if (!includeInactive) {
      query = query.eq('status', 'active');
    }
    
    const { data, error } = await query.order('type').order('key');
    
    if (error) {
      throw new Error(`Export error: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('❌ Error exporting prompts:', error);
    throw error;
  }
}

/**
 * Get prompt usage statistics
 */
export async function getPromptStats(days: number = 7): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('prompt_usage')
      .select(`
        *,
        prompts (
          key,
          name,
          type
        )
      `)
      .gte('used_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

    if (error) {
      throw new Error(`Stats error: ${error.message}`);
    }

    // Process statistics
    const stats: { [key: string]: any } = {};
    
    (data || []).forEach((usage: any) => {
      const key = usage.prompts?.key || 'unknown';
      if (!stats[key]) {
        stats[key] = {
          key,
          name: usage.prompts?.name || 'Unknown',
          type: usage.prompts?.type || 'unknown',
          totalUsage: 0,
          successfulUsage: 0,
          totalResponseTime: 0,
          totalTokens: 0,
          errors: []
        };
      }

      stats[key].totalUsage++;
      if (usage.success) {
        stats[key].successfulUsage++;
      } else {
        stats[key].errors.push(usage.error_message);
      }
      
      if (usage.response_time_ms) {
        stats[key].totalResponseTime += usage.response_time_ms;
      }
      
      if (usage.tokens_used) {
        stats[key].totalTokens += usage.tokens_used;
      }
    });

    // Calculate averages
    return Object.values(stats).map((stat: any) => ({
      ...stat,
      successRate: stat.totalUsage > 0 ? (stat.successfulUsage / stat.totalUsage * 100).toFixed(1) : '0',
      avgResponseTime: stat.totalUsage > 0 ? Math.round(stat.totalResponseTime / stat.totalUsage) : 0,
      avgTokens: stat.totalUsage > 0 ? Math.round(stat.totalTokens / stat.totalUsage) : 0,
      uniqueErrors: [...new Set(stat.errors)]
    }));
  } catch (error) {
    console.error('❌ Error getting prompt stats:', error);
    throw error;
  }
}

/**
 * Clean up old usage data
 */
export async function cleanupOldUsageData(olderThanDays: number = 30): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('prompt_usage')
      .delete()
      .lt('used_at', cutoffDate)
      .select('id');

    if (error) {
      throw new Error(`Cleanup error: ${error.message}`);
    }

    const deletedCount = data?.length || 0;
    console.log(`🧹 Cleaned up ${deletedCount} old usage records`);
    
    return deletedCount;
  } catch (error) {
    console.error('❌ Error cleaning up usage data:', error);
    throw error;
  }
}

/**
 * Duplicate prompt with new key
 */
export async function duplicatePrompt(sourceKey: string, newKey: string, newName?: string): Promise<Prompt> {
  try {
    // Get source prompt
    const { data: sourcePrompt, error: fetchError } = await supabase
      .from('prompts')
      .select('*')
      .eq('key', sourceKey)
      .single();

    if (fetchError || !sourcePrompt) {
      throw new Error(`Source prompt not found: ${sourceKey}`);
    }

    // Create duplicate
    const { data, error } = await supabase
      .from('prompts')
      .insert([{
        key: newKey,
        name: newName || `${sourcePrompt.name} (Copy)`,
        type: sourcePrompt.type,
        template: sourcePrompt.template,
        description: sourcePrompt.description,
        max_tokens: sourcePrompt.max_tokens,
        temperature: sourcePrompt.temperature,
        variables: sourcePrompt.variables,
        status: 'inactive' // Start as inactive for review
      }])
      .select()
      .single();

    if (error) {
      throw new Error(`Duplicate error: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error(`❌ Error duplicating prompt ${sourceKey}:`, error);
    throw error;
  }
}

/**
 * Batch update prompts
 */
export async function batchUpdatePrompts(updates: Array<{ key: string; update: UpdatePromptRequest }>): Promise<void> {
  try {
    const promises = updates.map(({ key, update }) => 
      supabase
        .from('prompts')
        .update({
          name: update.name,
          template: update.template,
          description: update.description,
          max_tokens: update.maxTokens,
          temperature: update.temperature,
          variables: update.variables,
          status: update.status
        })
        .eq('key', key)
    );

    const results = await Promise.allSettled(promises);
    
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length > 0) {
      console.warn(`⚠️ ${failures.length} batch updates failed`);
    }

    console.log(`✅ Batch updated ${results.length - failures.length}/${results.length} prompts`);
  } catch (error) {
    console.error('❌ Error in batch update:', error);
    throw error;
  }
}

/**
 * Find prompts by text search
 */
export async function searchPrompts(searchTerm: string, searchIn: string[] = ['name', 'template', 'description']): Promise<Prompt[]> {
  try {
    let query = supabase.from('prompts').select('*');

    // Build search conditions
    if (searchIn.includes('name')) {
      query = query.or(`name.ilike.%${searchTerm}%`);
    }
    if (searchIn.includes('template')) {
      query = query.or(`template.ilike.%${searchTerm}%`);
    }
    if (searchIn.includes('description')) {
      query = query.or(`description.ilike.%${searchTerm}%`);
    }

    const { data, error } = await query.order('updated_at', { ascending: false });

    if (error) {
      throw new Error(`Search error: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error(`❌ Error searching prompts for "${searchTerm}":`, error);
    throw error;
  }
}

/**
 * Validate prompt template
 */
export function validatePromptTemplate(template: string, variables: any = {}): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Find all variables in template
    const templateVars = template.match(/\{([^}]+)\}/g) || [];
    const templateVarNames = templateVars.map(v => v.slice(1, -1)); // Remove { and }
    
    const providedVarNames = Object.keys(variables);

    // Check for undefined variables
    templateVarNames.forEach(varName => {
      if (!providedVarNames.includes(varName)) {
        warnings.push(`Template variable '${varName}' not defined in variables object`);
      }
    });

    // Check for unused variables
    providedVarNames.forEach(varName => {
      if (!templateVarNames.includes(varName)) {
        warnings.push(`Variable '${varName}' defined but not used in template`);
      }
    });

    // Check template syntax
    if (template.includes('{') && !template.includes('}')) {
      errors.push('Template has opening brace { without closing brace }');
    }
    if (template.includes('}') && !template.includes('{')) {
      errors.push('Template has closing brace } without opening brace {');
    }

    // Check for nested braces
    if (template.includes('{{') || template.includes('}}')) {
      warnings.push('Template contains nested braces which may cause issues');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  } catch (error) {
    errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { valid: false, errors, warnings };
  }
}

/**
 * Generate prompt usage report
 */
export async function generateUsageReport(days: number = 7): Promise<string> {
  try {
    const stats = await getPromptStats(days);
    
    let report = `# Prompt Usage Report (Last ${days} days)\n\n`;
    report += `Generated: ${new Date().toISOString()}\n\n`;
    
    if (stats.length === 0) {
      report += `No prompt usage data found for the last ${days} days.\n`;
      return report;
    }

    // Summary
    const totalUsage = stats.reduce((sum, stat) => sum + stat.totalUsage, 0);
    const avgSuccessRate = (stats.reduce((sum, stat) => sum + parseFloat(stat.successRate), 0) / stats.length).toFixed(1);
    
    report += `## Summary\n`;
    report += `- Total Prompts Used: ${stats.length}\n`;
    report += `- Total API Calls: ${totalUsage}\n`;
    report += `- Average Success Rate: ${avgSuccessRate}%\n\n`;

    // Top performers
    const topPrompts = stats.sort((a, b) => b.totalUsage - a.totalUsage).slice(0, 10);
    report += `## Top 10 Most Used Prompts\n\n`;
    report += `| Rank | Key | Type | Usage | Success Rate | Avg Response Time |\n`;
    report += `|------|-----|------|-------|--------------|-------------------|\n`;
    
    topPrompts.forEach((stat, index) => {
      report += `| ${index + 1} | ${stat.key} | ${stat.type} | ${stat.totalUsage} | ${stat.successRate}% | ${stat.avgResponseTime}ms |\n`;
    });

    // Error analysis
    const errorPrompts = stats.filter(stat => parseFloat(stat.successRate) < 100);
    if (errorPrompts.length > 0) {
      report += `\n## Prompts with Errors\n\n`;
      errorPrompts.forEach(stat => {
        report += `### ${stat.key}\n`;
        report += `- Success Rate: ${stat.successRate}%\n`;
        report += `- Total Usage: ${stat.totalUsage}\n`;
        report += `- Unique Errors: ${stat.uniqueErrors.length}\n`;
        if (stat.uniqueErrors.length > 0) {
          report += `- Error Messages:\n`;
          stat.uniqueErrors.forEach((error: string) => {
            report += `  - ${error}\n`;
          });
        }
        report += `\n`;
      });
    }

    return report;
  } catch (error) {
    console.error('❌ Error generating usage report:', error);
    throw error;
  }
}