#!/usr/bin/env bash
set -e

# Build static docs from next-ui
npm run export:next

# Build Vite CRM dashboard
npm run build

# Merge docs and SPA fallback into dist
mkdir -p dist/docs
cp -r next-ui/out/docs/* dist/docs/ 2>/dev/null || true
cp -r public/* dist/ 2>/dev/null || true
cp dist/index.html dist/404.html
touch dist/.nojekyll

echo "Render build completed successfully!"
