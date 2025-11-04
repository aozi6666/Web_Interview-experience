"""
给你一个链表，删除链表的倒数第 n 个结点，并且返回链表的头结点。

示例 1：

输入：head = [1,2,3,4,5], n = 2
输出：[1,2,3,5]

示例 2：

输入：head = [1], n = 1
输出：[]

示例 3：

输入：head = [1,2], n = 1
输出：[1]
"""
from typing import Optional

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next


class Solution(object):
    def removeNthFromEnd(self, head:Optional[ListNode], n:int) -> Optional[ListNode]:
        dummy = ListNode(0) # 头部虚拟节点
        dummy.next = head

        fast = dummy
        slow = dummy

        # fast 先走 n+1 步，这样 slow fast 之间的间隔就是待删除节点
        for _ in range(n+1):
            fast = fast.next

        # fast 和 slow 一起走，直到 fast 到达末尾
        while fast:
            fast = fast.next
            slow = slow.next
        
        # 删除 slow 后面的节点
        slow.next = slow.next.next

        return dummy.next

def build_linked_list(values):
    head = ListNode(values[0])
    current = head
    for v in values[1:]:
        current.next = ListNode(v)
        current = current.next
    return head

def print_linked_list(head):
    while head:
        print(head.val, end=" -> " if head.next else "\n")
        head = head.next

if __name__ == '__main__':
    head = build_linked_list([1, 2, 3, 4, 5])
    n = 2
    solution = Solution()
    new_head = solution.removeNthFromEnd(head, n)
    print_linked_list(new_head)

        
