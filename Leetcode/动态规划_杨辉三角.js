/**
 * @param {number} numRows
 * @return {number[][]}
 */
var generate  = function(numRows) {
    let res = [];

    // 遍历
    for(i = 0; i < numRows; i++) {
        // 初始化每一行 都为 1
        let row = new Array(i + 1).fill(1);

        // 从三行开始，填充中间元素
        for(j = 1; j < i; j++) {
            row[j] = res[i-1][j-1] + res[i-1][j];
        }

        res.push(row);
    }
};