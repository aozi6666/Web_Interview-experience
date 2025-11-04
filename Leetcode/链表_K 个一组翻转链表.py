"""
给你链表的头节点 head ，每 k 个节点一组进行翻转，请你返回修改后的链表。

k 是一个正整数，它的值小于或等于链表的长度。如果节点总数不是 k 的整数倍，那么请将最后剩余的节点保持原有顺序。

你不能只是单纯的改变节点内部的值，而是需要实际进行节点交换。

示例 1：

输入：head = [1,2,3,4,5], k = 2
输出：[2,1,4,3,5]

示例 2：

输入：head = [1,2,3,4,5], k = 3
输出：[3,2,1,4,5]

"""
from typing import Optional

class ListNode():
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next


class Solution(object):
    def reverseKGroup(self, head: Optional[ListNode], k: int) -> Optional[ListNode]:
        
        # （边界）空链表 or 只包含一个节点的链表，返回原链表
        if not head or not head.next or k <= 1:
            return head
        
        # 核查剩余链表中有 k 个节点可以翻转
        cur = head
        count = 0

        while cur and count < k:
            cur = cur.next
            count += 1
        # 不足k个，拼接原数组
        if count < k:
            return head
        
        # 翻转前 k 个节点
        prev = None
        cur = head

        # 循环，逐步翻转每个
        for _ in range(k):
            nxt = cur.next
            cur.next = prev
            prev = cur 
            cur = nxt
        

        # head 现在是翻转后这组的尾部，连接下一段递归
        head.next = self.reverseKGroup(cur, k)

        return prev # prev 是翻转后的新头
    

def build_linked_list(vals):
    dummy = ListNode(0)
    cur = dummy
    for v in vals:
        cur.next = ListNode(v)
        cur = cur.next
    return dummy.next

def print_linked_list(head):
    while head:
        print(head.val, end=' -> ' if head.next else '\n')
        head = head.next

# 测试用例
if __name__ == '__main__':
    head = build_linked_list([1, 2, 3, 4, 5])
    solution = Solution()
    new_head = solution.reverseKGroup(head, 2)
    print_linked_list(new_head)



