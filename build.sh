#!/bin/bash

echo "🚀 Starting Netlify build process..."

# Create dist directory
echo "📁 Creating dist directory..."
mkdir -p dist

# Create a simple index.html if it doesn't exist
if [ ! -f "index.html" ]; then
    echo "📝 Creating index.html..."
    cat > index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Telegram Bot Webhook</title>
    <meta charset="utf-8">
</head>
<body>
    <h1>Telegram Bot Webhook Service</h1>
    <p>Status: Active</p>
    <p>Webhook endpoint: /.netlify/functions/webhook</p>
</body>
</html>
EOF
fi

# Create _redirects if it doesn't exist
if [ ! -f "_redirects" ]; then
    echo "📝 Creating _redirects..."
    cat > _redirects << 'EOF'
/webhook /.netlify/functions/webhook 200
/api/* /.netlify/functions/:splat 200
/* /index.html 200
EOF
fi

# Copy files to dist
echo "📋 Copying files to dist..."
cp index.html dist/ 2>/dev/null || echo "⚠️  Could not copy index.html"
cp _redirects dist/ 2>/dev/null || echo "⚠️  Could not copy _redirects"

# Create a placeholder file to ensure dist is not empty
echo "📄 Creating placeholder..."
echo "Netlify deployment directory" > dist/.netlify-dist

# List dist contents
echo "📦 Dist directory contents:"
ls -la dist/

echo "✅ Build completed successfully!"
exit 0