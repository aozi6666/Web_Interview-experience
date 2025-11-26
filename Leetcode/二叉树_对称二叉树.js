// 给你一个二叉树的根节点 root ， 检查它是否轴对称。
// 示例 1：


// 输入：root = [1,2,2,3,4,4,3]
// 输出：true
// 示例 2：


// 输入：root = [1,2,2,null,3,null,3]
// 输出：false

// 数组 构造二叉树 函数
function TreeNode(val, left, right) {
    this.val = (val === undefined ? 0 : val);
    this.left = (left === undefined ? null : left);
    this.right = (right === undefined ? null : right);
}

var isSymmetric = function (root) {
    // 空树
    if(!root) return true;

    // 判断 同一层 左右是否 镜像对称 函数
    function isMirror(left, right) {
        // 两个都空--- 对称
        if (!left && !right) return true;

        // 一个空一个不空--- 不对称
        if(!left || !right) return false;

        // 值不等 -- 不对称
        if(left.val !== right.val) return false;


        // 递归判断:  (左子树的左节点 = 右子树的右节点 ) (左子树的右节点 = 右子树的左节点)
        return isMirror(left.left, right.right) && isMirror(left.right, right.left);
    }
    return isMirror(root.left, root.right);
}

let root_1 = new TreeNode(
    1,
    new TreeNode(2, new TreeNode(3), new TreeNode(4)),
    new TreeNode(2, new TreeNode(4), new TreeNode(3)),
);

let root_2 = new TreeNode(
    1,
    new TreeNode(2, null, new TreeNode(3)),
    new TreeNode(2, null, new TreeNode(3)),
);

console.log(isSymmetric(root_1));
console.log(isSymmetric(root_2));