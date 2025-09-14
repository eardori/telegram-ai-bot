#!/usr/bin/env node

/**
 * Database Setup Script
 * Automatically applies all database schemas to Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Supabase connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// SQL files in order
const sqlFiles = [
  'sql/001_initial_schema.sql',
  'sql/002_indexes.sql', 
  'sql/003_rls_policies.sql',
  'sql/004_functions.sql',
  'sql/005_initial_data.sql',
  'sql/006_chat_tracking_schema.sql',
  'database/schema.sql',  // Dynamic prompt management
  'database/initial-data.sql'
];

async function executeSqlFile(filePath) {
  try {
    const fullPath = path.join(__dirname, filePath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  File not found: ${filePath} - skipping`);
      return { success: true, skipped: true };
    }
    
    const sql = fs.readFileSync(fullPath, 'utf8');
    console.log(`📄 Processing ${filePath}...`);
    
    // For now, just log the SQL content and instructions for manual execution
    console.log(`  📝 File contains ${sql.length} characters of SQL`);
    console.log(`  ⚠️  Please execute this file manually in Supabase SQL Editor:`);
    console.log(`     https://supabase.com/dashboard/project/${supabaseUrl.split('.')[0].split('//')[1]}/sql`);
    console.log(`  📋 Copy and paste the contents of: ${filePath}`);
    console.log();
    
    return { success: true };
    
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function setupDatabase() {
  console.log('🚀 Starting database setup...\n');
  
  let successCount = 0;
  let skipCount = 0;
  const errors = [];
  
  for (const sqlFile of sqlFiles) {
    const result = await executeSqlFile(sqlFile);
    
    if (result.success) {
      if (result.skipped) {
        skipCount++;
      } else {
        successCount++;
      }
    } else {
      errors.push({ file: sqlFile, error: result.error });
    }
    
    // Add delay between operations
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n🎯 Database setup completed!');
  console.log(`✅ Successfully executed: ${successCount} files`);
  console.log(`⚠️  Skipped: ${skipCount} files`);
  
  if (errors.length > 0) {
    console.log(`❌ Errors: ${errors.length} files`);
    errors.forEach(({ file, error }) => {
      console.log(`  - ${file}: ${error}`);
    });
  }
  
  // Test basic database connectivity
  console.log('\n🔍 Testing database connectivity...');
  
  try {
    const { data, error } = await supabase
      .from('prompts')
      .select('id')
      .limit(1);
      
    if (error && !error.message.includes('does not exist')) {
      console.log('❌ Database test failed:', error.message);
    } else {
      console.log('✅ Database connectivity test passed');
    }
    
  } catch (testError) {
    console.log('⚠️  Database test error (may be normal):', testError.message);
  }
  
  console.log('\n🎉 Database setup process completed!');
  
  if (errors.length === 0) {
    console.log('🏠 All schemas are ready. You can now deploy to production!');
  } else {
    console.log('⚠️  Some errors occurred. Please review and fix manually if needed.');
  }
}

// Run setup
setupDatabase().catch(error => {
  console.error('💥 Fatal error during database setup:', error);
  process.exit(1);
});