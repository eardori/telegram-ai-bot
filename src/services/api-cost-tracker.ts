/**
 * API Cost Tracking Service
 *
 * Tracks Gemini API usage and calculates costs
 *
 * Pricing (as of 2025):
 * - Gemini 2.0 Flash Exp (Text): Free during preview
 * - Gemini 2.5 Flash Image Preview:
 *   - Input: $0.00001875 per image (up to 3.75M pixels)
 *   - Output: $0.000075 per image (up to 3.75M pixels)
 */

import { supabase } from '../utils/supabase';

export interface APIUsageLog {
  user_id: number;
  chat_id?: number;
  operation: 'image_analysis' | 'image_edit' | 'text_generation' | 'nsfw_image_gen';
  model: string;
  input_tokens?: number;
  output_tokens?: number;
  input_images?: number;
  output_images?: number;
  estimated_cost: number;
  template_key?: string;
  session_id?: string;
  processing_time_ms?: number;
  success?: boolean;
  error_message?: string;
}

/**
 * Gemini API Pricing
 */
const PRICING = {
  // Gemini 2.5 Flash Image Preview
  'gemini-2.5-flash-image-preview': {
    input_image: 0.00001875,  // $0.00001875 per image
    output_image: 0.000075     // $0.000075 per image
  },

  // Gemini 2.0 Flash Exp (Text) - Free during preview
  'gemini-2.0-flash-exp': {
    input_token: 0,
    output_token: 0
  }
};

/**
 * Log API usage and calculate cost
 */
export async function logAPIUsage(log: APIUsageLog): Promise<number> {
  try {
    const cost = calculateCost(log);

    const { error } = await supabase
      .from('api_usage_logs')
      .insert({
        user_id: log.user_id,
        chat_id: log.chat_id,
        operation: log.operation,
        model: log.model,
        input_tokens: log.input_tokens || 0,
        output_tokens: log.output_tokens || 0,
        input_images: log.input_images || 0,
        output_images: log.output_images || 0,
        estimated_cost: cost,
        template_key: log.template_key,
        session_id: log.session_id,
        processing_time_ms: log.processing_time_ms,
        success: log.success !== false,
        error_message: log.error_message
      });

    if (error) {
      console.error('❌ Failed to log API usage:', error);
      // Don't throw - logging failure shouldn't break the main flow
    } else {
      console.log(`💰 API usage logged: ${log.operation} - $${cost.toFixed(6)}`);
    }

    return cost;
  } catch (error) {
    console.error('❌ Error in logAPIUsage:', error);
    return 0;
  }
}

/**
 * Calculate estimated cost based on usage
 */
function calculateCost(log: APIUsageLog): number {
  const pricing = PRICING[log.model as keyof typeof PRICING];

  if (!pricing) {
    console.warn(`⚠️ Unknown model for pricing: ${log.model}`);
    return 0;
  }

  let cost = 0;

  // Image-based pricing
  if ('input_image' in pricing && 'output_image' in pricing) {
    cost += (log.input_images || 0) * pricing.input_image;
    cost += (log.output_images || 0) * pricing.output_image;
  }

  // Token-based pricing
  if ('input_token' in pricing && 'output_token' in pricing) {
    cost += (log.input_tokens || 0) * pricing.input_token;
    cost += (log.output_tokens || 0) * pricing.output_token;
  }

  return cost;
}

/**
 * Get user's total API cost
 */
export async function getUserTotalCost(userId: number): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('user_api_usage')
      .select('total_cost')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('❌ Error fetching user cost:', error);
      return 0;
    }

    return data?.total_cost || 0;
  } catch (error) {
    console.error('❌ Error in getUserTotalCost:', error);
    return 0;
  }
}

/**
 * Get daily cost summary
 */
export async function getDailyCostSummary(days: number = 7): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('api_daily_costs')
      .select('*')
      .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('date', { ascending: false });

    if (error) {
      console.error('❌ Error fetching daily costs:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Error in getDailyCostSummary:', error);
    return [];
  }
}

/**
 * Get total costs for a time period
 */
export async function getTotalCosts(startDate?: Date, endDate?: Date): Promise<{
  total_cost: number;
  total_calls: number;
  total_images_processed: number;
}> {
  try {
    let query = supabase
      .from('api_usage_logs')
      .select('estimated_cost, input_images, output_images');

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Error fetching total costs:', error);
      return { total_cost: 0, total_calls: 0, total_images_processed: 0 };
    }

    const total_cost = data.reduce((sum, log) => sum + (log.estimated_cost || 0), 0);
    const total_calls = data.length;
    const total_images_processed = data.reduce(
      (sum, log) => sum + (log.input_images || 0) + (log.output_images || 0),
      0
    );

    return { total_cost, total_calls, total_images_processed };
  } catch (error) {
    console.error('❌ Error in getTotalCosts:', error);
    return { total_cost: 0, total_calls: 0, total_images_processed: 0 };
  }
}
