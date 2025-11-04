"""
给定一个非负整数 numRows，生成「杨辉三角」的前 numRows 行。
在「杨辉三角」中，每个数是它左上方和右上方的数的和。
"""


class Solution(object):
    def generate(self, numRows):
        res = []
        for i in range(numRows):
            row = [1] * (i+1)
            for j in range(1, i):
                row[j] = res[i-1][j-1] + res[i-1][j]

            res.append(row)
        return res


numRows = 5
solution = Solution()
print(solution.generate(numRows))

