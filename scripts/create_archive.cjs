const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = 'D:\\Emoji Editor';
const downloadsZip = 'C:\\Users\\dimaz\\Downloads\\emoji-editor-magnat.zip';
const localZip = 'D:\\Emoji Editor\\emoji-editor-magnat.zip';

const tempDir = path.join(process.env.TEMP, 'emoji_pack_' + Date.now());
fs.mkdirSync(tempDir, { recursive: true });

const filesToCopy = [
  'src',
  'public',
  'bot',
  'index.html',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vite.config.ts',
  'README.md',
  '.gitignore',
  '.github',
];

for (const item of filesToCopy) {
  const srcPath = path.join(rootDir, item);
  const destPath = path.join(tempDir, item);
  if (fs.existsSync(srcPath)) {
    fs.cpSync(srcPath, destPath, { recursive: true });
  }
}

if (fs.existsSync(downloadsZip)) fs.unlinkSync(downloadsZip);

execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${tempDir}\\*' -DestinationPath '${downloadsZip}' -CompressionLevel Optimal"`, { stdio: 'inherit' });

fs.copyFileSync(downloadsZip, localZip);
fs.rmSync(tempDir, { recursive: true, force: true });

const stat = fs.statSync(downloadsZip);
console.log(`ARCHIVE_SUCCESS: ${downloadsZip} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
