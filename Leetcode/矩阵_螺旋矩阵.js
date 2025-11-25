// 给你一个 m 行 n 列的矩阵 matrix ，
// 请按照 顺时针螺旋顺序 ，返回矩阵中的所有元素。

// 示例 1：


// 输入：matrix = [[1,2,3],[4,5,6],[7,8,9]]
// 输出：[1,2,3,6,9,8,7,4,5]
// 示例 2：


// 输入：matrix = [[1,2,3,4],[5,6,7,8],[9,10,11,12]]
// 输出：[1,2,3,4,8,12,11,10,9,5,6,7]
/**
 * @param {number[][]} matrix
 * @return {number[]}
 */
var spiralOrder = function(matrix) {
    const res = []; // 创建一个空数组，用于存储结果

    // 创建 上下左右 边界
    let top = 0;
    let bottom = matrix.length - 1;
    let left = 0;
    let right = matrix[0].length -1;

    // 循环
    while (top <= bottom && left <= right) {
        // 1. 从左到右
        for(let j = left; j <= right; j++) {
            res.push(matrix[top][j]);
        }
        top++;

        // 2. 从上到下
        for(let i = top; i <= bottom; i++){
            res.push(matrix[i][right]);
        }
        right--;

        // 先判断是否还有行
        if(top <= bottom) {
            // 3. 从右到左
            for(let j= right; j >= left; j--){
                res.push(matrix[bottom][j]);
            }
            bottom--;
        }

        // 先判断是否还有列
       if(left <= right) {
            //4. 从下到上
            for(let i = bottom; i >= top; i--) {
                res.push(matrix[i][left]);
            }
            left++;
       }
    } 
    return res;
}

console.log(spiralOrder([[1,2,3],[4,5,6],[7,8,9]]));
console.log(spiralOrder([[1,2,3,4],[5,6,7,8],[9,10,11,12]]));


