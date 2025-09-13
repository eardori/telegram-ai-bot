#!/usr/bin/env node

/**
 * Environment Validation Script
 * 
 * This script validates that all required environment variables are set
 * and have valid formats before deployment.
 */

const fs = require('fs');
const path = require('path');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Required environment variables with validation rules
const requiredEnvVars = {
  // Telegram Configuration
  TELEGRAM_BOT_TOKEN: {
    required: true,
    pattern: /^[0-9]{8,10}:[a-zA-Z0-9_-]{35}$/,
    description: 'Telegram bot token from BotFather',
  },
  
  // Database Configuration
  SUPABASE_URL: {
    required: true,
    pattern: /^https:\/\/[a-z0-9]+\.supabase\.co$/,
    description: 'Supabase project URL',
  },
  SUPABASE_ANON_KEY: {
    required: true,
    pattern: /^eyJ[a-zA-Z0-9_-]+$/,
    description: 'Supabase anonymous key',
  },
  
  // LLM Configuration (at least one provider required)
  OPENAI_API_KEY: {
    required: false,
    pattern: /^sk-[a-zA-Z0-9]{48}$/,
    description: 'OpenAI API key',
    group: 'llm_provider',
  },
  CLAUDE_API_KEY: {
    required: false,
    pattern: /^sk-ant-[a-zA-Z0-9_-]+$/,
    description: 'Anthropic Claude API key',
    group: 'llm_provider',
  },
  
  // Environment Settings
  NODE_ENV: {
    required: true,
    enum: ['development', 'production', 'test'],
    description: 'Node.js environment',
  },
  LOG_LEVEL: {
    required: false,
    enum: ['debug', 'info', 'warn', 'error'],
    default: 'info',
    description: 'Logging level',
  },
};

// Optional environment variables with validation
const optionalEnvVars = {
  TELEGRAM_SECRET_TOKEN: {
    pattern: /^[a-zA-Z0-9_-]{1,256}$/,
    description: 'Webhook secret token for security',
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    pattern: /^eyJ[a-zA-Z0-9_-]+$/,
    description: 'Supabase service role key (for admin operations)',
  },
  DEFAULT_SUMMARY_INTERVAL: {
    pattern: /^[1-9][0-9]*$/,
    default: '6',
    description: 'Default summary interval in hours',
  },
  MAX_SUMMARY_LENGTH: {
    pattern: /^[1-9][0-9]*$/,
    default: '2000',
    description: 'Maximum summary length in characters',
  },
  ADMIN_USER_IDS: {
    pattern: /^[0-9]+(,[0-9]+)*$/,
    description: 'Comma-separated list of admin user IDs',
  },
  RATE_LIMIT_WINDOW_MS: {
    pattern: /^[1-9][0-9]*$/,
    default: '60000',
    description: 'Rate limiting window in milliseconds',
  },
  RATE_LIMIT_MAX_REQUESTS: {
    pattern: /^[1-9][0-9]*$/,
    default: '30',
    description: 'Maximum requests per rate limit window',
  },
};

class EnvironmentValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.groupRequirements = new Map();
  }

  log(level, message) {
    const color = colors[level] || colors.reset;
    const levelText = level.toUpperCase().padEnd(7);
    console.log(`${color}[${levelText}]${colors.reset} ${message}`);
  }

  error(message) {
    this.errors.push(message);
    this.log('red', message);
  }

  warning(message) {
    this.warnings.push(message);
    this.log('yellow', message);
  }

  info(message) {
    this.info.push(message);
    this.log('blue', message);
  }

  success(message) {
    this.log('green', message);
  }

  validateEnvVar(name, config, value) {
    // Check if required
    if (config.required && (!value || value.trim() === '')) {
      this.error(`Missing required environment variable: ${name}`);
      this.error(`  Description: ${config.description}`);
      return false;
    }

    // Skip validation if value is empty and not required
    if (!value || value.trim() === '') {
      if (config.default) {
        this.info(`Using default value for ${name}: ${config.default}`);
        process.env[name] = config.default;
      }
      return true;
    }

    // Validate enum values
    if (config.enum && !config.enum.includes(value)) {
      this.error(`Invalid value for ${name}: ${value}`);
      this.error(`  Expected one of: ${config.enum.join(', ')}`);
      return false;
    }

    // Validate pattern
    if (config.pattern && !config.pattern.test(value)) {
      this.error(`Invalid format for ${name}`);
      this.error(`  Description: ${config.description}`);
      this.error(`  Pattern: ${config.pattern}`);
      return false;
    }

    // Track group requirements
    if (config.group) {
      if (!this.groupRequirements.has(config.group)) {
        this.groupRequirements.set(config.group, []);
      }
      this.groupRequirements.get(config.group).push(name);
    }

    this.success(`✓ ${name} is valid`);
    return true;
  }

  validateGroupRequirements() {
    // Validate that at least one provider in each group is set
    for (const [group, vars] of this.groupRequirements.entries()) {
      const hasAtLeastOne = vars.some(varName => {
        const value = process.env[varName];
        return value && value.trim() !== '';
      });

      if (!hasAtLeastOne) {
        this.error(`At least one variable from group '${group}' is required:`);
        vars.forEach(varName => {
          const config = requiredEnvVars[varName] || optionalEnvVars[varName];
          this.error(`  - ${varName}: ${config.description}`);
        });
      } else {
        this.success(`✓ Group '${group}' requirement satisfied`);
      }
    }
  }

  validateNetlifyConfig() {
    const netlifyConfigPath = path.join(process.cwd(), 'netlify.toml');
    
    if (!fs.existsSync(netlifyConfigPath)) {
      this.error('netlify.toml configuration file not found');
      return false;
    }

    try {
      const netlifyConfig = fs.readFileSync(netlifyConfigPath, 'utf8');
      
      // Check for functions directory
      if (!netlifyConfig.includes('[build]') || !netlifyConfig.includes('functions')) {
        this.warning('netlify.toml may be missing functions configuration');
      }

      // Check for redirects
      if (!netlifyConfig.includes('[[redirects]]')) {
        this.warning('netlify.toml may be missing redirect rules');
      }

      this.success('✓ netlify.toml configuration found');
      return true;
    } catch (error) {
      this.error(`Error reading netlify.toml: ${error.message}`);
      return false;
    }
  }

  validatePackageJson() {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      this.error('package.json not found');
      return false;
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // Check required dependencies
      const requiredDeps = [
        'grammy',
        '@netlify/functions',
        '@supabase/supabase-js',
      ];

      const missingDeps = requiredDeps.filter(dep => 
        !packageJson.dependencies?.[dep] && !packageJson.devDependencies?.[dep]
      );

      if (missingDeps.length > 0) {
        this.error(`Missing required dependencies: ${missingDeps.join(', ')}`);
        return false;
      }

      // Check Node.js engine requirement
      if (!packageJson.engines?.node) {
        this.warning('package.json should specify Node.js engine requirement');
      } else {
        this.success(`✓ Node.js engine requirement: ${packageJson.engines.node}`);
      }

      this.success('✓ package.json validation passed');
      return true;
    } catch (error) {
      this.error(`Error reading package.json: ${error.message}`);
      return false;
    }
  }

  validateBuildFiles() {
    const requiredFiles = [
      'tsconfig.json',
      '.eslintrc.json',
      '.gitignore',
    ];

    let allFilesExist = true;

    requiredFiles.forEach(file => {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        this.success(`✓ ${file} found`);
      } else {
        this.error(`Missing required file: ${file}`);
        allFilesExist = false;
      }
    });

    return allFilesExist;
  }

  run() {
    console.log(`${colors.cyan}🔍 Environment Validation${colors.reset}\n`);

    // Load environment variables from .env file if it exists
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && !process.env[key]) {
          process.env[key] = valueParts.join('=').replace(/^["']|["']$/g, '');
        }
      });
      this.info('Loaded variables from .env file');
    }

    // Validate required environment variables
    console.log(`${colors.magenta}📋 Required Environment Variables${colors.reset}`);
    Object.entries(requiredEnvVars).forEach(([name, config]) => {
      this.validateEnvVar(name, config, process.env[name]);
    });

    // Validate optional environment variables
    console.log(`\n${colors.magenta}📋 Optional Environment Variables${colors.reset}`);
    Object.entries(optionalEnvVars).forEach(([name, config]) => {
      if (process.env[name]) {
        this.validateEnvVar(name, config, process.env[name]);
      } else if (config.default) {
        this.info(`Using default value for ${name}: ${config.default}`);
        process.env[name] = config.default;
      }
    });

    // Validate group requirements
    console.log(`\n${colors.magenta}📋 Group Requirements${colors.reset}`);
    this.validateGroupRequirements();

    // Validate configuration files
    console.log(`\n${colors.magenta}📁 Configuration Files${colors.reset}`);
    this.validateNetlifyConfig();
    this.validatePackageJson();
    this.validateBuildFiles();

    // Summary
    console.log(`\n${colors.cyan}📊 Validation Summary${colors.reset}`);
    
    if (this.errors.length === 0) {
      this.success(`✅ Environment validation passed!`);
      this.success(`   - ${this.info.length} info messages`);
      this.success(`   - ${this.warnings.length} warnings`);
      process.exit(0);
    } else {
      this.error(`❌ Environment validation failed!`);
      this.error(`   - ${this.errors.length} errors`);
      this.error(`   - ${this.warnings.length} warnings`);
      this.error(`   - ${this.info.length} info messages`);
      
      console.log(`\n${colors.yellow}💡 Next steps:${colors.reset}`);
      console.log('1. Set the missing required environment variables');
      console.log('2. Fix any invalid values or formats');
      console.log('3. Review the warnings and address them if needed');
      console.log('4. Run this script again to verify');
      
      process.exit(1);
    }
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  const validator = new EnvironmentValidator();
  validator.run();
}

module.exports = EnvironmentValidator;