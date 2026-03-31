/*
 * @lc app=leetcode.cn id=108 lang=javascript
 * @lcpr version=30402
 *
 * [108] 将有序数组转换为二叉搜索树
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
 * @param {number[]} nums
 * @return {TreeNode}
 */
function TreeNode(val, left, right){
    this.val = (val === undefined ? 0 : val);
    this.left = (left === undefined ? null : left);
    this.right = (right === undefined ? null : right);
}
var sortedArrayToBST = function(nums) {
    // 解题关键： 二叉搜素树的中序遍历为有序数组

    // 边界判断
    if(nums.length === 0) return null;
    // 左右指针
    let left = 0;
    let right = nums.length - 1;

    // 构造 二叉搜素树
    function buildBST(nums,left, right){
        // 数组元素不足
        if(left > right) return null;

        // 中间元素为根元素
        const mid = Math.floor((left + right) / 2);

        // 创建根节点
        const root = new TreeNode(nums[mid]);
        
        // 分别构建左子树和右子树
        root.left = buildBST(nums, left, mid - 1);
        root.right = buildBST(nums, mid + 1, right);
    }

    return buildBST(nums, left, right);
};
// @lc code=end



/*
// @lcpr case=start
// [-10,-3,0,5,9]\n
// @lcpr case=end

// @lcpr case=start
// [1,3]\n
// @lcpr case=end

 */

