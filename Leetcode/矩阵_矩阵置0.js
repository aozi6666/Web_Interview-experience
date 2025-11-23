// 给定一个 m x n 的矩阵，如果一个元素为 0 ，
// 则将其所在行和列的所有元素都设为 0 。请使用 原地 算法。
 

// 示例 1：

// 输入：matrix = [[1,1,1],[1,0,1],[1,1,1]]
// 输出：[[1,0,1],[0,0,0],[1,0,1]]

// 示例 2：

// 输入：matrix = [[0,1,2,0],[3,4,5,2],[1,3,1,5]]
// 输出：[[0,0,0,0],[0,4,5,0],[0,3,1,0]]

/**
 * @param {number[][]} matrix
 * @return {void} Do not return anything, modify matrix in-place instead.
 */
var setZeroes = function(matrix) {

    const m = matrix.length;  // 矩阵 行数
    const n = matrix[0].length;  // 矩阵 列数

    let fristColZero = false;  // 第一列 是否有0 标记
    let fristRowZero = false;  // 第一行  是否有0 标记

    // (1) 判断 第一列是否有 0
    for(let i = 0; i < m; i++) {
        if(matrix[i][0] === 0) {
            fristColZero = true;
            break;
        }
    }

    // (2) 判断 第一行是否有 0
    for(let j = 0; j < n; j++) {
        if(matrix[0][j] === 0) {
            fristRowZero = true; 
            break;
        }
    }

    // (3) 遍历矩阵，将 0 位置(上 左)置为 0
    for(let i = 1; i < m; i++) {
        for(let j = 1; j < n; j++) {
            if(matrix[i][j] === 0) {
                matrix[i][0] = 0;  // 上元素 置0
                matrix[0][j] = 0;  // 左元素 置0
            }
        }
    }

    // (4) 遍历矩阵，将 0 (所有)置为 0
    for(let i = 1; i < m; i++) {
        for(let j = 1; j < n; j++) {
            if(matrix[i][0] === 0 || matrix[0][j] === 0) {
                matrix[i][j] = 0;
            }
        }
    }

    // (5) 第一列 或第一行 有0， 最后统一更新 第一列/第一行
    if(fristColZero) {
        for(let i = 0; i < m; i++) {
            matrix[i][0] = 0;
        }
    }


    if(fristRowZero) {
        for(let j = 0; j < n; j++) {
            matrix[0][j] = 0;
        }
    }
};

let matrix_1 = [[1,1,1],[1,0,1],[1,1,1]];
setZeroes(matrix_1);
console.log(matrix_1);

let matrix_2 = [[0,1,2,0],[3,4,5,2],[1,3,1,5]];
setZeroes(matrix_2);
console.log(matrix_2);
