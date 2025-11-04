"""
给你一个整数 n ，返回 和为 n 的完全平方数的最少数量 。

完全平方数 是一个整数，其值等于另一个整数的平方；换句话说，其值等于一个整数自乘的积。
例如，1、4、9 和 16 都是完全平方数，而 3 和 11 不是。

 

示例 1：

输入：n = 12
输出：3 
解释：12 = 4 + 4 + 4
示例 2：

输入：n = 13
输出：2
解释：13 = 4 + 9

"""
class Solution(object):
    def numSquares(self, n):

        # 初始化dp数组，dp[i]表示 数值为i 的 完全平方数相加 的最少数量
        dp = [float('inf')] * (n + 1)
        dp[0] = 0

        for i in range(1, n + 1):
            j = 1
            while j * j <= i:
                dp[i] = min(dp[i], dp[i - j * j] + 1)
                j += 1
        
        return dp[n]

if __name__ == '__main__':
    n = 12
    solution = Solution()
    print(solution.numSquares(n)) 

    n2 = 13
    print(solution.numSquares(n2)) 