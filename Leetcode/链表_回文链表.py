"""
给你一个单链表的头节点 head ，请你判断该链表是否为回文链表。如果是，返回 true ；否则，返回 false 。
回文链表：回文 序列是向前和向后读都相同的序列。

示例 1：

输入：head = [1,2,2,1]
输出：true

示例 2：

输入：head = [1,2]
输出：false

"""
from typing import Optional

# 定义单链表节点
class ListNode():
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next
    
class Solution(object):
    def isPalindrome(self, head:Optional[ListNode]) -> bool:
        
        # 快慢指针找到链表中点
        slow = head
        fast = head
        while fast and fast.next:
            slow = slow.next
            fast = fast.next.next

        # 反转后半段链表
        prev = None
        while slow:
            next_node = slow.next
            slow.next = prev
            prev = slow
            slow = next_node
        
        # 比较前半段和反转后的后半段
        left, right = head, prev
        
        while right:
            
            # 判断值是否相同
            if left.val != right.val:
                return False

            left = left.next
            right = right.next
        
        return True
    
# 工具函数：将列表转换为链表
def build_linked_list(values):
    if not values:
        return None
    head = ListNode(values[0])
    current = head
    for val in values[1:]:
        current.next = ListNode(val)
        current = current.next
    return head

# 工具函数：打印链表（可选）
def print_linked_list(head):
    values = []
    while head:
        values.append(str(head.val))
        head = head.next
    print(" -> ".join(values))

# 主函数入口
if __name__ == '__main__':
    # 测试输入
    input_list = [1, 2, 3, 3, 2, 1]
    head = build_linked_list(input_list)

    print("输入链表：")
    print_linked_list(head)

    # 创建 Solution 实例并调用函数
    sol = Solution()
    result = sol.isPalindrome(head)

    # 输出结果
    print("是否是回文链表？", result)
