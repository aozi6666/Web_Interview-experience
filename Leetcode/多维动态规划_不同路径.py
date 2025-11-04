"""
一个机器人位于一个 m x n 网格的左上角 （起始点在下图中标记为 “Start” ）。

机器人每次只能向下或者向右移动一步。机器人试图达到网格的右下角（在下图中标记为 “Finish” ）。

问总共有多少条不同的路径？

示例 1：
输入：m = 3, n = 7
输出：28

示例 2：
输入：m = 3, n = 2
输出：3
解释：
从左上角开始，总共有 3 条路径可以到达右下角。
1. 向右 -> 向下 -> 向下
2. 向下 -> 向下 -> 向右
3. 向下 -> 向右 -> 向下

示例 3：
输入：m = 7, n = 3
输出：28

示例 4：
输入：m = 3, n = 3
输出：6
"""
from typing import List

class Solution(object):
    def uniquePaths(self, m: int, n: int) -> int:
        # 边界
        if m == 0 or n == 0:
            return 0

        # dp[i][j]: 从起点 (0, 0) 走到位置 (i, j) 的所有不同路径数量
        dp = []

        # 初始化 dp 数组，先创建外层列表（m 行）
        for _ in range(m):

            # 每一行是一个有 n 个 0 的列表
            row = [0] * n
            dp.append(row)

        # 初始化边界： 第一行和第一列路径数为 1
        for i in range(m):

            # 第一列只能从上往下走，路径数为 1
            dp[i][0] = 1
        
        for j in range(n):

            # 第一行只能从左往右走，路径数为 1
            dp[0][j] = 1
        
        #  填剩余表
        for i in range(1, m):
            for j in range(1, n):

                # 当前格子的路径数 = 上方格子 + 左方格子
                dp[i][j] = dp[i-1][j] + dp[i][j-1]

        
        return dp[m-1][n-1]

if __name__ == '__main__':
    solution = Solution()

    m1, n1 = 3, 7
    print(solution.uniquePaths(m1, n1))

    m2, n2 = 3, 3
    print(solution.uniquePaths(m2, n2))