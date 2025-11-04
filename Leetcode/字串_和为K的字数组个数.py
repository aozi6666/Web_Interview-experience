"""
给你一个整数数组 nums 和一个整数 k ，请你统计并返回 该数组中和为 k 的子数组的个数 。

子数组是数组中元素的连续非空序列。

 

示例 1：

输入：nums = [1,1,1], k = 2
输出：2
示例 2：

输入：nums = [1,2,3], k = 3
输出：2
 
"""
class Solution(object):
    def subarraySum(self, nums, k):
       
       from collections import defaultdict

       count = 0 # 记录和为k的子数组个数
       prefix_sum = 0 # 前缀和
       pre_dict = defaultdict(int) # 记录前缀和出现的次数
       pre_dict[0] = 1 # 初始化前缀和为0的次数为1

       for num in nums:
           
           prefix_sum += num

           if (prefix_sum - k) in pre_dict:
               count += pre_dict[prefix_sum - k]
            
           pre_dict[prefix_sum] += 1 # 更新前缀和出现的次数
        
       return count # 返回和为k的子数组个数
    
if __name__ == '__main__':
    nums = [1,1,1]
    k = 2
    print(Solution().subarraySum(nums,k))

    nums2 = [1,2,3]
    k2 = 3
    print(Solution().subarraySum(nums2,k2))

"""
defaultdict(int)创建一个默认值为 0 的字典
《==》 pre_dict = defaultdict(lambda: 0)

在 Python 中，defaultdict 是 collections 模块提供的一个特殊字典，
它在你访问一个不存在的键时，不会抛出 KeyError，而是自动创建一个默认值0。
"""