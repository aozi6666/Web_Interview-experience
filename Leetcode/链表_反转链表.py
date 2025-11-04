"""
给你单链表的头节点 head ，请你反转链表，并返回反转后的链表。

示例 1：

输入：head = [1,2,3,4,5]
输出：[5,4,3,2,1]

示例 2：

输入：head = [1,2]
输出：[2,1]
"""
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next
    
class Solution(object):
    def resverseList(self, head:ListNode) -> ListNode:
        prev = None
        current = head

        while current:
            next_node = current.next  # 暂存当前节点的下一个节点
            current.next = prev  # 反转指针

            prev = current  # 更新前驱节点位置
            current = next_node  #更新当前节点位置 

        return prev


# 辅助函数：从列表构建链表
def build_linked_list(values):
    if not values:
        return None
    head = ListNode(values[0])
    current = head
    for v in values[1:]:
        current.next = ListNode(v)
        current = current.next
    return head

# 辅助函数：打印链表
def print_linked_list(head):
    result = []
    while head:
        result.append(head.val)
        head = head.next
    print(result)


if __name__=='__main__':
    # 原始链表数据
    values = [1, 2, 3, 4, 5]
    head = build_linked_list(values)

    # 创建 Solution 实例，调用反转方法
    solution = Solution()
    reversed_head = solution.resverseList(head)

    # 输出结果
    print_linked_list(reversed_head)
