// node 版本问题，导致 API不兼容

// 注意：core-js 不会导出 flatMap 函数，而是直接填充到 Array.prototype.flatMap
import "core-js/features/array/flat-map.js";

// polyfill: 垫片（填充物）：在当前环境不支持的情况下，实现 flatMap 方法
// Array.prototype.flatMap = function(callback) {
//     return this.reduce((acc, item, index) => {
//         return acc.concat(callback(item, index));
//     }, []);
// }

// 测试：每个元素映射为 [item, item * 2]
const result = [1, 2].flatMap(item => [item, item * 2]);
console.log(result); // 应该输出: [1, 2, 2, 4]
