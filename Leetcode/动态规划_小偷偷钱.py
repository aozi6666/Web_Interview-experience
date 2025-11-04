"""
你是一个专业的小偷，计划偷窃沿街的房屋。每间房内都藏有一定的现金，
影响你偷窃的唯一制约因素就是相邻的房屋装有相互连通的防盗系统，
如果两间相邻的房屋在同一晚上被小偷闯入，系统会自动报警。

给定一个代表每个房屋存放金额的非负整数数组，计算你 不触动警报装置的情况下 ，一夜之内能够偷窃到的最高金额。

 
示例 1：

输入：[1,2,3,1]
输出：4
解释：偷窃 1 号房屋 (金额 = 1) ，然后偷窃 3 号房屋 (金额 = 3)。
     偷窃到的最高金额 = 1 + 3 = 4 。

示例 2：

输入：[2,7,9,3,1]
输出：12
解释：偷窃 1 号房屋 (金额 = 2), 偷窃 3 号房屋 (金额 = 9)，接着偷窃 5 号房屋 (金额 = 1)。
     偷窃到的最高金额 = 2 + 9 + 1 = 12 。

"""
from typing import List

class Solution(object):
    def robHome(self, nums: List[int]) -> int:

        # 初始化
        n = len(nums)

        # dp[i] 表示偷前 i + 1 个房子的最大金额
        dp = [0] * n

        dp[0] = nums[0]
        dp[1] = max(nums[0], nums[1])

        # 空数组，偷不到钱
        if n == 0:
            return 0
        
        # 数组只有一个元素，只能偷第一家
        elif n == 1:
            return nums[0]
        
        # 数组只有一个元素，只能偷最大的那家
        elif n == 2:
            return max(nums[0], nums[1])
        
        # 遍历随后的数
        for i in range(2, n):
            # 对于第 i 个房子，有两种选择：
            # 1. 不偷它，最大值是 dp[i-1]
            # 2. 偷它，最大值是 dp[i-2] + nums[i]
            dp[i] = max(dp[i-1], dp[i-2] + nums[i])
        
        return dp[-1]
    
if __name__ == '__main__':
    solution = Solution()

    num_1 = [1,2,3,1]
    print(solution.robHome(num_1))

    num_2 = [2,7,9,3,1]
    print(solution.robHome(num_2))

        


        

        

