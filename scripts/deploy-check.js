#!/usr/bin/env node

/**
 * Pre-deployment Check Script
 * 
 * This script performs comprehensive checks before deployment to ensure
 * the application is ready for production.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const EnvironmentValidator = require('./validate-env');
const DependencyChecker = require('./check-dependencies');

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

class DeploymentChecker {
  constructor(options = {}) {
    this.options = {
      skipTests: false,
      skipLinting: false,
      skipBuild: false,
      environment: 'production',
      verbose: false,
      ...options,
    };
    
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.results = new Map();
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

  runCommand(command, options = {}) {
    try {
      if (this.options.verbose) {
        this.info(`Running: ${command}`);
      }
      
      const result = execSync(command, {
        encoding: 'utf8',
        stdio: options.silent ? 'pipe' : 'inherit',
        cwd: process.cwd(),
        ...options,
      });
      return result;
    } catch (error) {
      if (!options.silent) {
        this.error(`Command failed: ${command}`);
        if (error.stdout) this.error(`Stdout: ${error.stdout}`);
        if (error.stderr) this.error(`Stderr: ${error.stderr}`);
      }
      throw error;
    }
  }

  async runCheck(name, checkFunction) {
    console.log(`\n${colors.magenta}🔍 ${name}${colors.reset}`);
    
    try {
      const startTime = Date.now();
      const result = await checkFunction();
      const duration = Date.now() - startTime;
      
      this.results.set(name, {
        success: result,
        duration,
        timestamp: new Date(),
      });
      
      if (result) {
        this.success(`✅ ${name} passed (${duration}ms)`);
      } else {
        this.error(`❌ ${name} failed (${duration}ms)`);
      }
      
      return result;
    } catch (error) {
      this.results.set(name, {
        success: false,
        error: error.message,
        duration: 0,
        timestamp: new Date(),
      });
      
      this.error(`❌ ${name} failed: ${error.message}`);
      return false;
    }
  }

  async checkEnvironmentVariables() {
    return new Promise((resolve) => {
      try {
        const validator = new EnvironmentValidator();
        // Capture the exit code by temporarily overriding process.exit
        const originalExit = process.exit;
        let exitCode = 0;
        
        process.exit = (code) => {
          exitCode = code || 0;
        };
        
        validator.run();
        
        // Restore original process.exit
        process.exit = originalExit;
        
        resolve(exitCode === 0);
      } catch (error) {
        this.error(`Environment validation error: ${error.message}`);
        resolve(false);
      }
    });
  }

  async checkDependencies() {
    return new Promise((resolve) => {
      try {
        const checker = new DependencyChecker();
        // Similar approach as environment check
        const originalExit = process.exit;
        let exitCode = 0;
        
        process.exit = (code) => {
          exitCode = code || 0;
        };
        
        checker.run();
        
        process.exit = originalExit;
        
        resolve(exitCode === 0);
      } catch (error) {
        this.error(`Dependency check error: ${error.message}`);
        resolve(false);
      }
    });
  }

  async checkCodeQuality() {
    if (this.options.skipLinting) {
      this.info('Skipping linting (--skip-linting flag set)');
      return true;
    }

    try {
      // Type checking
      this.info('Running TypeScript type checking...');
      this.runCommand('npm run type-check');
      
      // Linting
      this.info('Running ESLint...');
      this.runCommand('npm run lint');
      
      // Code formatting check
      this.info('Checking code formatting...');
      this.runCommand('npm run format:check');
      
      this.success('Code quality checks passed');
      return true;
    } catch (error) {
      this.error('Code quality checks failed');
      return false;
    }
  }

  async checkTests() {
    if (this.options.skipTests) {
      this.info('Skipping tests (--skip-tests flag set)');
      return true;
    }

    try {
      this.info('Running test suite...');
      this.runCommand('npm test');
      
      this.success('All tests passed');
      return true;
    } catch (error) {
      this.error('Tests failed');
      return false;
    }
  }

  async checkBuild() {
    if (this.options.skipBuild) {
      this.info('Skipping build (--skip-build flag set)');
      return true;
    }

    try {
      // Clean previous build
      this.info('Cleaning previous build...');
      this.runCommand('npm run clean', { silent: true });
      
      // Build the project
      this.info('Building project...');
      this.runCommand('npm run build');
      
      // Verify build output
      const distPath = path.join(process.cwd(), 'dist');
      if (!fs.existsSync(distPath)) {
        this.error('Build output directory not found');
        return false;
      }
      
      const files = fs.readdirSync(distPath, { recursive: true });
      if (files.length === 0) {
        this.error('Build output is empty');
        return false;
      }
      
      this.success(`Build successful (${files.length} files generated)`);
      return true;
    } catch (error) {
      this.error('Build failed');
      return false;
    }
  }

  async checkNetlifyConfiguration() {
    try {
      const netlifyTomlPath = path.join(process.cwd(), 'netlify.toml');
      
      if (!fs.existsSync(netlifyTomlPath)) {
        this.error('netlify.toml configuration file not found');
        return false;
      }
      
      const netlifyConfig = fs.readFileSync(netlifyTomlPath, 'utf8');
      
      // Check for required sections
      const requiredSections = [
        '[build]',
        'functions = ',
        '[[redirects]]',
      ];
      
      const missingSections = requiredSections.filter(section => 
        !netlifyConfig.includes(section)
      );
      
      if (missingSections.length > 0) {
        this.error(`Missing required sections in netlify.toml: ${missingSections.join(', ')}`);
        return false;
      }
      
      // Check functions directory exists
      const functionsMatch = netlifyConfig.match(/functions\s*=\s*["']([^"']+)["']/);
      if (functionsMatch) {
        const functionsDir = path.join(process.cwd(), functionsMatch[1]);
        if (!fs.existsSync(functionsDir)) {
          this.error(`Functions directory not found: ${functionsMatch[1]}`);
          return false;
        }
        
        // Check for webhook function
        const webhookFunction = path.join(functionsDir, 'webhook.ts');
        if (!fs.existsSync(webhookFunction)) {
          this.error('webhook.ts function not found');
          return false;
        }
      }
      
      this.success('Netlify configuration is valid');
      return true;
    } catch (error) {
      this.error(`Netlify configuration check failed: ${error.message}`);
      return false;
    }
  }

  async checkDatabaseConnection() {
    try {
      // This is a basic check - in a real scenario, you might want to
      // test the actual database connection
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        this.error('Database configuration missing');
        return false;
      }
      
      this.info('Database configuration found');
      // TODO: Add actual connection test
      this.success('Database configuration check passed');
      return true;
    } catch (error) {
      this.error(`Database check failed: ${error.message}`);
      return false;
    }
  }

  async checkTelegramBotConfiguration() {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      
      if (!botToken) {
        this.error('Telegram bot token not found');
        return false;
      }
      
      // Basic token format validation (already done in env validation)
      this.success('Telegram bot configuration check passed');
      return true;
    } catch (error) {
      this.error(`Telegram bot check failed: ${error.message}`);
      return false;
    }
  }

  generateDeploymentSummary() {
    console.log(`\n${colors.cyan}📋 Deployment Summary${colors.reset}`);
    
    const totalChecks = this.results.size;
    const passedChecks = Array.from(this.results.values()).filter(r => r.success).length;
    const failedChecks = totalChecks - passedChecks;
    
    console.log(`\n${colors.blue}📊 Check Results:${colors.reset}`);
    
    for (const [name, result] of this.results.entries()) {
      const status = result.success ? 
        `${colors.green}✅ PASS${colors.reset}` : 
        `${colors.red}❌ FAIL${colors.reset}`;
      
      console.log(`  ${status} ${name} (${result.duration}ms)`);
      
      if (!result.success && result.error) {
        console.log(`       Error: ${result.error}`);
      }
    }
    
    console.log(`\n${colors.blue}📈 Summary:${colors.reset}`);
    console.log(`  Total checks: ${totalChecks}`);
    console.log(`  Passed: ${colors.green}${passedChecks}${colors.reset}`);
    console.log(`  Failed: ${colors.red}${failedChecks}${colors.reset}`);
    console.log(`  Warnings: ${colors.yellow}${this.warnings.length}${colors.reset}`);
    
    const isReady = failedChecks === 0;
    
    if (isReady) {
      console.log(`\n${colors.green}🚀 Ready for deployment!${colors.reset}`);
      
      if (this.warnings.length > 0) {
        console.log(`\n${colors.yellow}⚠️  Warnings to address:${colors.reset}`);
        this.warnings.forEach(warning => {
          console.log(`  - ${warning}`);
        });
      }
      
      console.log(`\n${colors.cyan}Next steps:${colors.reset}`);
      console.log(`  1. Deploy to ${this.options.environment} environment`);
      console.log(`  2. Monitor deployment logs`);
      console.log(`  3. Test deployed application`);
      console.log(`  4. Update webhook URL if needed`);
    } else {
      console.log(`\n${colors.red}❌ Not ready for deployment${colors.reset}`);
      
      console.log(`\n${colors.yellow}Issues to resolve:${colors.reset}`);
      this.errors.forEach(error => {
        console.log(`  - ${error}`);
      });
    }
    
    return isReady;
  }

  async run() {
    console.log(`${colors.cyan}🚀 Pre-deployment Check${colors.reset}`);
    console.log(`Environment: ${this.options.environment}`);
    console.log(`Started at: ${new Date().toISOString()}\n`);
    
    // Define all checks
    const checks = [
      ['Environment Variables', () => this.checkEnvironmentVariables()],
      ['Dependencies', () => this.checkDependencies()],
      ['Code Quality', () => this.checkCodeQuality()],
      ['Tests', () => this.checkTests()],
      ['Build', () => this.checkBuild()],
      ['Netlify Configuration', () => this.checkNetlifyConfiguration()],
      ['Database Configuration', () => this.checkDatabaseConnection()],
      ['Telegram Bot Configuration', () => this.checkTelegramBotConfiguration()],
    ];
    
    // Run all checks
    let allPassed = true;
    
    for (const [name, checkFunction] of checks) {
      const result = await this.runCheck(name, checkFunction);
      if (!result) {
        allPassed = false;
      }
    }
    
    // Generate summary
    const isReady = this.generateDeploymentSummary();
    
    process.exit(isReady ? 0 : 1);
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--skip-tests':
        options.skipTests = true;
        break;
      case '--skip-linting':
        options.skipLinting = true;
        break;
      case '--skip-build':
        options.skipBuild = true;
        break;
      case '--environment':
      case '--env':
        options.environment = args[++i];
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        console.log(`
Usage: node deploy-check.js [options]

Options:
  --skip-tests       Skip running tests
  --skip-linting     Skip code quality checks
  --skip-build       Skip build process
  --environment      Target environment (default: production)
  --verbose, -v      Enable verbose output
  --help, -h         Show this help message

Examples:
  node deploy-check.js
  node deploy-check.js --environment staging
  node deploy-check.js --skip-tests --verbose
        `);
        process.exit(0);
        break;
    }
  }
  
  return options;
}

// Run deployment check if this script is executed directly
if (require.main === module) {
  const options = parseArgs();
  const checker = new DeploymentChecker(options);
  checker.run().catch(error => {
    console.error(`${colors.red}Deployment check failed: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

module.exports = DeploymentChecker;