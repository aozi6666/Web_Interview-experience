"""
给定一个链表的头节点  head ，返回链表开始入环的第一个节点。 如果链表无环，则返回 null。

如果链表中有某个节点，可以通过连续跟踪 next 指针再次到达，则链表中存在环。 
为了表示给定链表中的环，评测系统内部使用整数 pos 来表示链表尾连接到链表中的位置（索引从 0 开始）。
如果 pos 是 -1，则在该链表中没有环。注意：pos 不作为参数进行传递，仅仅是为了标识链表的实际情况。

不允许修改 链表。

示例 1：

3 -> 2 -> 0 -> -4
     ^         |
     |_________|


输入：head = [3,2,0,-4], pos = 1
输出：返回索引为 1 的链表节点
解释：链表中有一个环，其尾部连接到第二个节点。

示例 2：

2 -> 1 
^    |
|____|

输入：head = [1,2], pos = 0
输出：返回索引为 0 的链表节点
解释：链表中有一个环，其尾部连接到第一个节点。

"""
from typing import Optional

class ListNode():
    def __init__(self, val: int, next: Optional['ListNode'] = None):
        self.val = val
        self.next = next
    
class Solution(object):
    def detectCycle(self, head:Optional[ListNode]) -> Optional[ListNode]:

        slow = fast = head

        # 第一步：快慢指针相遇，判断是否有环
        while fast and fast.next:
            slow = slow.next
            fast = fast.next.next
            if fast.val == slow.val:
                break

        # 无环，返回 None
        else: 
            return None
        
        # 第二步：从头和相遇点分别出发，一步一步走，相遇点即为入环节点
        prt_1 = head
        prt_2 = slow

        while prt_1.val != prt_2.val:
            prt_1 = prt_1.next
            prt_2 = prt_2.next
        
        return prt_1
        

# 构建带环链表
def build_cycle_linked_list(values, pos):
    """
    :param values: List[int]，链表的节点值
    :param pos: int，环的起始位置（索引），-1 表示无环
    :return: 链表头结点
    """
    if not values:
        return None

    head = ListNode(values[0])
    current = head
    nodes = [head]

    for val in values[1:]:
        node = ListNode(val)
        current.next = node
        current = node
        nodes.append(node)

    if pos != -1:
        current.next = nodes[pos]  # 构造环

    return head

# 安全打印链表（避免死循环）
def print_linked_list(head, limit=20):
    print("链表结构（限制最多打印 {} 个节点）:".format(limit))
    count = 0
    while head and count < limit:
        print(head.val, end=" -> ")
        head = head.next
        count += 1
    if head:
        print("...")
    else:
        print("None")

# 测试入口
if __name__ == '__main__':
    # 示例：head = [3, 2, 0, -4], pos = 1
    values = [3, 2, 0, -4]
    pos = 1  # 表示 -4 指向值为 2 的节点，形成环

    head = build_cycle_linked_list(values, pos)

    print_linked_list(head)

    sol = Solution()
    entry_node = sol.detectCycle(head)

    if entry_node:
        print(f"\n链表中存在环，入环节点的值是：{entry_node.val}")
    else:
        print("\n链表中没有环。")
