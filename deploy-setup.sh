#!/bin/bash

echo "🚴 CycleConnect Deployment Setup"
echo "================================="

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "Initializing git repository..."
    git init
    git add .
    git commit -m "Initial commit: CycleConnect cycling community app"
else
    echo "Git repository already initialized"
fi

# Check if origin remote exists
if ! git remote get-url origin > /dev/null 2>&1; then
    echo ""
    echo "📋 Next Steps:"
    echo "1. Create GitHub repository at: https://github.com/new"
    echo "2. Run: git remote add origin https://github.com/YOUR_USERNAME/cycleconnect.git"
    echo "3. Run: git push -u origin main"
    echo ""
else
    echo "Git remote 'origin' already configured"
    echo "Current remote URL: $(git remote get-url origin)"
fi

echo ""
echo "✅ Setup complete! Your repository is ready for deployment."
echo ""
echo "📖 Next steps:"
echo "1. Read the DEPLOYMENT_GUIDE.md for detailed instructions"
echo "2. Set up Supabase database"
echo "3. Deploy backend to Render"
echo "4. Deploy frontend to Vercel"
echo ""
echo "📱 Android APK is also ready to build with: npx cap open android"