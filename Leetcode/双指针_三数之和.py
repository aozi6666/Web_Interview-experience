"""
给你一个整数数组 nums ，判断是否存在三元组 [nums[i], nums[j], nums[k]] 满足 i != j、i != k 且 j != k ，
同时还满足 nums[i] + nums[j] + nums[k] == 0 。请你返回所有和为 0 且不重复的三元组。

注意：答案中不可以包含重复的三元组。

示例 1：

输入：nums = [-1,0,1,2,-1,-4]
输出：[[-1,-1,2],[-1,0,1]]
解释：
nums[0] + nums[1] + nums[2] = (-1) + 0 + 1 = 0 
nums[1] + nums[2] + nums[4] = 0 + 1 + (-1) = 0 
nums[0] + nums[3] + nums[4] = (-1) + 2 + (-1) = 0 
不同的三元组是 [-1,0,1] 和 [-1,-1,2] 
注意，输出的顺序和三元组的顺序并不重要

示例 2：

输入：nums = [0,1,1]
输出：[]
解释：唯一可能的三元组和不为 0 

示例 3：

输入：nums = [0,0,0]
输出：[[0,0,0]]
解释：唯一可能的三元组和为 0 
"""
from typing import List

class Solution(object):
    def threeSum(self, nums: List[int]) -> List[List[int]]:
        
        # 第一步：排序
        nums.sort()
        res = [] # 用于存储结果三元组的列表

        # 第二步：从头遍历每个元素
        for i in range(len(nums) - 2):

            # 跳过相同元素，重复的第二个数字
            if i > 0 and nums[i] == nums[i - 1]:
                continue
            
            # 初始化 两个 指针：寻找符合条件的元素
            left, right = i + 1, len(nums) - 1

            # 第三步： 遍历整个数组，找到符合想和为 0 的三个数
            while left < right:

                # 总计：
                total = nums[i] + nums[left] + nums[right]

                # 符合条件，加入到res中
                if total == 0:
                    res.append([nums[i], nums[left], nums[right]])

                    # 跳过相同元素，重复的第二个数字
                    while left < right and nums[left] == nums[left + 1]:
                        left += 1
                    # 跳过相同元素，重复的第二个数字
                    while left < right and nums[right] == nums[right - 1]:
                        right -= 1
                    
                    left += 1
                    right -= 1
                
                # 不符合条件，且为负数，移动左指针
                elif total < 0:
                    left += 1
                
                # 不符合条件，且为正数，移动右指针
                elif total > 0:
                    right -= 1
            
        return res


if __name__ == '__main__':
    solution = Solution()  # 创建 Solution 类的实例
    nums = [-1, 0, 1, 2, -1, -4]  # 输入的数组
    result = solution.threeSum(nums)  # 调用 threeSum 方法
    print(result)  # 输出结果

    num_2 = [0, 0, 0]
    result_2 = solution.threeSum(num_2)
    print(result_2)


    num_3 = [0, 1, 1]
    result_3 = solution.threeSum(num_3)
    print(result_3)
    