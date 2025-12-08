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
   if(nums.length === 0) return 0;

   // 初始化最大数组，最小数组，结果
   let max_soFar = nums[0];
   let min_soFar = nums[0];
   let reslut = nums[0];

   // 遍历数组： 依次乘积
   for(let i = 1; i < nums.length; i++) {
    // 每次记录 临时最大数/最小数 ， 用 当前 X i
    let temp_max = nums[i] * max_soFar;
    let temp_min = nums[i] * min_soFar;

    // 更新 最大数/最小数
    max_soFar = Math.max(nums[i], temp_max, temp_min);
    min_soFar = Math.min(nums[i], temp_max, temp_min);

    // 更新结果
    reslut = Math.max(reslut, max_soFar);
   }
   return reslut;
}

console.log(maxProduct([2,3,-2,4]));
console.log(maxProduct([-2,0,-1]));
