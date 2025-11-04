"""
给定一个整数数组 nums，将数组中的元素向右轮转 k 个位置，其中 k 是非负数。

 

示例 1:

输入: nums = [1,2,3,4,5,6,7], k = 3
输出: [5,6,7,1,2,3,4]
解释:
向右轮转 1 步: [7,1,2,3,4,5,6]
向右轮转 2 步: [6,7,1,2,3,4,5]
向右轮转 3 步: [5,6,7,1,2,3,4]
示例 2:

输入：nums = [-1,-100,3,99], k = 2
输出：[3,99,-1,-100]
解释: 
向右轮转 1 步: [99,-1,-100,3]
向右轮转 2 步: [3,99,-1,-100]

"""
class Solution(object):
    def rotate(self, nums, k):
        n = len(nums)
        k = k % n

        # 反转函数
        def resverse(start, end):
            while start < end:
                nums[start], nums[end] = nums[end], nums[start]
                start += 1
                end -= 1
            
        
        resverse(0, n-1)  # 反转整个数组
        resverse(0, k-1)  # 反转前 k 个元素
        resverse(k, n-1) # 反转后 n-k 个元素


if __name__ == '__main__':
    nums = [1, 2, 3, 4, 5, 6, 7]
    k = 3
    solution = Solution()
    solution.rotate(nums, k)
    print(nums)

    nums2 = [-1, -100, 3, 99]
    k2 = 2
    solution.rotate(nums2, k2)
    print(nums2)
    
