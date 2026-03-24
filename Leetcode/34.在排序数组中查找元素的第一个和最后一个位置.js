/*
 * @lc app=leetcode.cn id=34 lang=javascript
 * @lcpr version=30401
 *
 * [34] 在排序数组中查找元素的第一个和最后一个位置
 */

// @lc code=start
/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
var searchRange = function(nums, target) {
    // 题目本质：寻找边界 + 二分查找
    // 空值判断
    if(nums.length === 0) return[-1, -1];


    // 回调：搜素左区间
    var left_bound = function(nums, target){
        let left = 0;
        let right = nums.length;

        while(left < right){
            const mid = Math.floor((left + right) / 2);

            if(nums[mid] < target){
                left = mid + 1;
            } else if(nums[mid] > target) {
                right = mid - 1;
            } else if(nums[mid] === target) {
                right = mid - 1;
            }
        }

        return left;
    }

    // 回调： 搜素右区间
    var right_bound = function(nums, target){
        let left = 0;
        let right = nums.length;

        while(left < right) {
            const mid = Math.floor((left + right) / 2);

            if(nums[mid] < target) {
                left = mid + 1;
            } else if(nums[mid] > target) {
                right = left - 1;
            } else{
                left = mid + 1;
            }
        }
    }

    return right;

    resLeft = left_bound(nums, target);
    resRight = right_bound(nums, target);

    return [resLeft, resRight];
    
};
// @lc code=end



/*
// @lcpr case=start
// [5,7,7,8,8,10]\n8\n
// @lcpr case=end

// @lcpr case=start
// [5,7,7,8,8,10]\n6\n
// @lcpr case=end

// @lcpr case=start
// []\n0\n
// @lcpr case=end

 */

