#!/usr/bin/env node
/**
 * Wallpaper Engine PKG 文件解压工具
 * 
 * 用法: node scripts/extract-pkg.js <pkg文件路径> [输出目录]
 * 
 * 示例:
 *   node scripts/extract-pkg.js resources/wallpapers/3571376089/scene.pkg
 *   node scripts/extract-pkg.js resources/wallpapers/3571376089/scene.pkg ./output
 */

const fs = require('fs');
const path = require('path');

function extractPkg(pkgPath, outputDir) {
  console.log('读取 PKG 文件:', pkgPath);
  
  const buffer = fs.readFileSync(pkgPath);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  
  // 解析头部
  const magicLength = view.getUint32(0, true);
  const magic = buffer.slice(4, 4 + magicLength).toString('utf-8');
  console.log('格式版本:', magic);
  
  if (!magic.startsWith('PKGV')) {
    console.error('错误: 不是有效的 PKG 文件');
    process.exit(1);
  }
  
  let pos = 4 + magicLength;
  const entryCount = view.getUint32(pos, true);
  pos += 4;
  console.log('文件数量:', entryCount);
  
  // 解析条目
  const entries = [];
  for (let i = 0; i < entryCount; i++) {
    const nameLength = view.getUint32(pos, true);
    pos += 4;
    const name = buffer.slice(pos, pos + nameLength).toString('utf-8');
    pos += nameLength;
    const offset = view.getUint32(pos, true);
    pos += 4;
    const size = view.getUint32(pos, true);
    pos += 4;
    entries.push({ name, offset, size });
  }
  
  const dataStart = pos;
  console.log('数据起始位置:', dataStart);
  console.log('');
  
  // 提取文件
  console.log('开始提取文件...');
  for (const entry of entries) {
    const actualOffset = dataStart + entry.offset;
    const data = buffer.slice(actualOffset, actualOffset + entry.size);
    
    const outPath = path.join(outputDir, entry.name);
    const outDir = path.dirname(outPath);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outPath, data);
    console.log(`  ${entry.name} (${formatSize(entry.size)})`);
  }
  
  console.log('');
  console.log(`完成! 共提取 ${entries.length} 个文件到: ${outputDir}`);
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

// 主程序
const args = process.argv.slice(2);

if (args.length < 1) {
  console.log('用法: node scripts/extract-pkg.js <pkg文件路径> [输出目录]');
  console.log('');
  console.log('示例:');
  console.log('  node scripts/extract-pkg.js resources/wallpapers/3571376089/scene.pkg');
  process.exit(0);
}

const pkgPath = args[0];
const outputDir = args[1] || path.join(path.dirname(pkgPath), 'extracted');

if (!fs.existsSync(pkgPath)) {
  console.error('错误: 文件不存在:', pkgPath);
  process.exit(1);
}

extractPkg(pkgPath, outputDir);
