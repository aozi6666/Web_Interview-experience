/*
 * @lc app=leetcode.cn id=509 lang=javascript
 * @lcpr version=30402
 *
 * [509] 斐波那契数
 */

// @lc code=start
/**
 * @param {number} n
 * @return {number}
 */
// 【自顶向下】递归 + 备忘录
var fib = function(n) {
    // 边界判断
    if(n === 0) return 0;

    // 【备忘录】数组：存储 子集合 中间结果
    //  备忘录全初始化为 -1: 特殊值 -1 表示未计算
    // 数组的索引从 0 开始，所以需要 n + 1 个空间,把 `f(0) ~ f(n)` 都记录到 memo 中
    const memo = Array(n + 1).fill(-1);
    memo[0] = 0;
    memo[1] = 1;

    function dp(n, memo){
        // base case
        if(n === 0 || n === 1) return n;

        // 命中子集：直接返回
        if(memo[n] !== -1) return memo[n];

        // 不命中时，递归计算,并且存入 【备忘录】
        memo[n] = dp(n-1, memo) + dp(n-2, memo);
        return memo[n];
    }

    return dp(n, memo);
};
// 【自底向上】DP中的 for 循环 动态规划
var fibDP = function(n) {
    const dp = new Array(n+1).fill(-1);
    dp[0] = 0;
    dp[1] = 1;

    if(n === 0 || n === 1) return dp[n];

    for(let i = 2; i <= n; i++) {
        dp[i] = dp[i-1] + dp[i-2];
    }
    return dp[n];
}
// @lc code=end



/*
// @lcpr case=start
// 2\n
// @lcpr case=end

// @lcpr case=start
// 3\n
// @lcpr case=end

// @lcpr case=start
// 4\n
// @lcpr case=end

 */

