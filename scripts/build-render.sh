#!/usr/bin/env bash
set -e

# Build static docs from next-ui
npm run export:next

# Build Vite CRM dashboard
npm run build

# Merge docs and SPA fallback into dist
mkdir -p dist/docs
cp -r next-ui/out/docs/* dist/docs/ 2>/dev/null || true
cp -r next-ui/out/_next dist/ 2>/dev/null || true
cp -r next-ui/out/*/_next dist/ 2>/dev/null || true
cp next-ui/app/docs/docs.css dist/docs/docs.css 2>/dev/null || true
cp next-ui/app/docs/docs.css dist/docs.css 2>/dev/null || true

# Inject standalone docs.css fallback into dist/docs/index.html
if [ -f dist/docs/index.html ]; then
  sed -i.bak 's|</head>|<link rel="stylesheet" href="./docs.css"></head>|' dist/docs/index.html 2>/dev/null || \
  sed -i '' 's|</head>|<link rel="stylesheet" href="./docs.css"></head>|' dist/docs/index.html 2>/dev/null || true
  rm -f dist/docs/index.html.bak 2>/dev/null || true
fi
cp -r public/* dist/ 2>/dev/null || true
cp dist/index.html dist/404.html
touch dist/.nojekyll

echo "Render build completed successfully!"
