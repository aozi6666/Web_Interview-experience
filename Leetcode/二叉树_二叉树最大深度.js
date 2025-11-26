// 给定一个二叉树 root ，返回其最大深度。

// 二叉树的 最大深度 是指从根节点到最远叶子节点的最长路径上的节点数。

// 示例 1：


// 输入：root = [3,9,20,null,null,15,7]
// 输出：3

// 示例 2：

// 输入：root = [1,null,2]
// 输出：2

// 解法1：递归
// 复杂度 时间复杂度：O(n) ßpace复杂度： O(h)（最坏 O(n)）
var maxDepth = function(root) {
    // 空树
    if(!root) return 0;

    // 左子树深度
    let left = maxDepth(root.left);

    // 右子树深度
    let right = maxDepth(root.right);

    // 当前深度 = 1 + 子树深度
    return 1 + Math.max(left, right) ;
}

// 解法2：BFS 层序遍历法（非递归） -- 队列
// 复杂度：时间复杂度 — O(n)； 空间复杂度 — O(w)（最坏 O(n)）
var max_depth = function(root) {
    // 空树
    if(!root) return 0;

    // 创建队列： 先进先出
    // shift() 出队列，push() 入队列
    let queue = [root];
    let depth = 0; // 层数

    // 层序遍历
    while(queue.length > 0){
        depth++; // 进入循环，层数加1
        let size = queue.length;  // 当前层的节点数

        for(let i = 0; i < size; i++) {
            let node = queue.shift(); // 弹出队列头部元素

            // 左子树
            if(node.left) queue.push(node.left);

            // 右子树
            if(node.right) queue.push(node.right);
        }
    }
    return depth;
}

// 数组构建 树结构 函数
function TreeNode(val, left, right) {
    this.val = (val === undefined ? 0 : val);
    this.left = (left === undefined ? null : left);
    this.right = (right === undefined ? null : right);
}

let tree_1 = new TreeNode(
    3,
    new TreeNode(9),
    new TreeNode(
        20,
        new TreeNode(15),
        new TreeNode(7),
    ),
);

let tree_2 = new TreeNode(
    1,
    null,
    new TreeNode(2),
)

console.log(maxDepth(tree_1));
console.log(maxDepth(tree_2));

console.log('****************')
console.log(max_depth(tree_1));
console.log(max_depth(tree_2));