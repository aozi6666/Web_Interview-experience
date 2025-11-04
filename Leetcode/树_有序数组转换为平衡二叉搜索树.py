"""
给你一个整数数组 nums ，其中元素已经按 升序 排列，
请你将其转换为一棵 平衡 二叉搜索树。

示例1：
#         0
#       /   \
#     -3     9
#    /      /
#  -10     5
输入：nums = [-10,-3,0,5,9]
输出：[0,-3,9,-10,null,5]

解释：[0,-10,5,null,-3,null,9] 也将被视为正确答案：
#         0
#       /   \
#     -10     5
#       \      \
#       -3      9

示例2：
#        3          1
#       /            \
#      1              3
输入：nums = [1,3]
输出：[3,1]
解释：[1,null,3] 和 [3,1] 都是高度平衡二叉搜索树。
"""


# Definition for a binary tree node.
from collections import deque


class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right


# 主功能：将有序数组转换为高度平衡的二叉搜索树
class Solution:
    def sortedArrayToBST(self, nums):

        # 数组为空，返回空树
        if not nums:
            return None

        # 取中间元素作为根节点
        mid = len(nums) // 2
        root = TreeNode(nums[mid])

        # 递归构建左右子树
        root.left = self.sortedArrayToBST(nums[:mid])
        root.right = self.sortedArrayToBST(nums[mid+1:])

        return root


# 工具函数：中序遍历打印树的值
def print_inorder(node):
    if node:
        print_inorder(node.left)
        print(node.val, end=" ")
        print_inorder(node.right)


# 工具函数：将 BST 转为层序列表格式（LeetCode 输出格式）
def tree_to_list_level_order(root):
    if not root:
        return []

    result = []
    queue = deque([root])

    while queue:
        node = queue.popleft()
        if node:
            result.append(node.val)
            queue.append(node.left)
            queue.append(node.right)
        else:
            result.append(None)

    # 去除尾部多余的 None
    while result and result[-1] is None:
        result.pop()

    return result


# 示例测试
if __name__ == '__main__':
    solution = Solution()
    nums = [-10, -3, 0, 5, 9]
    tree_root = solution.sortedArrayToBST(nums)

    print("中序遍历：", end="")
    print_inorder(tree_root)
    print()

    level_order_result = tree_to_list_level_order(tree_root)
    print("层序格式输出：", level_order_result)
