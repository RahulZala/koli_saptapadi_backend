const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Starting production build process...');

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

// 1. Clean and create dist directory
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// 2. Syntax check all entrypoints
console.log('Running code check...');
execSync('node --check src/server.js', { cwd: rootDir, stdio: 'inherit' });
execSync('node --check api/index.js', { cwd: rootDir, stdio: 'inherit' });

// 3. Copy source files into dist
function copyFolderRecursiveSync(source, target) {
  const targetFolder = path.join(target, path.basename(source));
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  if (fs.lstatSync(source).isDirectory()) {
    const files = fs.readdirSync(source);
    files.forEach((file) => {
      const curSource = path.join(source, file);
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursiveSync(curSource, targetFolder);
      } else {
        fs.copyFileSync(curSource, path.join(targetFolder, file));
      }
    });
  }
}

console.log('Packaging build files into dist/...');
copyFolderRecursiveSync(path.join(rootDir, 'src'), distDir);
copyFolderRecursiveSync(path.join(rootDir, 'api'), distDir);

fs.copyFileSync(path.join(rootDir, 'package.json'), path.join(distDir, 'package.json'));

if (fs.existsSync(path.join(rootDir, '.env'))) {
  fs.copyFileSync(path.join(rootDir, '.env'), path.join(distDir, '.env'));
}
if (fs.existsSync(path.join(rootDir, 'vercel.json'))) {
  fs.copyFileSync(path.join(rootDir, 'vercel.json'), path.join(distDir, 'vercel.json'));
}

console.log('✅ Production build successfully created in dist/ folder!');
