#!/usr/bin/env node
/**
 * Bundle a student vocab set into one self-contained HTML file.
 * Usage: node bundle-student-set.mjs unit-1-set-1-historical-thinking.html
 *
 * Input file must set window.VOCAB_SET in a <script> block (no external CSS/JS).
 * Output overwrites the input file with CSS + runtime inlined.
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const input = process.argv[2];
if (!input) {
  console.error('Usage: node bundle-student-set.mjs <set-html-file>');
  process.exit(1);
}

const inputPath = join(dir, input);
const html = readFileSync(inputPath, 'utf8');
const vocabMatch = html.match(/<script>\s*window\.VOCAB_SET\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
if (!vocabMatch) {
  console.error('Could not find window.VOCAB_SET block in', input);
  process.exit(1);
}

const css = readFileSync(join(dir, 'student-styles.css'), 'utf8');
const runtime = readFileSync(join(dir, 'student-runtime.js'), 'utf8')
  .replace(/^\/\*\*[\s\S]*?\*\/\s*/, '')
  .replace(/^\(function \(\) \{/, '')
  .replace(/\}\)\(\);\s*$/, '');

const titleMatch = html.match(/<title>([^<]*)<\/title>/);
const title = titleMatch ? titleMatch[1] : 'Vocabulary';

const out = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
${css}
  </style>
</head>
<body>
  <div id="root" class="app"></div>
  <script>
    window.VOCAB_SET = ${vocabMatch[1]};
  </script>
  <script>
${runtime}
  </script>
</body>
</html>
`;

writeFileSync(inputPath, out);
console.log('Bundled:', inputPath);
