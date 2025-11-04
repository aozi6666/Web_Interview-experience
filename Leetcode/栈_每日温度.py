"""
给定一个整数数组 temperatures ，表示每天的温度，返回一个数组 answer ，其中 answer[i] 是指对于第 i 天，下一个更高温度出现在几天后。如果气温在这之后都不会升高，请在该位置用 0 来代替。

 

示例 1:

输入: temperatures = [73,74,75,71,69,72,76,73]
输出: [1,1,4,2,1,1,0,0]
示例 2:

输入: temperatures = [30,40,50,60]
输出: [1,1,1,0]
示例 3:

输入: temperatures = [30,60,90]
输出: [1,1,0]
"""
class Solution(object):
    def dailyTemperatures(self, temperatures):
        n = len(temperatures)
        answer = [0] * n
        stack = []

        for i in range(n):
            print(f"\n第 {i} 天，温度 = {temperatures[i]}")
            print(f"  处理前栈内状态（存的是索引）: {stack}")

            while stack and temperatures[i] > temperatures[stack[-1]]:
                prev_day = stack.pop()
                answer[prev_day] = i - prev_day
                print(f"    找到第 {prev_day} 天更暖的一天 → 第 {i} 天")
                print(f"      温度：{temperatures[prev_day]}° → {temperatures[i]}°，等了 {i - prev_day} 天")
                print(f"      当前结果数组：{answer}")

            stack.append(i)
            print(f"  处理后栈内状态: {stack}")
            print(f"  当前结果数组：{answer}")

        return answer

s = Solution()
temps = [73, 74, 75, 71, 69, 72, 76, 73]
res = s.dailyTemperatures(temps)
print("\n最终结果：", res)
