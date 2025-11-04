"""
给定整数数组 nums 和整数 k，请返回数组中第 k 个最大的元素。

请注意，你需要找的是数组排序后的第 k 个最大的元素，而不是第 k 个不同的元素。

你必须设计并实现时间复杂度为 O(n) 的算法解决此问题。

 

示例 1:

输入: [3,2,1,5,6,4], k = 2
输出: 5
示例 2:

输入: [3,2,3,1,2,4,5,5,6], k = 4
输出: 4
"""

# heapq最小堆模块, 自动维护最小堆的性质
import heapq
from typing import List

class Solution(object):
    def findKthLargest(self, nums: List[int], k: int) -> int:

        # 建立一个最小堆，最终大小为 k
        min_heap = []

        for num in nums:

            # 建堆, 把所有元素加入最小堆
            heapq.heappush(min_heap, num)

            # 让 n-k 个最小值出堆，最终堆：k个最大元素，第k大的在堆顶
            # 如果堆大小超过 k，就移除最小的元素
            if len(min_heap) > k:
                heapq.heappop(min_heap)
            
        return min_heap[0]

if __name__ == '__main__':
    solution = Solution()

    nums = [3,2,3,1,2,4,5,5,6]
    k = 4

    print(solution.findKthLargest(nums, k))


