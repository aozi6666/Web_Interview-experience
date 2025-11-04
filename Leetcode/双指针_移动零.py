"""
给定一个数组 nums，编写一个函数将所有 0 移动到数组的末尾，同时保持非零元素的相对顺序。

请注意 ，必须在不复制数组的情况下原地对数组进行操作。

示例 1:

输入: nums = [0,1,0,3,12]
输出: [1,3,12,0,0]
示例 2:

输入: nums = [0]
输出: [0]
"""
from typing import List

class Solution(object):
    def moveZeroes(self, nums: list[int]) -> None:
        # 指针记录零元素位置
        j = 0

        # 第一步：将非零元素排到前面
        for i in range(len(nums)):
            # 元素为0，移动
            if nums[i] != 0:
                nums[j] = nums[i]
                j += 1  # j 始终指向下一个可以放非零元素的位置
        
        # 第二步：将j后剩余元素置0
        for k in range(j, len(nums)):
            nums[k] = 0

# 主程序入口
if __name__=='__main__':
    solution = Solution()
    nums = [0,1,0,3,12]
    solution.moveZeroes(nums)
    print(nums)


