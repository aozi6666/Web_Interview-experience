// 给定一个 n × n 的二维矩阵 matrix 表示一个图像。请你将图像顺时针旋转 90 度。

// 你必须在 原地 旋转图像，这意味着你需要直接修改输入的二维矩阵。请不要 使用另一个矩阵来旋转图像。

 

// 示例 1：


// 输入：matrix = [[1,2,3],[4,5,6],[7,8,9]]
// 输出：[[7,4,1],[8,5,2],[9,6,3]]
// 示例 2：


// 输入：matrix = [[5,1,9,11],[2,4,8,10],[13,3,6,7],[15,14,12,16]]
// 输出：[[15,13,2,5],[14,3,4,1],[12,6,8,9],[16,7,10,11]]

// 倒置函数
function my_reverse(arr) {
    let left = 0;
    let right = arr.length - 1;

    while(left < right) {
        [arr[left], arr[right]] = [arr[right], arr[left]];

        left++;
        right--;
    }
    return arr;
}

function rotate(matrix) {
    n = matrix.length;  // 方阵的行数

    // [i][j] 与 [j][i] 位置互换
    for(let i = 0; i < n; i++) {
        for(let j = i; j < n; j++) {
            [matrix[i][j], matrix[j][i]] = [matrix[j][i], matrix[i][j]];
        }
    }

    // 每一行 倒置
    for(let i = 0; i < n; i++){
        my_reverse(matrix[i]);
    }

    return matrix;
} 

let matrix_1 = [[1,2,3],[4,5,6],[7,8,9]];
console.log(rotate(matrix_1));

let matrix_2 = [[5,1,9,11],[2,4,8,10],[13,3,6,7],[15,14,12,16]];
console.log(rotate(matrix_2));