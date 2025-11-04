"""
以数组 intervals 表示若干个区间的集合，其中单个区间为 intervals[i] = [starti, endi] 。
请你合并所有重叠的区间，并返回 一个不重叠的区间数组，该数组需恰好覆盖输入中的所有区间 。

示例 1：

输入：intervals = [[1,3],[2,6],[8,10],[15,18]]
输出：[[1,6],[8,10],[15,18]]
解释：区间 [1,3] 和 [2,6] 重叠, 将它们合并为 [1,6].
"""


class Solution(object):
    def merge(self, intervals):
        # 空值
        if not intervals:
            return []

        # 排序
        intervals.sort(key=lambda x: x[0])

        medged = [intervals[0]]
        for current in intervals[1:]:
            pre = medged[-1]

            # 有重叠，合并区间
            if current[0] <= pre[-1]:
                pre[-1] = max(pre[-1], current[-1])
            else:
                medged.append(current)

        return medged


# 测试
intervals = [[1, 3], [2, 6], [8, 10], [15, 18]]
solution = Solution()
print(solution.merge(intervals))

