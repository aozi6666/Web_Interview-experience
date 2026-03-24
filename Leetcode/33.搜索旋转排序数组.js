/*
 * @lc app=leetcode.cn id=33 lang=javascript
 * @lcpr version=30401
 *
 * [33] 搜索旋转排序数组
 */

// @lc code=start
/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number}
 */
var search = function(nums, target) {
    // 题目本质：二分查找（值） + 旋转有序数组
    // 空值
    if(nums.length === 0) return -1;

    // 初始化 左右指针
    let left = 0;
    let right = nums.length - 1;

    // 循环，二分查找
    while(left <= right){
        const mid = Math.floor((left + right) / 2);

        // 目标值得到，返回下标
        if(nums[mid] === target) return mid;

        // 1.判断 左半边有序
        if(nums[left] <= nums[mid]){
            // 1)判断 target 在 左半区域, right 指针左移
            if(nums[left] <= target && nums[mid] > target){
                // 移动 right 指针
                right = mid - 1;
            } else {
                // 2)target 不在 左半区域， left 指针右移
                left = mid + 1;
            }
        }
        // 2.判断：右半边有序
        else if(nums[right] > nums[mid]){
            // 1) 判断 target 在 右半区域， left 指针右移
            if(nums[mid] < right && nums[right] <= target) {
                left = mid + 1;
            } else {
                // 2) target 不在 右半区域， right 左移
                right = mid - 1;
            }
        }
    }

    // 没有结果，返回-1
    return -1;
};
// @lc code=end



/*
// @lcpr case=start
// [4,5,6,7,0,1,2]\n0\n
// @lcpr case=end

// @lcpr case=start
// [4,5,6,7,0,1,2]\n3\n
// @lcpr case=end

// @lcpr case=start
// [1]\n0\n
// @lcpr case=end

 */

