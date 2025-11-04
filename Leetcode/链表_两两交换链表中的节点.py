"""
给你一个链表，两两交换其中相邻的节点，并返回交换后链表的头节点。
你必须在不修改节点内部的值的情况下完成本题（即，只能进行节点交换）。

示例 1：

输入：head = [1,2,3,4]
输出：[2,1,4,3]

示例 2：

输入：head = []
输出：[]

示例 3：

输入：head = [1]
输出：[1]

"""
from typing import Optional

class ListNode():
    def __init__(self, val=0, next=None):
        self.val = val
        self.next  = next
    

class Solution(object):
    def swapPairs(self, head: Optional[ListNode]) -> Optional[ListNode]:
        dummy = ListNode(0)
        dummy.next = head
        prev = dummy

        while head and head.next:
            first = head
            second = head.next

            # 交换
            prev.next = second
            first.next = second.next
            second.next = first

            # 移动指针
            prev = first
            head = first.next
        
        return dummy.next

def build_linked_list(values):
    dummy = ListNode(0)
    current = dummy

    for v in values:
        current.next = ListNode(v)
        current = current.next
        
    return dummy.next

def print_linked_list(head):
    while head:
        print(head.val, end=' -> ' if head.next else '\n')
        head = head.next

# 测试用例
if __name__ == '__main__':
    head = build_linked_list([1, 2, 3, 4, 5, 6])

    solution = Solution()
    new_head = solution.swapPairs(head)
    print_linked_list(new_head)



        