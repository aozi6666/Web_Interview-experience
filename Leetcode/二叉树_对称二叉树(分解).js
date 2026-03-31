/*
 * @lc app=leetcode.cn id=101 lang=javascript
 * @lcpr version=30402
 *
 * [101] 对称二叉树
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
 * @return {boolean}
 */
var isSymmetric = function(root) {
    // 边界判断：空树
    if(!root) return true;

    // 判断 同一层 左右是否 镜像对称 函数
    function isMirror(left, right) {
        if(left === null || right === null){
            return left === right;
        }
        // 值不同，不对称
        if(left.val !== right.val) return false;

        // 递归下一层
        return isMirror(left.left, right.left) && isMirror(left.right, right.right);
    }

    return isMirror(root.left, root.right);
};
// @lc code=end



/*
// @lcpr case=start
// [1,2,2,3,4,4,3]\n
// @lcpr case=end

// @lcpr case=start
// [1,2,2,null,3,null,3]\n
// @lcpr case=end

 */

