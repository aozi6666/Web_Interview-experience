"""
给你一个整数数组 nums，返回 数组 answer ，其中 answer[i] 等于 nums 中除 nums[i] 之外其余各元素的乘积 。

题目数据 保证 数组 nums之中任意元素的全部前缀元素和后缀的乘积都在  32 位 整数范围内。

请 不要使用除法，且在 O(n) 时间复杂度内完成此题。

 
示例 1:

输入: nums = [1,2,3,4]
输出: [24,12,8,6]
示例 2:

输入: nums = [-1,1,0,-3,3]
输出: [0,0,9,0,0]
"""
# O（n ^ 2)
class Solution(object):
    def productExceptSelf(self, nums):
        """
        :type nums: List[int]
        :rtype: List[int]
        """

        answer = []
        for i in range(len(nums)):
            product = 1
            for j in range(len(nums)):
                if i != j:
                    product *= nums[j]
            
            answer.append(product)
            
        return answer

# O(n)
class Solution2(object):
    def productExceptSelf(self, nums):
        n = len(nums)
        answer = [1] * n

        # 左边乘积 --> 得到左乘积数组
        left = 1
        for i in range(n):
            answer[i] = left
            left *= nums[i]
        
        # 右边乘积（倒） --> 得到左右乘积数组
        right = 1
        for i in range(n-1, -1, -1):
            answer[i] *= right
            right *= nums[i]
        
        return answer

    

if __name__ == '__main__':
    nums = [1, 2, 3, 4]
    solution = Solution()
    print(solution.productExceptSelf(nums))

    nums = [-1, 1, -3, 3]
    solution2 = Solution2()
    print(solution2.productExceptSelf(nums))


    
    