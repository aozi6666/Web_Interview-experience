/*
 * @lc app=leetcode.cn id=300 lang=javascript
 * @lcpr version=30402
 *
 * [300] 最长递增子序列
 */

// @lc code=start
/**
 * @param {number[]} nums
 * @return {number}
 */
var lengthOfLIS = function(nums) {
    let res = 0;
    const dp = new Array(nums.length + 1).fill(1);

    for(let i = 1; i <= nums.length; i++){
        for(let j = 1; j < i; j++){
            if(nums[i] > nums[j]){
                dp[i] = Math.max(dp[i], dp[j] + 1);
            }
        }
    }

    for(let i = 0; i <= nums.length; i++){
        res = Math.max(res, dp[i]);
    }
    return res;
};
// @lc code=end



/*
// @lcpr case=start
// [10,9,2,5,3,7,101,18]\n
// @lcpr case=end

// @lcpr case=start
// [0,1,0,3,2,3]\n
// @lcpr case=end

// @lcpr case=start
// [7,7,7,7,7,7,7]\n
// @lcpr case=end

 */

