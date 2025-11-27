// 给你一棵二叉树的根节点，返回该树的 直径 。

// 二叉树的 直径 是指树中任意两个节点之间最长路径的 长度 。
// 这条路径可能经过也可能不经过根节点 root 。

// 两节点之间路径的 长度 由它们之间边数表示。

 

// 示例 1：

// 输入：root = [1,2,3,4,5]
// 输出：3
// 解释：3 ，取路径 [4,2,1,3] 或 [5,2,1,3] 的长度

// 示例 2：

// 输入：root = [1,2]
// 输出：1

function TreeNode(val, left, right) {
    this.val = (val === undefined ? 0 : val);
    this.left = (left === undefined ? null : left);
    this.right = (right === undefined ? null : right);
}

// DFS: 深度优先搜索 + 递归
var diameterOfBinaryTree = function(root) {
    let maxDiameter = 0;  // 直径

    function depth(node) {
        // 空树/空节点
        if(!node) return 0;

        let left = depth(node.left);
        let right = depth(node.right);

        // 当前直径 = 左树高 +  右树高
        maxDiameter = Math.max(maxDiameter, left + right);

        // 当前节点的高度 1 + 子树最大高度
        return 1 + Math.max(left, right);
    }

    // 调用 depth 函数
    depth(root);
    
    return maxDiameter;
}

let root1 = new TreeNode(
    1,
    new TreeNode(
        2,
        new TreeNode(4),
        new TreeNode(5)
    ),
    new TreeNode(3)
);
console.log(diameterOfBinaryTree(root1));

let root2 = new TreeNode(
    1,
    new TreeNode(2)
);
console.log(diameterOfBinaryTree(root2));
