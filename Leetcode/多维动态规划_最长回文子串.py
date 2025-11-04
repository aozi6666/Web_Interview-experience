"""
给你一个字符串 s，找到 s 中最长的 回文子串。

回文：如果字符串向前和向后读都相同，则它满足 回文性。
子串:子字符串 是字符串中连续的 非空 字符序列


示例 1：
输入：s = "babad"
输出："bab"
解释："aba" 同样是符合题意的答案。

示例 2：
输入：s = "cbbd"
输出："bb"

"""
class Solution(object):
    def longestPalindrome(self, s: str) -> str:
        n = len(s)

        # # 如果字符串长度小于2，本身就是回文
        if n < 2:
            return s

        # 手动构建二维数组 dp[n][n]，初始全为 False
        # dp[i][j]: 字符串 s[i..j] 是否为回文子串
        dp = []
        for i in range(n):
            row = [False] * n
            dp.append(row)
        
        start = 0  # 最长回文子串的起始索引
        max_len = 1  # 最长回文子串的长度，初始化为 1（最短回文）

        # 枚举子串的结束位置 j
        for j in range(n):

            # 枚举子串的起始位置 i
            for i in range(0, j + 1):

                 # 如果两个字符相等，并且中间是回文或长度小于等于2
                if s[i] == s[j]:
                    if j - i <= 2 or dp[i+1][j-1]:
                        dp[i][j] = True

                        # 更新最大回文长度和起始位置
                        if j - i + 1 > max_len:
                            max_len = j - 1 + i
                            start = i
        
        # 返回最长回文子串
        return s[start: start + max_len]
    
if __name__ == '__main__':
    solution = Solution()
    s1 = "babad"
    print(solution.longestPalindrome(s1))






        
