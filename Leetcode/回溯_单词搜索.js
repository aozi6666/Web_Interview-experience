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
    let m = board.length;
    let n = board[0].length;

    function backtrack(i, j, k) {
        // 1. 越界
        if (i < 0 || i >= m || j < 0 || j >= n) {
            return false;
        }

        // 2. 当前字符不匹配
        if (board[i][j] !== word[k]) {
            return false;
        }
 

        // 4. 做选择：标记当前格子已使用
        let temp = board[i][j];
        board[i][j] = '#';

        // 5. 试探四个方向
        let found =
            backtrack(i + 1, j, k + 1) ||
            backtrack(i - 1, j, k + 1) ||
            backtrack(i, j + 1, k + 1) ||
            backtrack(i, j - 1, k + 1);

        // 6. 撤销选择
        board[i][j] = temp;

        return found;
    }

    // 枚举每一个起点
    for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) {
            if (backtrack(i, j, 0)) {
                return true;
            }
        }
    }

    return false;
};

console.log(exist([['A','B','C','E'],['S','F','C','S'],['A','D','E','E']], "ABCCED"));
console.log(exist([['A','B','C','E'],['S','F','C','S'],['A','D','E','E']], "SEE"));
console.log(exist([['A','B','C','E'],['S','F','C','S'],['A','D','E','E']], "ABCB"));
