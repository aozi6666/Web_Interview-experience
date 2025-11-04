"""
给你两个单链表的头节点 headA 和 headB ，请你找出并返回两个单链表相交的起始节点。如果两个链表不存在相交节点，返回 null 。

图示两个链表在节点 c1 开始相交：

# 链表 A:
# a1 -> a2 \
#            \
#              -> c1 -> c2 -> c3
#             /
# b1 -> b2 -> b3
# 链表 B

题目数据 保证 整个链式结构中不存在环。

注意，函数返回结果后，链表必须 保持其原始结构 。


自定义评测：

评测系统 的输入如下（你设计的程序 不适用 此输入）：

intersectVal - 相交的起始节点的值。如果不存在相交节点，这一值为 0
listA - 第一个链表
listB - 第二个链表
skipA - 在 listA 中（从头节点开始）跳到交叉节点的节点数
skipB - 在 listB 中（从头节点开始）跳到交叉节点的节点数
评测系统将根据这些输入创建链式数据结构，并将两个头节点 headA 和 headB 传递给你的程序。
如果程序能够正确返回相交节点，那么你的解决方案将被 视作正确答案 。

示例 1：

# 链表 A:
#     4 -> 1 \
#              -> 8 -> 4 -> 5
#             /
# 5 -> 6 -> 1
# 链表 B

输入：intersectVal = 8, listA = [4,1,8,4,5], listB = [5,6,1,8,4,5], skipA = 2, skipB = 3
输出：Intersected at '8'
解释：相交节点的值为 8 （注意，如果两个链表相交则不能为 0）。
从各自的表头开始算起，链表 A 为 [4,1,8,4,5]，链表 B 为 [5,6,1,8,4,5]。
在 A 中，相交节点前有 2 个节点；在 B 中，相交节点前有 3 个节点。
— 请注意相交节点的值不为 1，因为在链表 A 和链表 B 之中值为 1 的节点 (A 中第二个节点和 B 中第三个节点) 是不同的节点。换句话说，它们在内存中指向两个不同的位置，而链表 A 和链表 B 中值为 8 的节点 (A 中第三个节点，B 中第四个节点) 在内存中指向相同的位置。

"""
from typing import Optional
class ListNode():
    def __init__(self, val: int, next: Optional['ListNode'] = None):
        self.val = val
        self.next = next
    
class Solution(object):
    def getIntersectionNode(self, headA: Optional[ListNode], HeadB: Optional[ListNode]) -> Optional[ListNode]:

        # 如有空链表，返回None
        if not headA or not HeadB:
            return None
        
        pA, pB = headA, HeadB
        while pA != pB:
            pA = pA.next if pA else HeadB
            pB = pB.next if pB else headA
        
        return pA

# 🔧 辅助函数：创建链表并返回头结点和列表中所有节点的引用
def create_linked_list(vals):
    head = ListNode(vals[0])
    current = head
    nodes = [head]
    for val in vals[1:]:
        node = ListNode(val)
        current.next = node
        current = node
        nodes.append(node)
    return head, nodes

# 🧪 模拟自定义评测
def test_custom_case(intersectVal, listA, listB, skipA, skipB):
    # 创建链表 A 和 B 的前半段
    headA, nodesA = create_linked_list(listA[:skipA])
    headB, nodesB = create_linked_list(listB[:skipB])
    
    # 如果有相交值，构造公共尾部链表
    if intersectVal != 0:
        intersectList, intersectNodes = create_linked_list(listA[skipA:])
        nodesA[-1].next = intersectList
        nodesB[-1].next = intersectList
    else:
        intersectNodes = []

    # 调用解法
    sol = Solution()
    intersection = sol.getIntersectionNode(headA, headB)
    
    # 输出结果
    if intersection:
        print(f"Intersected at '{intersection.val}'")
    else:
        print("No intersection")

# 🚀 测试用例
test_custom_case(
    intersectVal=8,
    listA=[4,1,8,4,5],
    listB=[5,6,1,8,4,5],
    skipA=2,
    skipB=3
)