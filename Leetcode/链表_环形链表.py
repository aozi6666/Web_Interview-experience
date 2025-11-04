"""
给你一个链表的头节点 head ，判断链表中是否有环。

如果链表中有某个节点，可以通过连续跟踪 next 指针再次到达，则链表中存在环。 为了表示给定链表中的环，评测系统内部使用整数 pos 来表示链表尾连接到链表中的位置（索引从 0 开始）。注意：pos 不作为参数进行传递 。仅仅是为了标识链表的实际情况。

如果链表中存在环 ，则返回 true 。 否则，返回 false 。

示例 1：
输入：head = [3,2,0,-4], pos = 1

3 -> 2 -> 0 -> -4
     ^         |
     |_________|

输出：true
解释：链表中有一个环，其尾部连接到第二个节点。

示例 2：

输入：head = [1,2], pos = 0

2 -> 1 
^    |
|____|

输出：true
解释：链表中有一个环，其尾部连接到第一个节点。

"""
from typing import Optional

# 定义链表节点类
class ListNode:
    def __init__(self, val: int, next: Optional['ListNode'] = None):
        self.val = val
        self.next = next

# 判断链表是否存在环的解决方案
class Solution:
    def hasCycle(self, head: Optional[ListNode]) -> bool:
        slow = fast = head
        while fast and fast.next:
            slow = slow.next
            fast = fast.next.next
            if slow == fast:
                return True
        return False

# 构建带环链表
def build_cycle_linked_list(values, pos):
    """
    values: List[int] - 链表节点值
    pos: int - 环的起始位置（索引），-1 表示无环
    """
    if not values:
        return None

    head = ListNode(values[0])
    current = head
    cycle_entry = head if pos == 0 else None
    nodes = [head]

    for i in range(1, len(values)):
        node = ListNode(values[i])
        current.next = node
        current = node
        nodes.append(node)
        if i == pos:
            cycle_entry = node

    if pos != -1:
        current.next = cycle_entry  # 构造环

    return head

# 安全打印链表，防止无限循环
def print_linked_list(head: Optional[ListNode], limit=20):
    count = 0
    print("链表结构（前 {} 个节点）:".format(limit))
    while head and count < limit:
        print(head.val, end=" -> ")
        head = head.next
        count += 1
    if head:
        print("...")
    else:
        print("None")

# 主函数
if __name__ == '__main__':
    # 示例：head = [3, 2, 0, -4], pos = 1
    values = [3, 2, 0, -4]
    pos = 1  # 表示最后一个节点 -4 指向值为 2 的节点（索引 1）

    head = build_cycle_linked_list(values, pos)

    # 打印链表结构（前若干个节点）
    print_linked_list(head)

    # 调用判断方法
    sol = Solution()
    result = sol.hasCycle(head)

    # 打印结果
    print("\n链表中是否有环？", result)
