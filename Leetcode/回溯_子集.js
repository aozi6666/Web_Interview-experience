/*
 * @lc app=leetcode.cn id=78 lang=javascript
 * @lcpr version=30401
 *
 * [78] 子集
 */

// @lc code=start
/**
 * @param {number[]} nums
 * @return {number[][]}
 */
var subsets = function(nums) {
    let res = [];
    // [路径]：已选元素
    let track = [];
    let start = 0;
    
    function backtrack(nums, track, start) {
        // 存入结果
        res.push([...track]);

        for (let i = start; i < nums.length; i++) {
            // 递归前-做选择
            track.push(nums[i]);

            // 进入递归
            backtrack(nums, track, i + 1);

            // 递归结束-撤销选择
            track.pop();
        }
    }

    backtrack(nums, track, start);
    
    return res;
};
// @lc code=end



/*
// @lcpr case=start
// [1,2,3]\n
// @lcpr case=end

// @lcpr case=start
// [0]\n
// @lcpr case=end

 */

