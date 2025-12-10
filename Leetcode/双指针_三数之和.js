// """
// 给你一个整数数组 nums ，判断是否存在三元组 [nums[i], nums[j], nums[k]] 满足 i != j、i != k 且 j != k ，
// 同时还满足 nums[i] + nums[j] + nums[k] == 0 。请你返回所有和为 0 且不重复的三元组。

// 注意：答案中不可以包含重复的三元组。

// 示例 1：

// 输入：nums = [-1,0,1,2,-1,-4]
// 输出：[[-1,-1,2],[-1,0,1]]
// 解释：
// nums[0] + nums[1] + nums[2] = (-1) + 0 + 1 = 0 
// nums[1] + nums[2] + nums[4] = 0 + 1 + (-1) = 0 
// nums[0] + nums[3] + nums[4] = (-1) + 2 + (-1) = 0 
// 不同的三元组是 [-1,0,1] 和 [-1,-1,2] 
// 注意，输出的顺序和三元组的顺序并不重要

// 示例 2：

// 输入：nums = [0,1,1]
// 输出：[]
// 解释：唯一可能的三元组和不为 0 

// 示例 3：

// 输入：nums = [0,0,0]
// 输出：[[0,0,0]]
// 解释：唯一可能的三元组和为 0 
// """
/**
 * @param {number[]} nums
 * @return {number[][]}
 */
var threeSum = function(nums) {
    const n = nums.length;
   // 结果
   let result = [];
   // 1. 升序排序
   nums.sort((a, b) => a - b);

    // 2. 遍历数组(找三个数，需要n-2，留3个)
    for(let i = 0; i < n-2; i++){
        // 2.1 跳过重复的 i
        if(i > 0 && nums[i] === nums[i-1]) {
            continue;   // 跳过重复的 i
        }

        // 2.2 确定左右指针
        let left = i + 1;  // 左指针: 每个i的后一位
        let right = n - 1;  // 右指针: 始终保持数组末尾

        // 2.3 移动左右指针，寻找和为0的三元组
        while(left < right) {
            // 当前 三数和
            let sum = nums[i] + nums[left] + nums[right];

            // 根据 sum 的值情况，移动左右指针
            if(sum === 0) {
                // 存入结果
                result.push([nums[i], nums[left], nums[right]]);

                // 跳过 重复的 left
                while(left < right && nums[left] === nums[left + 1]) {
                    left++;
                }
                // 跳过 重复的 right
                while(left < right && nums[right] === nums[right - 1]){
                    right--;
                }

                // 移动左右指针, 继续找
                left++;
                right--;
            }else if(sum < 0) {
                // 值太小，左指针变大
                left++;
            }else {
                // 值太大，右指针变小
                right--;
            }
        }
    } 
    return result;
};

