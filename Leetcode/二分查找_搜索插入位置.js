/*
 * @lc app=leetcode.cn id=35 lang=javascript
 * @lcpr version=30401
 *
 * [35] 搜索插入位置
 */

// @lc code=start
/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number}
 */
var searchInsert = function(nums, target) {
    // 空值判断
    if(nums.length === 0) return 0;

    // 定义 左右指针
    let left = 0;
    let right = nums.length - 1;

    // 循环 二分查找
    while(left <= right){
        // 中间索引:向下取整
        const mid = Math.floor((left + right) / 2);

        if(nums[mid] === target) return mid;
        if(nums[mid] > target) {
            right = mid - 1;
        } else {
            left = mid + 1;
        }
    }

    return left;
};
// @lc code=end



/*
// @lcpr case=start
// [1,3,5,6]\n5\n
// @lcpr case=end

// @lcpr case=start
// [1,3,5,6]\n2\n
// @lcpr case=end

// @lcpr case=start
// [1,3,5,6]\n7\n
// @lcpr case=end

 */

