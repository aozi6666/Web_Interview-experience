"""
给你一个字符串 s 和一个字符串列表 wordDict 作为字典。
如果可以利用字典中出现的一个或多个单词拼接出 s 则返回 true。

注意：不要求字典中出现的单词全部都使用，并且字典中的单词可以重复使用。


示例 1：

输入: s = "leetcode", wordDict = ["leet", "code"]
输出: true
解释: 返回 true 因为 "leetcode" 可以由 "leet" 和 "code" 拼接成。
示例 2：

输入: s = "applepenapple", wordDict = ["apple", "pen"]
输出: true
解释: 返回 true 因为 "applepenapple" 可以由 "apple" "pen" "apple" 拼接成。
     注意，你可以重复使用字典中的单词。

示例 3：

输入: s = "catsandog", wordDict = ["cats", "dog", "sand", "and", "cat"]
输出: false
 
"""
from typing import List

class Solution(object):
    def wordBreak(self, s: str, wordDict: List[str]) -> bool:

        # 转为 set 提高查询效率
        word_set = set(wordDict)

        n = len(s)

        # dp[i] 表示 s[0:i]（前 i 个字符）是否能由 wordDict 拆分出来
        dp = [False] * (n + 1)

        # 空字符串可以被 “拆分”
        dp[0] = True

        # 外层循环遍历 i, 逐个取s中的前i个字符
        for i in range(1, n + 1):

            # 内存循环遍历 j, 取 s[j:i] 遍历所有可能的拆分点
            for j in range(0, i):
                if dp[j] and s[j: i] in word_set:
                    dp[i] = True
                    break
        
        return dp[n]

if __name__ == '__main__':
    solution = Solution()

    s1 = "leetcode"
    wordDict_1 = ["leet", "code"]
    print(solution.wordBreak(s1, wordDict_1))

    s2 = "applepenapple"
    wordDict_2 = ["apple", "pen"]
    print(solution.wordBreak(s2, wordDict_2))

    s3 = "catsandog" 
    wordDict_3 = ["cats", "dog", "sand", "and", "cat"]
    print(solution.wordBreak(s3, wordDict_3))