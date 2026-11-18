// scripts/inject-pwa.js
// Post-build script: injects PWA manifest <link> and apple-touch-icon into dist/index.html
// Run automatically via "build:web" script after expo export.
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'dist', 'index.html');

if (!fs.existsSync(indexPath)) {
  console.error('❌ dist/index.html not found. Run expo export first.');
  process.exit(1);
}

let html = fs.readFileSync(indexPath, 'utf8');

const pwaLinks = `
  <link rel="manifest" href="/manifest.json" />
  <link rel="apple-touch-icon" href="/icons/icon-192.png" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <meta name="apple-mobile-web-app-title" content="Spendly" />
`;

// Inject before closing </head> if not already present
if (!html.includes('rel="manifest"')) {
  html = html.replace('</head>', `${pwaLinks}</head>`);
  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('✅ PWA tags injected into dist/index.html');
} else {
  console.log('ℹ️  PWA tags already present in dist/index.html');
}
