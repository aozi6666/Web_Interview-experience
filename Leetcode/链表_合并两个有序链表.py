# Definition for singly-linked list.
class ListNode(object):
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next
        
class Solution(object):
    def mergeTwoLists(self, list1, list2):
        """
        :type list1: Optional[ListNode]
        :type list2: Optional[ListNode]
        :rtype: Optional[ListNode]
        """
        dummy = ListNode()  # 创建一个虚拟头节点
        current = dummy  # 尾指针

        while list1 and list2:  # 当两个链表都不为空时
            if list1.val < list2.val:  # 如果list1的值小于list2的值
                current.next = list1  # 将list1的节点连接到尾指针的后面
                list1 = list1.next  # list1指针向后移动
            else:  # 如果list2的值小于list1的值
                current.next = list2
                list2 = list2.next
        
            current = current.next
    
        # 拼接剩下的链表
        current.next = list1 if list1 else list2

        return dummy.next

    # 辅助函数：将数组转为链表
    def build_list(self, arr):
        dummy = ListNode()
        current = dummy
        for val in arr:
            current.next = ListNode(val)
            current = current.next
        return dummy.next

    # 辅助函数：打印链表
    def print_list(self, head):
        res = []
        while head:
            res.append(head.val)
            head = head.next
        print(res)

# 测试
list1 = [1, 2, 4]
list2 = [1, 3, 4]

solution = Solution()

l1 = solution.build_list(list1)
l2 = solution.build_list(list2)

merged = solution.mergeTwoLists(l1, l2)

solution.print_list(merged)   