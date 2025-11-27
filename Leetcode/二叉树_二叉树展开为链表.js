// 给你二叉树的根结点 root ，请你将它展开为一个单链表：

// 展开后的单链表应该同样使用 TreeNode ，其中 right 子指针指向链表中下一个结点，而左子指针始终为 null 。
// 展开后的单链表应该与二叉树 先序遍历 顺序相同。
// 示例 1：


// 输入：root = [1,2,5,3,4,null,6]
// 输出：[1,null,2,null,3,null,4,null,5,null,6]
// 示例 2：

// 输入：root = []
// 输出：[]

// 示例 3：

// 输入：root = [0]
// 输出：[0]

function Treenode(val, left, right) {
    this.val = val === undefined ? 0 : val;
    this.left = left === undefined ? null : left;
    this.right = right === undefined ? null : right;
}

// 递归深度优先 + 递归
var flateen = function (root) {
    // 树展平
    function flatenTree(node) {
        if (!node) return null;

        // 没有 左右节点 返回当前节点
        if(!node.left && !node.right) return node;
        
        // 获取左子树的 尾部（递归函数最后返回 rightTail）
        let leftTail = flatenTree(node.left);
        let rightTail = flatenTree(node.right);

        // 如果有 左子树， 连接左子树 的尾部 和 右子树
        if(node.left) {
            // 关键：左子树的尾巴 后边连上 原右子树
            leftTail.right = node.right;
            // 左子树 迁移到 节点右子树第一个
            node.right = node.left;
            // 节点 左子树 置空
            node.left = null;  
        }

        // 递归返回：尾部（右子树的尾部 或者 展平后的左子树的尾部）
        return rightTail ? rightTail : leftTail;
    }

    // 递归调用
    flatenTree(root);
}

// 辅助函数：将树转换为数组形式（用于查看结果）
function treeToArray(root) {
    if (!root) return [];
    let result = [];
    let node = root;
    while (node) {
        result.push(node.val);
        node = node.right;
    }
    return result;
}

let root_1 = new Treenode(
    1,
    new Treenode(
        2,
        new Treenode(3),
        new Treenode(4)
    ),
    new Treenode(5, null, new Treenode(6))
);
flateen(root_1);
console.log('示例1:', treeToArray(root_1));  // 输出: [1,2,3,4,5,6]

let root_2 = null;  // 空树
flateen(root_2);
console.log('示例2:', treeToArray(root_2));  // 输出: []

let root_3 = new Treenode(0);
flateen(root_3);
console.log('示例3:', treeToArray(root_3));  // 输出: [0]