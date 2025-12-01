// 数字 n 代表生成括号的对数，请你设计一个函数，
// 用于能够生成所有可能的并且 有效的 括号组合。

 
// 示例 1：

// 输入：n = 3
// 输出：["((()))","(()())","(())()","()(())","()()()"]

// 示例 2：

// 输入：n = 1
// 输出：["()"]
/**
 * @param {number} n
 * @return {string[]}
 */
var generateParenthesis = function(n) {
    const res = [];

    // 回溯函数：
    // cur：当前生成的字符串
    // open：已经用了多少个 '('
    // close：已经用了多少个 ')'
    function backtrack(cur, open, close) {
        // 长度达到 2n，说明用完了 n 对括号
        if(cur.length === 2 * n) {
            res.push(cur);
            return;
        }

        // 左括号还没用完,继续放左括号
        if(open < n) {
            backtrack(cur + '(', open + 1, close);
        }

        // 右括号数量必须小于左括号，才能放右括号
        if(close < open) {
            backtrack(cur + ')', open, close + 1);
        }
    }

    backtrack('', 0, 0);
    return res;
};

console.log(generateParenthesis(3));
console.log(generateParenthesis(1));
