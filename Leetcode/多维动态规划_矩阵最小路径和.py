"""
给定一个包含非负整数的 m x n 网格 grid ，请找出一条从左上角到右下角的路径，使得路径上的数字总和为最小。

说明：每次只能向下或者向右移动一步。

示例 1：
        [1,3,1]
        [1,5,1]
        [4,2,1]

输入：grid = [[1,3,1],[1,5,1],[4,2,1]]
输出：7
解释：因为路径 1→3→1→1→1 的总和最小。


示例 2：
       [1,2,3]
       [4,5,6]

输入：grid = [[1,2,3],[4,5,6]]
输出：12
"""
from typing import List

class Solution(object):
    def minPathSum(self, grad: List[List[int]]) -> int:

        # 统计矩阵行列数
        m = len(grad)     # 总共有 m 行
        n = len(grad[0])  # 每行有 n 列

        # 初始化dp,  m 行 n 列，全为 0
        # dp[i][j] 表示从 (0, 0) 走到 (i, j) 的最小路径和
        dp = []
        for i in range(m):
            row = [0] * n
            dp.append(row)
        
        # 起点
        dp[0][0] = grad[0][0]

        # 初始化边界 -- 第一行（只能从左边来）
        for j in range(1, n):
            dp[0][j] = dp[0][j-1] + grad[0][j]
        
        # 初始化边界 -- 第一列（只能从上边来）
        for k in range(1, m):
            dp[k][0] = dp[k-1][0] + grad[k][0]
        
        # 填充其余格子
        for i in range(1, m):
            for j in range(1, n):

                # 状态转移方程 -- 左边来：dp[i][j-1], 上边来：dp[i-1][j]
                dp[i][j] = min(dp[i-1][j], dp[i][j-1]) + grad[i][j]
    
        return dp[m-1][n-1]

if __name__ == '__main__':
    grid_1 = [
        [1, 3 ,1],
        [1, 5, 1],
        [4, 2, 1]
    ]

    solution = Solution()
    print(solution.minPathSum(grid_1))

    grid_2 = [
        [1, 2 ,3],
        [4, 5, 6]
    ]
    print(solution.minPathSum(grid_2))
