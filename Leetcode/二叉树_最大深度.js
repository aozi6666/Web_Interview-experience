/*
 * @lc app=leetcode.cn id=104 lang=javascript
 * @lcpr version=30402
 *
 * [104] 二叉树的最大深度
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
 * @return {number}
 */
var maxDepth = function(root) {
    let reslut = 0;
    let depth = 0;

    // 空树
    if(!root) return 0;

    function traverse(node) {
        if(!node) return;

        // 前序
        depth++;
        // 到底部叶子节点，更新最大值
        if(!node.left && !node.right){
            reslut = Math.max(reslut, depth);
        }
        // 递归
        traverse(node.left);
        traverse(node.right);

        // 后序一定要 减 depth 恢复
        depth--;
    }

    traverse(root);
    return reslut;
};
// @lc code=end



/*
// @lcpr case=start
// [3,9,20,null,null,15,7]\n
// @lcpr case=end

// @lcpr case=start
// [1,null,2]\n
// @lcpr case=end

 */

