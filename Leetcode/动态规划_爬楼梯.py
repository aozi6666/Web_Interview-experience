"""
假设你正在爬楼梯。需要 n 阶你才能到达楼顶。

每次你可以爬 1 或 2 个台阶。你有多少种不同的方法可以爬到楼顶呢？

示例 1：

输入：n = 2
输出：2

解释：有两种方法可以爬到楼顶。
1. 1 阶 + 1 阶
2. 2 阶


示例 2：

输入：n = 3
输出：3

解释：有三种方法可以爬到楼顶。
1. 1 阶 + 1 阶 + 1 阶
2. 1 阶 + 2 阶
3. 2 阶 + 1 阶
"""
from typing import List

class Solution(object):
    def climbStairs(self, n: int) -> int:

        # dp[i] 表示爬到第 i 阶的方法的数量
        dp = [0] * (n + 1)

        if n <= 2:
            return n
        
        dp[1], dp[2] = 1, 2

        for i in range(3, n+1):
            dp[i] = dp[i-1] + dp[i-2]
        
        return dp[n]

if __name__ == '__main__':
    solution = Solution()

    n1 = 2
    print(solution.climbStairs(n1))

    n2 = 3
    print(solution.climbStairs(n2))

    n3 = 5
    print(solution.climbStairs(n3))


