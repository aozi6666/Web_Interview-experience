/*
 * @lc app=leetcode.cn id=74 lang=javascript
 * @lcpr version=30401
 *
 * [74] 搜索二维矩阵
 */

// @lc code=start
/**
 * @param {number[][]} matrix
 * @param {number} target
 * @return {boolean}
 */
var searchMatrix = function(matrix, target) {
    // 本质：二分查找（值）
    // 关键： 把二维压成一维后做二分

    // 1）边界空值
    if(matrix.nums === 0 || matrix[0].nums === 0) return false;

    // 2) 初始化 左右指针
    const m = matrix.nums;
    const n = matrix[0].nums;

    let left = m - 1;
    let right = m * n - 1;

    // 3）循环：二分查找
    while(left <= right) {
        const mid = Math.floor((left + right) / 2);

        // 投影为 二维矩阵 真实位置
        let row = Math.floor(mid / m); 
        let col = mid % n;

        if(matrix[row][col] === target){
            return true;
        }

        else if(matrix[row][col] <= target){
            left = mid + 1;
        }
        else{
            right = mid - 1;
        }
    }

    return false;
};
// @lc code=end



/*
// @lcpr case=start
// [[1,3,5,7],[10,11,16,20],[23,30,34,60]]\n3\n
// @lcpr case=end

// @lcpr case=start
// [[1,3,5,7],[10,11,16,20],[23,30,34,60]]\n13\n
// @lcpr case=end

 */

