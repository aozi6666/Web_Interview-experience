// ES 模块语法
import regenerator from 'regenerator';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES 模块中没有 __dirname，需要使用 import.meta.url 来获取当前文件路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourcePath = path.resolve(__dirname, './target.js');

const source = fs.readFileSync(sourcePath, 'utf-8');

const result = regenerator.compile(source, {
    includeRuntime: true,
});



fs.writeFileSync(path.resolve(__dirname, './target-compiled.js'), result.code);

console.log('编译完成');