/*
 * @lc app=leetcode.cn id=121 lang=javascript
 * @lcpr version=30402
 *
 * [121] 买卖股票的最佳时机
 */

// @lc code=start
/**
 * @param {number[]} prices
 * @return {number}
 */
var maxProfit = function(prices) {
    /* 
        状态 dp[i][k][0-1]
            - i : 当前已经到 第 i 天
            - k : 最多交易 k 次
            - 0-1 : 状态为0(不持股)或1（持股）
    */
    // 边界判断
    if(prices.length === 0) return 0;

    // 初始化:此题 k 始终限制为 1
    const dp = Array.from({length: prices.length + 1}, () => [0, 0]);

    // 第 0 天，不持股，利润为 0
    dp[0][0] = 0;
    // 第 0 天，持股，利润为 -无穷大
    dp[0][1] = -Infinity;

    // 遍历每一天
    for(let i = 1; i <= prices.length; i++){
        // 第 i 天，不持股 (只有两种情况：前一天不持股，前一天持股 今天卖出)
        dp[i][0] = Math.max(dp[i-1][0], dp[i-1][1] + prices[i-1]);
        // 第 i 天，持股 （只有两种情况：前一天持股，前一天不持股 今天买入）
        dp[i][1] = Math.max(dp[i-1][1], 0 - prices[i-1]);        
    }

    return dp[prices.length][0];
};
// @lc code=end



/*
// @lcpr case=start
// [7,1,5,3,6,4]\n
// @lcpr case=end

// @lcpr case=start
// [7,6,4,3,1]\n
// @lcpr case=end

 */

