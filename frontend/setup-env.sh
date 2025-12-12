#!/bin/bash

# Frontend Environment Setup Script

echo "Setting up frontend environment..."

# Create .env.local file if it doesn't exist
if [ ! -f .env.local ]; then
    echo "Creating .env.local file..."
    cat > .env.local << EOF
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1

# Environment
NODE_ENV=development
EOF
    echo "✅ .env.local file created successfully!"
else
    echo "⚠️  .env.local file already exists. Skipping creation."
fi

echo ""
echo "🎉 Environment setup complete!"
echo ""
echo "Next steps:"
echo "1. Make sure your backend is running on port 4000 via Docker Compose"
echo "2. Start the frontend with: npm run dev"
echo "3. Open http://localhost:3000 in your browser"
echo ""
echo "For more information, see API_CONFIG.md"
