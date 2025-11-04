"""
给定一个只包括 '('  ')' '{' '}' '[' ']' 的字符串 s ，判断字符串是否有效。

有效字符串需满足：

1. 左括号必须用相同类型的右括号闭合。
2. 左括号必须以正确的顺序闭合。
3. 每个右括号都有一个对应的相同类型的左括号。

示例 1：
输入：s = "()"
输出：true

示例 2：
输入：s = "()[]{}"
输出：true

示例 3：
输入：s = "(]"
输出：false

示例 4：
输入：s = "([])"
输出：true
"""
class Solution(object):
    def isValid(self, s: str) -> bool:

        # 初始化，栈：存放左括号
        stack = [] 

        # 字典：每一个 右括号 映射到它对应的 左括号
        mapping = {']': '[',
                   '}': '{',
                   ')': '('
                   }
        
        for char in s:

            # 匹配到右括号，比对左括号
            if char in mapping:
                # 取栈顶元素，栈为空弹出“#”
                if stack:
                    top_element = stack.pop()
                else:
                    top_element = '#'
                
                # 取 右括号字典中应该对应的左括号
                # 如果匹配不上，说明不是有效的括号
                if mapping[char] != top_element:
                    return False
                
            # 匹配到左括号，入栈  
            else:
                stack.append(char)

        # 判断栈是否为空
        if len(stack) == 0:
            return True
        else:
            return False

if __name__ == '__main__':
    solution = Solution()

    s1 = "()[]{}"
    print(solution.isValid(s1))

    s2 = "(]"
    print(solution.isValid(s2))



