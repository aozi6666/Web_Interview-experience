"""
给定一个不含重复数字的数组 nums ，返回其 所有可能的全排列 。
你可以 按任意顺序 返回答案。

示例 1：

输入：nums = [1,2,3]
输出：[[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]]
示例 2：

输入：nums = [0,1]
输出：[[0,1],[1,0]]
示例 3：

输入：nums = [1]
输出：[[1]]
"""
from typing import List

class Solution(object):
    def permute(self, nums: List[int]) -> List[List[int]]:

        # 存储所有排列结果
        res = []

        def backtrack(path: List[int], used: List[bool]):
             print(f"进入递归：path={path}, used={used}")

             # 如果当前路径长度等于 nums 长度，说明找到一个完整排列
             if len(nums) == len(path):
                 print(f"找到完整排列：{path}")
                 res.append(path[:])
                 return
                 
             for i in range(len(nums)):
                 
                 # 如果该元素已经使用过，跳过
                 if used[i]:
                     continue
                 
                 # 做选择
                 path.append(nums[i])
                 used[i] = True
                 print(f"选择元素 nums[{i}] = {nums[i]} -> path={path}")

                 # 进入下一层递归
                 backtrack(path, used)

                 # 撤销选择（回溯）
                 removed = path.pop()
                 used[i] = False
                 print(f"撤销选择 nums[{i}] = {removed} -> path={path}")


        # 初始化递归
        backtrack([], [False] * len(nums))

        return res

if __name__ == '__main__':
    solution = Solution()

    nums_1 = [1, 2, 3]
    print(solution.permute(nums_1))

                 
            




