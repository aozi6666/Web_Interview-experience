"""
给定两个字符串 text1 和 text2，
返回这两个字符串的最长 公共子序列 的长度。
如果不存在 公共子序列 ，返回 0 。

一个字符串的 子序列 是指这样一个新的字符串：
它是由原字符串在不改变字符的相对顺序的情况下删除某些字符（也可以不删除任何字符）
后组成的新字符串。

例如，"ace" 是 "abcde" 的子序列，但 "aec" 不是 "abcde" 的子序列。
两个字符串的 公共子序列 是这两个字符串所共同拥有的子序列。

 
示例 1：
输入：text1 = "abcde", text2 = "ace" 
输出：3  
解释：最长公共子序列是 "ace" ，它的长度为 3 。


示例 2：
输入：text1 = "abc", text2 = "abc"
输出：3
解释：最长公共子序列是 "abc" ，它的长度为 3 。


示例 3：
输入：text1 = "abc", text2 = "def"
输出：0
解释：两个字符串没有公共子序列，返回 0 。
"""
class Solution(object):
    def longestCommonSubsequence(self, text1: str, text2: str) -> int:

        # 获取两个字符串的长度
        m, n = len(text1), len(text2)

        # 创建一个 (m+1) x (n+1) 的二维数组 dp，初始值为 0
        # dp[i][j] 表示：text1 的前 i 个字符 和 text2 的前 j 个字符 的 最长公共子序列（LCS） 的长度
        dp = []
        for i in range(m+1):
            row = [0] * (n+1)
            dp.append(row)
        
        # 填充 dp 数组
        for i in range(1, m+1):
            for j in range(1, n+1):

                # 如果当前字符相等，公共子序列长度加 1
                if text1[i-1] == text2[j-1]:
                    dp[i][j] = dp[i-1][j-1] + 1
                
                # 否则，取去掉一个字符后的最大值
                else:
                    dp[i][j] = max(dp[i-1][j], dp[i][j-1])

        return dp[m][n]
            

if __name__ == '__main__':
    solution = Solution()

    text1 = "abcde"
    text2 = "ace" 

    print(solution.longestCommonSubsequence(text1, text2))
