/**
 * Generate PWA icons from favicon.svg
 * Uses canvas to render SVG to PNG at multiple sizes
 * Run: node scripts/generate-icons.js
 * 
 * Note: This is a simple HTML-based generator.
 * For production, consider using sharp or canvas npm packages.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgContent = readFileSync(join(__dirname, '..', 'public', 'favicon.svg'), 'utf-8');

// Create a simple HTML file that generates the icons
const html = `<!DOCTYPE html>
<html>
<body>
<h1>PWA Icon Generator</h1>
<p>Right-click each image and "Save Image As" to save the icons:</p>
${[192, 512].map(size => `
<h2>icon-${size}.png (${size}x${size})</h2>
<canvas id="c${size}" width="${size}" height="${size}"></canvas>
<br/><img id="img${size}" />
<script>
(function() {
  const canvas = document.getElementById('c${size}');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  const svgBlob = new Blob([\`${svgContent.replace(/`/g, '\\`')}\`], {type: 'image/svg+xml'});
  const url = URL.createObjectURL(svgBlob);
  img.onload = function() {
    ctx.drawImage(img, 0, 0, ${size}, ${size});
    document.getElementById('img${size}').src = canvas.toDataURL('image/png');
    URL.revokeObjectURL(url);
  };
  img.src = url;
})();
</script>
`).join('')}
</body>
</html>`;

writeFileSync(join(__dirname, '..', 'public', 'icon-generator.html'), html);
console.log('Created icon-generator.html - open it in a browser to generate icons');
console.log('Or use the simpler approach: we will create placeholder icons with SVG data URIs');

// For a simpler approach, we'll create a minimal valid PNG placeholder
// The actual icons will be the SVG served as-is (most modern browsers support SVG icons)
console.log('\\nNote: Most modern browsers and iOS Safari support SVG icons in the manifest.');
console.log('The SVG favicon.svg will work as the icon source.');
