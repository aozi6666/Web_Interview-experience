"""
给定一个未排序的整数数组 nums ，找出数字连续的最长序列（不要求序列元素在原数组中连续）的长度。

请你设计并实现时间复杂度为 O(n) 的算法解决此问题。

 

示例 1：

输入：nums = [100,4,200,1,3,2]
输出：4
解释：最长数字连续序列是 [1, 2, 3, 4]。它的长度为 4。

示例 2：

输入：nums = [0,3,7,2,5,8,4,6,0,1]
输出：9

示例 3：

输入：nums = [1,0,1,2]
输出：3
"""
class Solution(object):
    def longestConsecutive(self, nums):
        
        """
        :type nums: List[int]
        :rtype: int
        """
        nums_set = set(nums) # 将列表转换为集合，去重
        max_length = 0  

        for num in nums:

            # 确定序列的起始元素，并开始记录长度
            if num - 1 not in nums_set:
                current_num = num
                current_length = 1

                while current_num + 1 in nums_set:
                    current_num += 1
                    current_length += 1
                
                max_length = max(max_length, current_length)
        
        return max_length


if __name__ == '__main__':
    nums = [100,4,200,1,3,2]
    s = Solution()
    print(s.longestConsecutive(nums))

    nums2 = [0,3,7,2,5,8,4,6,0,1]
    print(s.longestConsecutive(nums2))
    
