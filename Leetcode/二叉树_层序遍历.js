/*
 * @lc app=leetcode.cn id=102 lang=javascript
 * @lcpr version=30401
 *
 * [102] 二叉树的层序遍历
 */

// @lc code=start
/**
 * Definition for a binary tree node.
 * function TreeNode(val, left, right) {
 *     this.val = (val===undefined ? 0 : val)
 *     this.left = (left===undefined ? null : left)
 *     this.right = (right===undefined ? null : right)
 * }
 */
/**
 * @param {TreeNode} root
 * @return {number[][]}
 */


/* 二叉树节点定义*/
class TreeNode {
    constructor(val){
        this.val = val;
        this.left = null;
        this.right = null;
    }
}
// 层序遍历本质： 广度优先搜素（BFS）-- 依靠队列（先进先出）
var levelOrderTraverse = function(root) {
    // 边界：空树
    if(root === null){
        return;
    }

    // 初始化队列： 实现BFS关键
    const queue = [];
    // 根节点/当前节点 入队列
    queue.push(root);

    // 记录当前遍历到的层数(根节点 为 第 1 层)
    let depth = 1;

    // 结果数组
    const reslut = [];

    // whie循环（只处理当前层）外层 while 管“一层一层往下走”
    // while开始时，此刻队列里这些节点，正好就是当前层全部节点。
    // 遍历当前层时，会不断把下一层节点 push 进队列。
    // 队列长度会变，如果你直接拿 q.size() 或 queue.length 当循环条件，
    // 就会把下一层也一起处理掉，层就乱了。
    while(queue.length !== 0){
        // 记录 当前层 的节点个数
        let levelSize = queue.length;
        // 收集这一层的 结果数组
        const curLeverRes = [];

        // for 循环： 处理 这一层
        // 这一轮结束后，队列里剩下的，就全是下一层的节点了
        for(let i = 0;  i < levelSize; i++){
            // 只在这一层：取出节点元素
            let curNode = queue.shift();
            // (访问)加入这一层的结果数组
            curLeverRes.push(curNode.val);

            // 将当前节点的 左/右 节点加入队列
            if(curNode.left !== null){
                queue.push(curNode.left);
            }
            if(curNode.right !== null){
                queue.push(curNode.rihgt);
            }
        }

        // 将这一层结果，存入总结果数组
        reslut.push(curLeverRes);
        // 这一层处理完了，层数 + 1
        depth += 1;
    }

    return reslut;
};
// @lc code=end



/*
// @lcpr case=start
// [3,9,20,null,null,15,7]\n
// @lcpr case=end

// @lcpr case=start
// [1]\n
// @lcpr case=end

// @lcpr case=start
// []\n
// @lcpr case=end

 */

