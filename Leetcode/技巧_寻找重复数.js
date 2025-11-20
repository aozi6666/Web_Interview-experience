// 给定一个包含 n + 1 个整数的数组 nums ，
// 其数字都在 [1, n] 范围内（包括 1 和 n），可知至少存在一个重复的整数。

// 假设 nums 只有 一个重复的整数 ，返回 这个重复的数 。
// 你设计的解决方案必须 不修改 数组 nums 且只用常量级 O(1) 的额外空间。

 

// 示例 1：

// 输入：nums = [1,3,4,2,2]
// 输出：2

// 示例 2：

// 输入：nums = [3,1,3,4,2]
// 输出：3

// 示例 3 :

// 输入：nums = [3,3,3,3,3]
// 输出：3

var findDuplicate = function(nums) {

    // 将数组按照下标，编成链条
    let slow = nums[0];  // 慢指针
    let fast = nums[nums[0]];  // 快指针

    // 移动指针，找到相遇点
    while (slow !== fast) {
        slow = nums[slow];  // 慢指针每次移动 一个 位置
        fast = nums[nums[fast]];  // 快指针每次移动 两个 位置
    }

    // 已经找到相遇点，开始寻找重复的数
    // slow 留着环里循环等待, slow 和 fast 都只移动一步
    fast = 0;
    while (slow !== fast) {
        slow = nums[slow];
        fast = nums[fast];
    }

    return slow;
}

console.log(findDuplicate([1,3,4,2,2]));
console.log(findDuplicate([3,1,3,4,2]));
console.log(findDuplicate([3,3,3,3,3]));
console.log(findDuplicate([1, 4, 1, 3, 2]));