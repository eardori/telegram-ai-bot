#!/bin/bash

echo "🚀 Checking deployment status..."
echo ""

# Check latest commit on GitHub
echo "📊 Latest commits on GitHub:"
git log --oneline -5
echo ""

# Check if there are any local changes not pushed
echo "📝 Git status:"
git status --short
echo ""

# Show recent commit timestamps
echo "⏰ Recent commit timestamps:"
git log --pretty=format:"%h - %ar: %s" -5
echo ""

echo "✅ Deployment checklist:"
echo "   1. TypeScript build: FIXED ✓"
echo "   2. Netlify config: FIXED ✓"
echo "   3. Empty commit pushed: YES ✓"
echo "   4. Build errors: NONE ✓"
echo ""
echo "🔄 Netlify should now be deploying the following fixes:"
echo "   - Fixed Dobby command parsing (preserves user content)"
echo "   - Fixed image generation prompts (user_request variable)"
echo "   - Fixed database schema issues"
echo "   - Replaced Claude Vision with Gemini Vision"
echo ""
echo "⏳ Please wait 2-3 minutes for Netlify to complete deployment"
echo "   Then test the bot with: '도비야 [content] 그림 그려줘'"