#!/bin/bash

# =============================================================================
# Deploy Image Edit Feature to Production
# This script prepares and deploys the new image editing feature
# =============================================================================

echo "🚀 Deploying Image Edit Feature"
echo "=============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check environment variable
check_env_var() {
    if [ -z "${!1}" ]; then
        echo -e "${RED}❌ Missing environment variable: $1${NC}"
        return 1
    else
        echo -e "${GREEN}✅ $1 is set${NC}"
        return 0
    fi
}

# Step 1: Check prerequisites
echo ""
echo "1️⃣ Checking prerequisites..."
echo "----------------------------"

if ! command_exists node; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js and npm are installed${NC}"

# Step 2: Check environment variables
echo ""
echo "2️⃣ Checking environment variables..."
echo "------------------------------------"

REQUIRED_VARS=(
    "BOT_TOKEN"
    "CLAUDE_API_KEY"
    "GOOGLE_API_KEY"
    "SUPABASE_URL"
    "SUPABASE_ANON_KEY"
)

MISSING_VARS=0
for var in "${REQUIRED_VARS[@]}"; do
    if ! check_env_var "$var"; then
        MISSING_VARS=$((MISSING_VARS + 1))
    fi
done

# Check optional but recommended
echo ""
echo "Optional variables:"
check_env_var "NANO_BANAFO_API_KEY" || echo -e "${YELLOW}⚠️  Image editing will run in mock mode${NC}"

if [ $MISSING_VARS -gt 0 ]; then
    echo -e "${RED}❌ Missing $MISSING_VARS required environment variables${NC}"
    echo "Please set them in your .env file or Render dashboard"
    exit 1
fi

# Step 3: Install dependencies
echo ""
echo "3️⃣ Installing dependencies..."
echo "-----------------------------"
npm install

# Step 4: Build TypeScript
echo ""
echo "4️⃣ Building TypeScript..."
echo "-------------------------"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful${NC}"

# Step 5: Apply database schema
echo ""
echo "5️⃣ Database Schema Setup"
echo "------------------------"
echo -e "${YELLOW}Please run the following SQL files in your Supabase dashboard:${NC}"
echo ""
echo "1. sql/008_image_edit_schema.sql - Core schema"
echo "2. sql/009_insert_prompt_templates.sql - 38 prompt templates"
echo ""
echo "Navigate to: https://app.supabase.com/project/YOUR_PROJECT/sql/new"
echo ""
read -p "Have you applied the database schemas? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⚠️  Please apply the schemas before deploying${NC}"
    exit 1
fi

# Step 6: Test the build locally (optional)
echo ""
echo "6️⃣ Local Test (Optional)"
echo "------------------------"
read -p "Do you want to run a local test? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Starting local server..."
    timeout 10 npm run dev &
    PID=$!
    sleep 5

    if kill -0 $PID 2>/dev/null; then
        echo -e "${GREEN}✅ Local test successful${NC}"
        kill $PID
    else
        echo -e "${RED}❌ Local test failed${NC}"
        exit 1
    fi
fi

# Step 7: Git operations
echo ""
echo "7️⃣ Git Operations"
echo "-----------------"

# Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
    echo "Found uncommitted changes:"
    git status -s
    echo ""
    read -p "Do you want to commit these changes? (y/n): " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add .
        echo "Enter commit message:"
        read commit_message
        git commit -m "$commit_message"
    fi
fi

# Push to main branch
echo "Pushing to GitHub..."
git push origin main

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Git push failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Code pushed to GitHub${NC}"

# Step 8: Deployment status
echo ""
echo "8️⃣ Deployment Status"
echo "--------------------"
echo "Render will automatically deploy from the main branch."
echo "Check deployment status at: https://dashboard.render.com"
echo ""

# Step 9: Final checklist
echo "📋 Final Checklist:"
echo "-------------------"
echo "✅ Dependencies installed"
echo "✅ TypeScript compiled"
echo "✅ Environment variables set"
echo "✅ Database schemas applied"
echo "✅ Code pushed to GitHub"
echo ""
echo -e "${GREEN}🎉 Image Edit Feature deployment initiated!${NC}"
echo ""
echo "Next steps:"
echo "1. Monitor Render deployment: https://dashboard.render.com"
echo "2. Test the bot with /edit command"
echo "3. Upload a photo to test image analysis"
echo "4. Check logs for any errors"
echo ""
echo "Commands to test:"
echo "  /edit - Start image editing session"
echo "  /help - Check if new commands are listed"
echo ""
echo "Monitor logs with:"
echo "  Render: Check the Logs tab in your service"
echo ""
echo -e "${YELLOW}⚠️  Note: First deployment may take 5-10 minutes${NC}"