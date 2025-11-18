// 给你一个 只包含正整数 的 非空 数组 nums 。
// 请你判断是否可以将这个数组分割成两个子集，使得两个子集的元素和相等。


// 示例 1：

// 输入：nums = [1,5,11,5]
// 输出：true
// 解释：数组可以分割成 [1, 5, 5] 和 [11] 。

// 示例 2：

// 输入：nums = [1,2,3,5]
// 输出：false
// 解释：数组不能分割成两个元素和相等的子集。

var canPartition = function(nums) {
    // 累加
    const sum = nums.reduce((a, b) => a + b, 0);

    // 奇数： 无法达到
    if(sum % 2 !== 0 ) return false;

    const target = sum /2;
    const dp = new Array(target + 1).fill(false);
    dp[0] = true;

    // 循环 nums
    for (let num of nums) {
        for(let j = target; j >= num; j--) {
            dp[j] = dp[j] || dp [j-num];
        }
    }
    return dp[target];
}

console.log(canPartition([1,5,11,5]));
console.log(canPartition([1,2,3,5]));