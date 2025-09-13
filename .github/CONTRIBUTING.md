# Contributing to Telegram AI Bot

Thank you for your interest in contributing to the Telegram AI Bot project! We welcome contributions from the community and are pleased to have you join us.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Process](#contributing-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Issue Guidelines](#issue-guidelines)
- [Security](#security)

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites

- Node.js (v18.0.0 or higher)
- npm or yarn
- Git
- A Telegram Bot Token (for testing)
- Supabase account (for database testing)

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/yourusername/telegram-ai-bot.git
   cd telegram-ai-bot
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration values
   ```

4. **Run Tests**
   ```bash
   npm test
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

## Contributing Process

### 1. Create an Issue

Before starting work, please create an issue or comment on an existing one to discuss:
- Bug reports
- Feature requests
- Improvements

### 2. Fork and Branch

1. Fork the repository
2. Create a feature branch from `develop`:
   ```bash
   git checkout -b feature/your-feature-name develop
   ```

### 3. Make Changes

- Write code following our [coding standards](#coding-standards)
- Add tests for new functionality
- Update documentation as needed
- Ensure all tests pass

### 4. Commit Guidelines

We follow conventional commits format:

```
type(scope): description

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding missing tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(commands): add new /stats command
fix(webhook): handle timeout errors properly
docs(readme): update installation instructions
```

### 5. Submit Pull Request

1. Push your branch to your fork
2. Create a pull request against `develop` branch
3. Fill out the PR template completely
4. Link related issues

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Follow existing code patterns
- Use proper type definitions
- Avoid `any` types when possible

### Code Style

- Use Prettier for formatting
- Follow ESLint rules
- Use meaningful variable and function names
- Write self-documenting code

### File Structure

```
src/
├── config/          # Configuration files
├── handlers/        # Bot command handlers
├── types/          # TypeScript type definitions
└── utils/          # Utility functions

netlify/functions/  # Netlify serverless functions
├── handlers/       # Request handlers
├── utils/         # Shared utilities
└── webhook.ts     # Main webhook endpoint
```

### Environment Variables

- Never commit real API keys or secrets
- Use `.env.example` to document required variables
- Use descriptive variable names with proper prefixes

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

- Write unit tests for new functions
- Use integration tests for API endpoints
- Mock external dependencies
- Aim for >80% code coverage

### Test Structure

```typescript
describe('FeatureName', () => {
  beforeEach(() => {
    // Setup
  });

  it('should handle normal case', () => {
    // Test implementation
  });

  it('should handle edge case', () => {
    // Test implementation
  });
});
```

## Submitting Changes

### Pull Request Checklist

- [ ] Code follows the style guidelines
- [ ] Self-review completed
- [ ] Tests added/updated and passing
- [ ] Documentation updated
- [ ] No breaking changes (or clearly documented)
- [ ] Conventional commit messages used
- [ ] PR title follows convention
- [ ] Related issues linked

### Review Process

1. Automated checks must pass
2. At least one maintainer review required
3. Address feedback promptly
4. Maintain clean commit history

## Issue Guidelines

### Bug Reports

- Use the bug report template
- Provide reproduction steps
- Include relevant logs/screenshots
- Specify environment details

### Feature Requests

- Use the feature request template
- Explain the problem you're solving
- Describe your proposed solution
- Consider alternative approaches

### Security Issues

- **DO NOT** create public issues for security vulnerabilities
- Email security concerns to: [security@example.com]
- Follow responsible disclosure practices

## Security

### Best Practices

- Never hardcode secrets or API keys
- Validate all inputs
- Use proper error handling
- Follow principle of least privilege
- Keep dependencies updated

### Reporting Security Issues

If you discover a security vulnerability, please:

1. **DO NOT** create a public GitHub issue
2. Email details to: [security@example.com]
3. Allow time for assessment and patching
4. Follow coordinated disclosure timeline

## Development Tips

### Local Development

```bash
# Setup local environment
npm run dev

# Run type checking
npm run type-check

# Run linting
npm run lint

# Format code
npm run format
```

### Debugging

- Use VS Code debugger configuration
- Add logging with appropriate levels
- Use network inspection tools for webhook testing

### Database Migrations

When changing database schema:

1. Update type definitions in `src/types/database.ts`
2. Create migration SQL files in `sql/migrations/`
3. Test migrations locally
4. Document changes in PR

## Community

- Join our Discord server: [link]
- Follow us on Twitter: [link]
- Check out our roadmap: [link]

## Questions?

If you have questions that aren't covered in this guide:

1. Check existing issues and discussions
2. Create a new discussion thread
3. Reach out to maintainers

Thank you for contributing to make this project better! 🚀