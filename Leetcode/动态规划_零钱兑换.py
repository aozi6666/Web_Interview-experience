"""
给你一个整数数组 coins ，表示不同面额的硬币；以及一个整数 amount ，表示总金额。

计算并返回可以凑成总金额所需的 最少的硬币个数 。如果没有任何一种硬币组合能组成总金额，返回 -1 。

你可以认为每种硬币的数量是无限的。

示例 1：

输入：coins = [1, 2, 5], amount = 11
输出：3 
解释：11 = 5 + 5 + 1

示例 2：

输入：coins = [2], amount = 3
输出：-1
"""
from typing import List

class Solution(object):
    def coinChange(self, coins: List[int], amount: int) -> int:

        # 初始化 dp 数组，dp[i] 表示凑出金额 i 所需的最小硬币数
        # 初始值设为 amount+1，代表无穷大（因为最多也只会用 amount 个 1 元）
        dp = [amount + 1] * (amount + 1)

        # 初始化0，因为凑出金额 0 所需硬币数为 0
        dp[0] = 0

        # 动态规划填表（尝试 金额i 与 硬币面值coin）
        for i in range(1, amount + 1):
            for coin in coins:
                if i >= coin:
                    dp[i] = min(dp[i], dp[i-coin] + 1)

        # 判断结果
        if dp[amount] == amount + 1:
            return -1
        else:
            return dp[amount]

if __name__ == '__main__':
    solution = Solution()

    coins = [1, 2, 5]
    amount = 11
    print(solution.coinChange(coins, amount))

    coins_2 = [2] 
    amount_2 = 3
    print(solution.coinChange(coins_2, amount_2))
    
