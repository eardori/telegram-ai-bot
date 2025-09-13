#!/usr/bin/env node

/**
 * Dependency Check Script
 * 
 * This script checks for dependency vulnerabilities, outdated packages,
 * and validates the dependency tree.
 */

const { execSync } = require('child_process');
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

class DependencyChecker {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.info = [];
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
      const result = execSync(command, {
        encoding: 'utf8',
        stdio: options.silent ? 'pipe' : 'inherit',
        ...options,
      });
      return result;
    } catch (error) {
      if (!options.silent) {
        this.error(`Command failed: ${command}`);
        this.error(`Error: ${error.message}`);
      }
      throw error;
    }
  }

  checkNodeVersion() {
    console.log(`${colors.magenta}📦 Node.js Version Check${colors.reset}`);
    
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    this.info(`Current Node.js version: ${nodeVersion}`);
    
    if (majorVersion < 18) {
      this.error('Node.js version 18 or higher is required');
      return false;
    } else if (majorVersion >= 18) {
      this.success('✓ Node.js version is compatible');
      return true;
    }
  }

  checkPackageManager() {
    console.log(`\n${colors.magenta}📦 Package Manager Check${colors.reset}`);
    
    const hasPackageLock = fs.existsSync(path.join(process.cwd(), 'package-lock.json'));
    const hasYarnLock = fs.existsSync(path.join(process.cwd(), 'yarn.lock'));
    const hasPnpmLock = fs.existsSync(path.join(process.cwd(), 'pnpm-lock.yaml'));
    
    let packageManager = 'npm';
    
    if (hasYarnLock) {
      packageManager = 'yarn';
      this.info('Using Yarn as package manager');
    } else if (hasPnpmLock) {
      packageManager = 'pnpm';
      this.info('Using PNPM as package manager');
    } else if (hasPackageLock) {
      this.info('Using npm as package manager');
    } else {
      this.warning('No lock file found - consider running npm install');
    }
    
    return packageManager;
  }

  checkDependencyInstallation(packageManager = 'npm') {
    console.log(`\n${colors.magenta}📦 Dependency Installation Check${colors.reset}`);
    
    const nodeModulesPath = path.join(process.cwd(), 'node_modules');
    
    if (!fs.existsSync(nodeModulesPath)) {
      this.error('node_modules directory not found');
      this.error('Run npm install to install dependencies');
      return false;
    }
    
    try {
      // Check if main dependencies are installed
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
      );
      
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };
      
      const missingDeps = [];
      
      for (const [dep, version] of Object.entries(allDeps)) {
        const depPath = path.join(nodeModulesPath, dep);
        if (!fs.existsSync(depPath)) {
          missingDeps.push(dep);
        }
      }
      
      if (missingDeps.length > 0) {
        this.error(`Missing dependencies: ${missingDeps.join(', ')}`);
        this.error(`Run ${packageManager} install to fix`);
        return false;
      }
      
      this.success('✓ All dependencies are installed');
      return true;
    } catch (error) {
      this.error(`Error checking dependencies: ${error.message}`);
      return false;
    }
  }

  checkVulnerabilities(packageManager = 'npm') {
    console.log(`\n${colors.magenta}🔒 Security Vulnerability Check${colors.reset}`);
    
    try {
      let auditCommand;
      
      switch (packageManager) {
        case 'yarn':
          auditCommand = 'yarn audit --level moderate';
          break;
        case 'pnpm':
          auditCommand = 'pnpm audit --audit-level moderate';
          break;
        default:
          auditCommand = 'npm audit --audit-level moderate';
      }
      
      this.runCommand(auditCommand, { silent: false });
      this.success('✓ No moderate or high vulnerabilities found');
      return true;
    } catch (error) {
      this.warning('Security vulnerabilities detected');
      this.warning(`Run '${packageManager} audit fix' to address them`);
      return false;
    }
  }

  checkOutdatedPackages(packageManager = 'npm') {
    console.log(`\n${colors.magenta}📅 Outdated Packages Check${colors.reset}`);
    
    try {
      let outdatedCommand;
      
      switch (packageManager) {
        case 'yarn':
          outdatedCommand = 'yarn outdated';
          break;
        case 'pnpm':
          outdatedCommand = 'pnpm outdated';
          break;
        default:
          outdatedCommand = 'npm outdated';
      }
      
      const result = this.runCommand(outdatedCommand, { silent: true });
      
      if (result.trim()) {
        this.warning('Some packages are outdated:');
        console.log(result);
        this.warning('Consider updating packages with appropriate caution');
      } else {
        this.success('✓ All packages are up to date');
      }
      
      return true;
    } catch (error) {
      // npm outdated returns exit code 1 when packages are outdated
      this.info('Some packages may be outdated (this is normal)');
      return true;
    }
  }

  checkLicenses() {
    console.log(`\n${colors.magenta}📄 License Compatibility Check${colors.reset}`);
    
    try {
      // Basic license check - in a real-world scenario, you might want to use
      // tools like license-checker or similar
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
      );
      
      if (packageJson.license) {
        this.info(`Project license: ${packageJson.license}`);
        this.success('✓ License information available');
      } else {
        this.warning('No license specified in package.json');
      }
      
      return true;
    } catch (error) {
      this.error(`Error checking license: ${error.message}`);
      return false;
    }
  }

  checkBundleSize() {
    console.log(`\n${colors.magenta}📊 Bundle Size Analysis${colors.reset}`);
    
    try {
      // Check if TypeScript compilation works
      this.runCommand('npm run type-check', { silent: false });
      this.success('✓ TypeScript compilation successful');
      
      // Try to build the project
      this.runCommand('npm run build', { silent: false });
      this.success('✓ Project builds successfully');
      
      // Check output directory
      const distPath = path.join(process.cwd(), 'dist');
      if (fs.existsSync(distPath)) {
        const files = fs.readdirSync(distPath, { recursive: true });
        this.info(`Generated ${files.length} files in dist/`);
      }
      
      return true;
    } catch (error) {
      this.error('Build failed - check your code for errors');
      return false;
    }
  }

  checkCriticalDependencies() {
    console.log(`\n${colors.magenta}🔍 Critical Dependencies Check${colors.reset}`);
    
    const criticalDeps = {
      'grammy': 'Telegram bot framework',
      '@netlify/functions': 'Netlify functions runtime',
      '@supabase/supabase-js': 'Database client',
      'typescript': 'TypeScript compiler (dev)',
    };
    
    try {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
      );
      
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };
      
      let allCriticalPresent = true;
      
      for (const [dep, description] of Object.entries(criticalDeps)) {
        if (allDeps[dep]) {
          this.success(`✓ ${dep} (${description}): ${allDeps[dep]}`);
        } else {
          this.error(`Missing critical dependency: ${dep} (${description})`);
          allCriticalPresent = false;
        }
      }
      
      return allCriticalPresent;
    } catch (error) {
      this.error(`Error checking critical dependencies: ${error.message}`);
      return false;
    }
  }

  generateReport() {
    console.log(`\n${colors.cyan}📊 Dependency Check Summary${colors.reset}`);
    
    const totalChecks = this.errors.length + this.warnings.length + this.info.length;
    
    if (this.errors.length === 0) {
      this.success(`✅ All dependency checks passed!`);
      if (this.warnings.length > 0) {
        this.warning(`⚠️  ${this.warnings.length} warnings to review`);
      }
    } else {
      this.error(`❌ ${this.errors.length} critical issues found`);
      this.warning(`⚠️  ${this.warnings.length} warnings`);
    }
    
    console.log(`\n${colors.yellow}💡 Recommendations:${colors.reset}`);
    
    if (this.errors.length > 0) {
      console.log('1. Address all critical issues before deployment');
      console.log('2. Update missing or incompatible dependencies');
    }
    
    if (this.warnings.length > 0) {
      console.log('3. Review and address warnings when possible');
      console.log('4. Consider updating outdated packages');
    }
    
    console.log('5. Run security audits regularly');
    console.log('6. Monitor dependency updates');
    
    return this.errors.length === 0;
  }

  run() {
    console.log(`${colors.cyan}🔍 Dependency Check${colors.reset}\n`);
    
    const packageManager = this.checkPackageManager();
    
    // Run all checks
    const checks = [
      () => this.checkNodeVersion(),
      () => this.checkDependencyInstallation(packageManager),
      () => this.checkCriticalDependencies(),
      () => this.checkVulnerabilities(packageManager),
      () => this.checkOutdatedPackages(packageManager),
      () => this.checkLicenses(),
      () => this.checkBundleSize(),
    ];
    
    let allPassed = true;
    
    for (const check of checks) {
      try {
        const result = check();
        if (result === false) {
          allPassed = false;
        }
      } catch (error) {
        this.error(`Check failed: ${error.message}`);
        allPassed = false;
      }
    }
    
    // Generate final report
    const finalResult = this.generateReport();
    
    process.exit(finalResult && allPassed ? 0 : 1);
  }
}

// Run checks if this script is executed directly
if (require.main === module) {
  const checker = new DependencyChecker();
  checker.run();
}

module.exports = DependencyChecker;