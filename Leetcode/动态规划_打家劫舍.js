/*
 * @lc app=leetcode.cn id=198 lang=javascript
 * @lcpr version=30402
 *
 * [198] 打家劫舍
 */

// @lc code=start
/**
 * @param {number[]} nums
 * @return {number}
 */
// 【递归+备忘录】：自顶向下
var rob = function(nums) {
    // 边界判断
    if(nums.length === 0) return 0;

    // 初始化
    const memo = new Array(nums.length).fill(-1);
    let result = 0;
    let start = 0; // 起始位置：从位置0开始

    function dp(nums, start, memo){
        // 跳出条件：位置已经到数组的头
        if(start >= nums.length) return 0;

        // 备忘录暂存命中
        if(memo[start] !== -1){
            return memo[start];
        }

        let res = Math.max(dp(nums, start + 1, memo), nums[start] + dp(nums, start + 2, memo));

        // 存结果
        memo[start] = res;

        return res;
    }

    result = dp(nums, start, memo);
    return result;
};

// 【自底向上】：DP中的 for 循环 动态规划
var robDP = function(nums) {
    // 边界判断
    if(nums.length === 0) return 0;

    // dp[i]表示 位置i 已经抢劫完成的最大金额
    const dp = new Array(nums.length + 1).fill(0);
    dp[0] = 0;

    // 只有一家
    dp[1] = nums[0];

    // 只有两家
    dp[2] = Math.max(nums[0], nums[1]);

    // 从第三家开始递归遍历
    for(let i = 3; i <= nums.length; i++){
        dp[i] = Math.max(dp[i-1], nums[i-1] + dp[i-2]);
    }

    return dp[nums.length];
}
// @lc code=end



/*
// @lcpr case=start
// [1,2,3,1]\n
// @lcpr case=end

// @lcpr case=start
// [2,7,9,3,1]\n
// @lcpr case=end

 */

