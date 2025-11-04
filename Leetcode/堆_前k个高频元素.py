"""
给你一个整数数组 nums 和一个整数 k ，
请你返回其中出现频率前 k 高的元素。你可以按 任意顺序 返回答案。

示例 1:
输入: nums = [1,1,1,2,2,3], k = 2
输出: [1,2]

示例 2:
输入: nums = [1], k = 1
输出: [1]

"""
from typing import List
from collections import Counter
import heapq

class Solution(object):
    def topKFrequent(self, nums: List[int], k: int) -> List[int]:
        """
        Counter 统计频率 的用法:
        Counter(nums) 遍历数组，统计每个元素的出现次数
        结果返回一个字典 freq_map = {1: 3, 2: 2, 3: 1}，
        表示元素 1 出现 3 次，2 出现 2 次，3 出现 1 次
        """

        # 统计每个数字出现的频率，返回字典
        frep_map = Counter(nums)

        # 建最小堆，堆中放入（-频率， 数值），用负数模拟最大堆
        heap = []
        for num, frep in frep_map.items():
            heapq.heappush(heap, (-frep, num))
        
        # 从堆中取出前 k 个元素（频率最高的 k 个）
        result = []
        for i in range(k):
            # heappop(heap)[1] 表示取元组的第二个值（即数值部分）
            result.append(heapq.heappop(heap)[1])

        return result

if __name__ == '__main__':
    solution = Solution()

    nums = [1,1,1,2,2,3]
    k = 2
    print(solution.topKFrequent(nums, k))

