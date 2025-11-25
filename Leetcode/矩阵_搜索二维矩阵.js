// 编写一个高效的算法来搜索 m x n 矩阵 matrix 中的一个目标值 target 。该矩阵具有以下特性：

// 每行的元素从左到右升序排列。
// 每列的元素从上到下升序排列。

// 示例1：
// 输入：matrix = [
//                [1,4,7,11,15],
//                [2,5,8,12,19],
//                [3,6,9,16,22],
//                [10,13,14,17,24],
//                [18,21,23,26,30]
//              ], 
// target = 5

// 输出：true

// 示例2：
// 输入：matrix = [[1,4,7,11,15],[2,5,8,12,19],[3,6,9,16,22],[10,13,14,17,24],[18,21,23,26,30]], target = 20
// 输出：false
/**
 * @param {number[][]} matrix
 * @param {number} target
 * @return {boolean}
 */
var searchMatrix = function(matrix, target) {
    // 空矩阵
    if(matrix.length === 0) return false;

    // 统计矩阵 行/列
    const m = matrix.length;
    const n = matrix[0].length;

    // 找右上角位置，从右上角开始
    let row = 0;
    let col = n - 1;

    // 循环
    while(row < m && col >= 0) {
        const val = matrix[row][col];

        if(val === target) return true;
        else if(val > target) col--;
        else row++;
    }
    return false;
};

console.log(searchMatrix([[1,4,7,11,15],[2,5,8,12,19],[3,6,9,16,22],[10,13,14,17,24],[18,21,23,26,30]], 20));
console.log(searchMatrix([[1,4,7,11,15],[2,5,8,12,19],[3,6,9,16,22],[10,13,14,17,24],[18,21,23,26,30]], 13));
