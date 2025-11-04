"""
给你一个整数数组 nums ，请你找出一个具有最大和的连续子数组（子数组最少包含一个元素），返回其最大和。

子数组是数组中的一个连续部分。

 
示例 1：

输入：nums = [-2,1,-3,4,-1,2,1,-5,4]
输出：6
解释：连续子数组 [4,-1,2,1] 的和最大，为 6 。
示例 2：

输入：nums = [1]
输出：1
示例 3：

输入：nums = [5,4,-1,7,8]
输出：23

"""

class Solution(object):
    def maxSubArray(self, nums):
        max_sum = nums[0]
        current_sum = nums[0]

        for num in nums[1:]:
            current_sum = max(num, current_sum + num)
            max_sum = max(max_sum, current_sum)
        return max_sum
    

# 测试
if __name__ == '__main__':

    solution = Solution()
    
    nums1 = [-2, 1, -3, 4, -1, 2, 1, -5, 4]
    print(solution.maxSubArray(nums1))  

    sum2 = [5,4,-1,7,8]
    print(solution.maxSubArray(sum2))

    sum3 = [1]
    print(solution.maxSubArray(sum3))

"""
解题思路：
1. 初始化 max_sum 和 current_sum 为数组的第一个元素。

2.遍历数组中剩下的元素，对于每一个 num：

  2.1 要么选择将其加入之前的子数组（即 current_sum + num），


  2.2 要么重新开始一个新的子数组（即从当前 num 开始），

  2.3 取较大的作为新的 current_sum。

  2.4同时更新全局最大值 max_sum。
"""