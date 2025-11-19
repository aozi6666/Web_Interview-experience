// """
// 给你一个整数数组 nums ，
// 请你找出数组中乘积最大的非空连续 子数组（该子数组中至少包含一个数字），
// 并返回该子数组所对应的乘积。

// 测试用例的答案是一个 32-位 整数。

 

// 示例 1:

// 输入: nums = [2,3,-2,4]
// 输出: 6
// 解释: 子数组 [2,3] 有最大乘积 6。


// 示例 2:

// 输入: nums = [-2,0,-1]
// 输出: 0
// 解释: 结果不能为 2, 因为 [-2,-1] 不是子数组。
// """

var maxProduct = function(nums) {
    // 空数组
    if(nums.length == 0) return 0;

    let max_SoFar = nums[0];  // 记录最大乘积
    let min_SoFar = nums[0];  // 记录最小乘积
    let result = nums[0];  // 记录结果

    // 遍历数组
    for(let i = 1; i < nums.length; i++) {
        const current = nums[i];  // 当前元素
        const temp_max = max_SoFar * current; // 临时最大值
        const temp_min = min_SoFar * current; // 临时最小值

        max_SoFar = Math.max(current, temp_max, temp_min);
        min_SoFar = Math.min(current, temp_max, temp_min);

        result = Math.max(result, max_SoFar);
    }
    return result;
}

console.log(maxProduct([2,3,-2,4]));
console.log(maxProduct([-2,0,-1]));
