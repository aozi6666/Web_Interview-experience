/**
 * @param {number[]} coins
 * @param {number} amount
 * @return {number}
 */
// 【自顶向下】递归 + 备忘录
var coinChange = function(coins, amount) {
    const memo = new Array(amount + 1).fill(-1);

    const dp = (amount) => {
        if (amount === 0) return 0;
        if (amount < 0) return -1;
        // 命中子集：直接返回
        if (memo[amount] !== -1) return memo[amount];

        let res = Infinity;

        // 遍历每个硬币
        for (let coin of coins) {
            // 递归计算子问题
            const subProblem = dp(amount - coin);
            // 子问题无解，跳过
            if (subProblem === -1) continue;
            // 子问题有解，更新结果
            res = Math.min(res, subProblem + 1);
        }

        // 更新备忘录
        memo[amount] = (res === Infinity ? -1 : res);
        // 返回结果
        return memo[amount];
    };

    return dp(amount);
};

// 【自底向上】DP中的 for 循环 动态规划
var coinChange = function(coins, amount) {
    // dp数组，dp[i]表示 凑成 金额i 所需的 最少的硬币个数
    let dp = new Array(amount + 1).fill(amount + 1);

    de[0] = 0;

    // 循环每个 金额i
    for(let i = 1; i <= amount; i++) {
        // 依次从硬币类型 coins 中取出一个硬币
        for(let coin of coins){
            // 各个金额i >= 硬币coin,更新dp[i]
            if(i >= coin) {
                dp[i] = Math.min(dp[i], dp[i - coin] + 1);
            }
        }
    }
    return dp[amount] === amount + 1 ? -1 : dp[amount];
}
