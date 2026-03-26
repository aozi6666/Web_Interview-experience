/*
 * @lc app=leetcode.cn id=94 lang=javascript
 * @lcpr version=30401
 *
 * [94] 二叉树的中序遍历
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
 * @return {number[]}
 */
var inorderTraversal = function(root) {
    // 结果数组
    const res = [];

    // 空树
    if(!root){
        return;
    }

    function traverse(node){
        // 空节点
        if(!node){
            return;
        }

        // 中序遍历： 左 -> 根 -> 右
        traverse(node.left);
        res.push(node.val);
        traverse(node.right);
    }

    // 调用遍历函数
    traverse(root);

    return res;
    
};
// @lc code=end



/*
// @lcpr case=start
// [1,null,2,3]\n
// @lcpr case=end

// @lcpr case=start
// [1,2,3,4,5,null,8,null,null,6,7,9]\n
// @lcpr case=end

// @lcpr case=start
// []\n
// @lcpr case=end

// @lcpr case=start
// [1]\n
// @lcpr case=end

 */

