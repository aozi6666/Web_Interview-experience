/*
 * @lc app=leetcode.cn id=153 lang=javascript
 * @lcpr version=30401
 *
 * [153] 寻找旋转排序数组中的最小值
 */

// @lc code=start
/**
 * @param {number[]} nums
 * @return {number}
 */
var findMin = function(nums) {
    // 本质：二分查找（值） + 旋转数组
    // note: 需要不断更新 最小值
    
    // 初始化 左右指针 + 最终值
    let left = 0;
    let right = nums.length - 1;
    let ans = nums[left];

    // 循环
    while(left <= right) {
        // 1) 【左-右】有序 -> 直接更新最小值返回(跳出循环)
        if(nums[left] <= nums[right]){
            ans = Math.min(ans, nums[left]);
            break;
        }

        const mid = Math.floor((left + right) / 2);

        // ！！先用 mid 更新 最小值
        ans = Math.min(ans, nums[mid]);

        // 1.左半边有序
        if(nums[left] <= nums[mid]){
            // 因为左半边，最小值已经得到更新，最小值还可能在 右半边
            left = mid + 1;
        }
        else if(nums[left] > nums) {
            right = mid - 1;
        }
    }

    return ans;

};
// @lc code=end



/*
// @lcpr case=start
// [3,4,5,1,2]\n
// @lcpr case=end

// @lcpr case=start
// [4,5,6,7,0,1,2]\n
// @lcpr case=end

// @lcpr case=start
// [11,13,15,17]\n
// @lcpr case=end

 */

