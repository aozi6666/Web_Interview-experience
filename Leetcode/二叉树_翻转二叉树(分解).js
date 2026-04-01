/*
 * @lc app=leetcode.cn id=226 lang=javascript
 * @lcpr version=30402
 *
 * [226] 翻转二叉树
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
 * @return {TreeNode}
 */
var invertTree = function(root) {
    // 边界判断：
    if(!root) return null;

    function traverse(node){
        if(!node) return;

        // 递归翻转 左右子树
        left = traverse(node.left);
        right = traverse(node.right);

        // 开始翻转节点
        node.right = left;
        node.left = right;
        
        return node;
    }
    return traverse(root);
};
// @lc code=end



/*
// @lcpr case=start
// [4,2,7,1,3,6,9]\n
// @lcpr case=end

// @lcpr case=start
// [2,1,3]\n
// @lcpr case=end

// @lcpr case=start
// []\n
// @lcpr case=end

 */

