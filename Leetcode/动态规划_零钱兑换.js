/**
 * @param {number[]} coins
 * @param {number} amount
 * @return {number}
 */
 
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