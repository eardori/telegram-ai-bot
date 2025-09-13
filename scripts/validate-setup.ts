#!/usr/bin/env npx ts-node

// Setup Validation Script

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface ValidationResult {
  name: string;
  passed: boolean;
  message: string;
  details?: string[];
}

class SetupValidator {
  private results: ValidationResult[] = [];
  private projectRoot: string;

  constructor() {
    this.projectRoot = process.cwd();
  }

  /**
   * Add validation result
   */
  private addResult(name: string, passed: boolean, message: string, details?: string[]): void {
    const result: ValidationResult = { name, passed, message };
    if (details) {
      result.details = details;
    }
    this.results.push(result);
  }

  /**
   * Check if file exists
   */
  private fileExists(relativePath: string): boolean {
    const fullPath = join(this.projectRoot, relativePath);
    return existsSync(fullPath);
  }

  /**
   * Read file content
   */
  private readFile(relativePath: string): string | null {
    try {
      const fullPath = join(this.projectRoot, relativePath);
      return readFileSync(fullPath, 'utf8');
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate project structure
   */
  validateProjectStructure(): void {
    console.log('🔍 Validating project structure...');

    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      'netlify.toml',
      'netlify/functions/webhook.ts',
      'src/config/index.ts',
      'src/types/index.ts',
    ];

    const requiredDirectories = [
      'netlify/functions',
      'netlify/functions/handlers',
      'netlify/functions/handlers/commands',
      'netlify/functions/utils',
      'src/config',
      'src/types',
      'sql',
    ];

    // Check required files
    const missingFiles: string[] = [];
    for (const file of requiredFiles) {
      if (!this.fileExists(file)) {
        missingFiles.push(file);
      }
    }

    if (missingFiles.length === 0) {
      this.addResult('Project Files', true, 'All required files are present');
    } else {
      this.addResult('Project Files', false, 'Missing required files', missingFiles);
    }

    // Check required directories
    const missingDirs: string[] = [];
    for (const dir of requiredDirectories) {
      if (!this.fileExists(dir)) {
        missingDirs.push(dir);
      }
    }

    if (missingDirs.length === 0) {
      this.addResult('Project Directories', true, 'All required directories are present');
    } else {
      this.addResult('Project Directories', false, 'Missing required directories', missingDirs);
    }
  }

  /**
   * Validate package.json
   */
  validatePackageJson(): void {
    console.log('📦 Validating package.json...');

    const packageJsonContent = this.readFile('package.json');
    if (!packageJsonContent) {
      this.addResult('package.json', false, 'package.json file not found');
      return;
    }

    try {
      const packageJson = JSON.parse(packageJsonContent);

      const requiredDependencies = [
        'grammy',
        '@supabase/supabase-js',
        'openai',
        '@anthropic-ai/sdk',
      ];

      const requiredDevDependencies = [
        'typescript',
        '@netlify/functions',
        '@types/node',
      ];

      const missingDeps: string[] = [];
      const missingDevDeps: string[] = [];

      for (const dep of requiredDependencies) {
        if (!packageJson.dependencies?.[dep]) {
          missingDeps.push(dep);
        }
      }

      for (const dep of requiredDevDependencies) {
        if (!packageJson.devDependencies?.[dep]) {
          missingDevDeps.push(dep);
        }
      }

      if (missingDeps.length === 0 && missingDevDeps.length === 0) {
        this.addResult('Dependencies', true, 'All required dependencies are installed');
      } else {
        const details = [
          ...missingDeps.map(dep => `Missing dependency: ${dep}`),
          ...missingDevDeps.map(dep => `Missing dev dependency: ${dep}`),
        ];
        this.addResult('Dependencies', false, 'Missing required dependencies', details);
      }

      // Check scripts
      const requiredScripts = ['build', 'dev'];
      const missingScripts: string[] = [];

      for (const script of requiredScripts) {
        if (!packageJson.scripts?.[script]) {
          missingScripts.push(script);
        }
      }

      if (missingScripts.length === 0) {
        this.addResult('NPM Scripts', true, 'All required scripts are present');
      } else {
        this.addResult('NPM Scripts', false, 'Missing required scripts', missingScripts);
      }

    } catch (error) {
      this.addResult('package.json', false, 'Invalid JSON format in package.json');
    }
  }

  /**
   * Validate TypeScript configuration
   */
  validateTypeScriptConfig(): void {
    console.log('📘 Validating TypeScript configuration...');

    const tsconfigContent = this.readFile('tsconfig.json');
    if (!tsconfigContent) {
      this.addResult('tsconfig.json', false, 'tsconfig.json file not found');
      return;
    }

    try {
      const tsconfig = JSON.parse(tsconfigContent);

      const requiredOptions = {
        'target': 'ES2020',
        'module': 'CommonJS',
        'strict': true,
        'esModuleInterop': true,
        'skipLibCheck': true,
      };

      const missingOptions: string[] = [];
      const incorrectOptions: string[] = [];

      for (const [option, expectedValue] of Object.entries(requiredOptions)) {
        const actualValue = tsconfig.compilerOptions?.[option];
        
        if (actualValue === undefined) {
          missingOptions.push(option);
        } else if (actualValue !== expectedValue && typeof expectedValue !== 'boolean') {
          incorrectOptions.push(`${option}: expected ${expectedValue}, got ${actualValue}`);
        }
      }

      if (missingOptions.length === 0 && incorrectOptions.length === 0) {
        this.addResult('TypeScript Config', true, 'TypeScript configuration is correct');
      } else {
        const details = [
          ...missingOptions.map(opt => `Missing option: ${opt}`),
          ...incorrectOptions,
        ];
        this.addResult('TypeScript Config', false, 'TypeScript configuration issues', details);
      }

    } catch (error) {
      this.addResult('tsconfig.json', false, 'Invalid JSON format in tsconfig.json');
    }
  }

  /**
   * Validate environment configuration
   */
  validateEnvironmentConfig(): void {
    console.log('🌍 Validating environment configuration...');

    const requiredEnvVars = [
      'TELEGRAM_BOT_TOKEN',
      'SUPABASE_URL',
      'LLM_MODEL',
    ];

    const optionalEnvVars = [
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_KEY',
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'TELEGRAM_WEBHOOK_URL',
    ];

    const envExampleExists = this.fileExists('.env.example');
    
    if (envExampleExists) {
      this.addResult('Environment Example', true, '.env.example file exists');
    } else {
      this.addResult('Environment Example', false, '.env.example file not found');
    }

    // Check if .env file exists (optional)
    const envExists = this.fileExists('.env');
    if (envExists) {
      this.addResult('Environment File', true, '.env file exists for local development');
    } else {
      this.addResult('Environment File', false, '.env file not found (create for local development)', [
        'Copy .env.example to .env and fill in your values',
      ]);
    }

    // Validate .env.example format
    if (envExampleExists) {
      const envExampleContent = this.readFile('.env.example');
      if (envExampleContent) {
        const lines = envExampleContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
        const envVarsInExample = lines.map(line => line.split('=')[0]).filter(Boolean);

        const missingInExample = requiredEnvVars.filter(envVar => !envVarsInExample.includes(envVar));

        if (missingInExample.length === 0) {
          this.addResult('Environment Variables', true, 'All required environment variables are documented');
        } else {
          this.addResult('Environment Variables', false, 'Missing environment variables in .env.example', missingInExample);
        }
      }
    }
  }

  /**
   * Validate handler files
   */
  validateHandlers(): void {
    console.log('⚡ Validating handler files...');

    const handlerFiles = [
      'netlify/functions/webhook.ts',
      'netlify/functions/handlers/index.ts',
      'netlify/functions/handlers/commands/start.ts',
      'netlify/functions/handlers/commands/help.ts',
      'netlify/functions/handlers/commands/summary.ts',
      'netlify/functions/handlers/commands/settings.ts',
      'netlify/functions/handlers/commands/stats.ts',
    ];

    const missingHandlers: string[] = [];

    for (const handler of handlerFiles) {
      if (!this.fileExists(handler)) {
        missingHandlers.push(handler);
      }
    }

    if (missingHandlers.length === 0) {
      this.addResult('Handler Files', true, 'All handler files are present');
    } else {
      this.addResult('Handler Files', false, 'Missing handler files', missingHandlers);
    }

    // Check webhook.ts for required exports
    const webhookContent = this.readFile('netlify/functions/webhook.ts');
    if (webhookContent) {
      const hasHandlerExport = webhookContent.includes('export const handler');
      if (hasHandlerExport) {
        this.addResult('Webhook Export', true, 'webhook.ts exports handler function');
      } else {
        this.addResult('Webhook Export', false, 'webhook.ts missing handler export');
      }
    }
  }

  /**
   * Validate utility files
   */
  validateUtilities(): void {
    console.log('🔧 Validating utility files...');

    const utilityFiles = [
      'netlify/functions/utils/database.ts',
      'netlify/functions/utils/llm.ts',
      'netlify/functions/utils/telegram.ts',
      'netlify/functions/utils/rate-limiter.ts',
    ];

    const missingUtilities: string[] = [];

    for (const utility of utilityFiles) {
      if (!this.fileExists(utility)) {
        missingUtilities.push(utility);
      }
    }

    if (missingUtilities.length === 0) {
      this.addResult('Utility Files', true, 'All utility files are present');
    } else {
      this.addResult('Utility Files', false, 'Missing utility files', missingUtilities);
    }
  }

  /**
   * Validate database schema files
   */
  validateDatabaseSchema(): void {
    console.log('🗃️ Validating database schema...');

    const schemaFiles = [
      'sql/001_initial_schema.sql',
      'sql/002_indexes.sql',
      'sql/003_rls_policies.sql',
      'sql/004_functions.sql',
    ];

    const missingSchemaFiles: string[] = [];

    for (const schemaFile of schemaFiles) {
      if (!this.fileExists(schemaFile)) {
        missingSchemaFiles.push(schemaFile);
      }
    }

    if (missingSchemaFiles.length === 0) {
      this.addResult('Database Schema', true, 'All database schema files are present');
    } else {
      this.addResult('Database Schema', false, 'Missing database schema files', missingSchemaFiles);
    }
  }

  /**
   * Validate Netlify configuration
   */
  validateNetlifyConfig(): void {
    console.log('🌐 Validating Netlify configuration...');

    const netlifyTomlContent = this.readFile('netlify.toml');
    if (!netlifyTomlContent) {
      this.addResult('Netlify Config', false, 'netlify.toml file not found');
      return;
    }

    const hasWebhookFunction = netlifyTomlContent.includes('webhook');
    const hasBuildCommand = netlifyTomlContent.includes('build') || netlifyTomlContent.includes('command');

    if (hasWebhookFunction) {
      this.addResult('Netlify Functions', true, 'Webhook function configuration found');
    } else {
      this.addResult('Netlify Functions', false, 'Webhook function configuration not found in netlify.toml');
    }

    this.addResult('Netlify Config File', true, 'netlify.toml file exists');
  }

  /**
   * Run all validations
   */
  async runValidations(): Promise<void> {
    console.log('🚀 Starting setup validation...\n');

    this.validateProjectStructure();
    this.validatePackageJson();
    this.validateTypeScriptConfig();
    this.validateEnvironmentConfig();
    this.validateHandlers();
    this.validateUtilities();
    this.validateDatabaseSchema();
    this.validateNetlifyConfig();

    this.printResults();
  }

  /**
   * Print validation results
   */
  private printResults(): void {
    console.log('\n📋 Validation Results:\n');

    const passed = this.results.filter(r => r.passed);
    const failed = this.results.filter(r => !r.passed);

    // Print passed validations
    if (passed.length > 0) {
      console.log('✅ Passed validations:');
      for (const result of passed) {
        console.log(`   ✓ ${result.name}: ${result.message}`);
      }
      console.log('');
    }

    // Print failed validations
    if (failed.length > 0) {
      console.log('❌ Failed validations:');
      for (const result of failed) {
        console.log(`   ✗ ${result.name}: ${result.message}`);
        if (result.details && result.details.length > 0) {
          for (const detail of result.details) {
            console.log(`     - ${detail}`);
          }
        }
      }
      console.log('');
    }

    // Summary
    const totalTests = this.results.length;
    const passedTests = passed.length;
    const failedTests = failed.length;

    console.log(`📊 Summary: ${passedTests}/${totalTests} validations passed`);

    if (failedTests === 0) {
      console.log('🎉 All validations passed! Your setup looks good.');
      console.log('\n📝 Next steps:');
      console.log('   1. Set up your environment variables (.env file)');
      console.log('   2. Run database migrations (check sql/README.md)');
      console.log('   3. Test your bot locally with: npm run dev');
      console.log('   4. Deploy to Netlify when ready');
    } else {
      console.log(`⚠️  ${failedTests} validation(s) failed. Please fix the issues above before proceeding.`);
      process.exit(1);
    }
  }
}

// Run the validation if this script is executed directly
if (require.main === module) {
  const validator = new SetupValidator();
  validator.runValidations().catch((error) => {
    console.error('❌ Validation failed with error:', error);
    process.exit(1);
  });
}