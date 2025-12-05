// 给定一个 m x n 二维字符网格 board 和一个字符串单词 word 。
// 如果 word 存在于网格中，返回 true ；否则，返回 false 。

// 单词必须按照字母顺序，通过相邻的单元格内的字母构成，
// 其中“相邻”单元格是那些水平相邻或垂直相邻的单元格。
// 同一个单元格内的字母不允许被重复使用。

 
// 示例 1：


// 输入：board = [['A','B','C','E'],['S','F','C','S'],['A','D','E','E']],
//  word = "ABCCED"
// 输出：true
// 示例 2：


// 输入：board = [['A','B','C','E'],['S','F','C','S'],['A','D','E','E']], 
// word = "SEE"
// 输出：true
// 示例 3：
// 1

// 输入：board = [['A','B','C','E'],['S','F','C','S'],['A','D','E','E']], 
// word = "ABCB"
// 输出：false
/**
 * @param {character[][]} board
 * @param {string} word
 * @return {boolean}
 */
var exist = function(board, word) {
    // 记录行列
    const m = board.length;
    const n = board[0].length;

    // 回溯函数
    function backtrack(i, j, k) {
        // 所有字符都匹配完了
        if(k === word.length) return true;

        // 越界 or 字符不相等
        if(i < 0 || i >= m || j < 0 || j >= n || board[i][j] !== word[k]) {
            return false;
        } 

        // 临时标记（防止重复使用）
        const temp = board[i][j];
        board[i][j] = '#';

        // 四个方向继续匹配
        const found = 
            backtrack(i + 1, j, k + 1) ||
            backtrack(i - 1, j, k + 1) ||
            backtrack(i, j + 1, k + 1) ||
            backtrack(i, j - 1, k + 1);

        // 回溯： 恢复现场
        board[i][j] = temp;

        return found;
    }

    // 从每个格子 作为起点 尝试
    for(let i = 0; i < m; i++) {
        for(let j = 0; j < n; j++) {
            if(backtrack(i, j, 0)) return true;
        }
    }

    return false;

};

console.log(exist([['A','B','C','E'],['S','F','C','S'],['A','D','E','E']], "ABCCED"));
console.log(exist([['A','B','C','E'],['S','F','C','S'],['A','D','E','E']], "SEE"));
console.log(exist([['A','B','C','E'],['S','F','C','S'],['A','D','E','E']], "ABCB"));
