"""
给你一个字符串数组，请你将 字母异位词 组合在一起。可以按任意顺序返回结果列表。

字母异位词 是由重新排列源单词的所有字母得到的一个新单词。

 

示例 1:

输入: strs = ["eat", "tea", "tan", "ate", "nat", "bat"]
输出: [["bat"],["nat","tan"],["ate","eat","tea"]]
示例 2:

输入: strs = [""]
输出: [[""]]
示例 3:

输入: strs = ["a"]
输出: [["a"]]
"""
class Solution:
    def groupAnagrams(self, strs):
        anagram_map = {}

        for word in strs:

            # 将词组 拆分单词 成排序后作为键
            key = ''.join(sorted(word))
            
            if key not in anagram_map:
                anagram_map[key] = []
            
            anagram_map[key].append(word)  # 将键值对添加到字典中

        return list(anagram_map.values())  # 返回字典的值
    

if __name__ == '__main__':
    solution = Solution()
    strs = ["eat", "tea", "tan", "ate", "nat", "bat"]
    print(solution.groupAnagrams(strs))  
    
    strs2 = [""]
    print(solution.groupAnagrams(strs2))

    strs3 = ["a"]
    print(solution.groupAnagrams(strs3))