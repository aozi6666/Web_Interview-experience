"""给定一个二叉树的根节点 root ，返回 它的 中序 遍历 。

示例：
#     1
#      \
#       2
#      /
#     3
输入：root = [1,null,2,3]
输出：[1,3,2]
"""
from collections import deque


class TreeNode(object):
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right


class Solution(object):
    def inorderTraversal(self, root):
        # 空树
        if not root:
            return []

        res = []

        def inorder(node):
            if node:
                inorder(node.left)
                res.append(node.val)
                inorder(node.right)

        inorder(root)
        return res


# 构建树的辅助函数
def build_tree_from_list(data):
    if not data:
        return None

    root = TreeNode(data[0])
    queue = deque([root])
    index = 1

    while queue and index < len(data):
        node = queue.popleft()
        if node:
            # 左子节点
            if index < len(data):
                left_val = data[index]
                if left_val is not None:
                    node.left = TreeNode(left_val)
                queue.append(node.left)
                index += 1
            # 右子节点
            if index < len(data):
                right_val = data[index]
                if right_val is not None:
                    node.right = TreeNode(right_val)
                queue.append(node.right)
                index += 1

    return root


if __name__ == '__main__':
    root = [1, None, 2, 3]
    root = build_tree_from_list(root)
    solution = Solution()
    print(solution.inorderTraversal(root))

