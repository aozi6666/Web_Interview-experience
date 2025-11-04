"""
给定一个整数数组 nums 和一个整数目标值 target，请你在该数组中找出 和为目标值 target  的那 两个 整数，
并返回它们的数组下标。

你可以假设每种输入只会对应一个答案，并且你不能使用两次相同的元素。
你可以按任意顺序返回答案。

示例 1：

输入：nums = [2,7,11,15], target = 9
输出：[0,1]
解释：因为 nums[0] + nums[1] == 9 ，返回 [0, 1] 。
"""


# 哈希表
class Solution(object):
    def twoSum(self, nums, target):
        for i in range(len(nums)):
            compand = target - nums[i]
            for j in range(i+1, len(nums)):
                if nums[j] == compand:
                    return [i ,j]




nums = [2, 7, 11, 15]
target = 22
solution = Solution()
print(solution.twoSum(nums, target))
