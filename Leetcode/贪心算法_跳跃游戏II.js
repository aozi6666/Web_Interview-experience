// 给定一个长度为 n 的 0 索引整数数组 nums。初始位置在下标 0。

// 每个元素 nums[i] 表示从索引 i 向后跳转的最大长度。
// \换句话说，如果你在索引 i 处，你可以跳转到任意 (i + j) 处：

// 0 <= j <= nums[i] 且
// i + j < n
// 返回到达 n - 1 的最小跳跃次数。测试用例保证可以到达 n - 1。

 

// 示例 1:

// 输入: nums = [2,3,1,1,4]
// 输出: 2
// 解释: 跳到最后一个位置的最小跳跃数是 2。
//      从下标为 0 跳到下标为 1 的位置，跳 1 步，
//      然后跳 3 步到达数组的最后一个位置。


// 示例 2:

// 输入: nums = [2,3,0,1,4]
// 输出: 2

var jump = function(nums) {
    // 空数组
    if(nums.length === 0) return 0;

    let conut_jumps = 0;  // 跳跃次数
    let end = 0;  // 当前这一跳 可到达最远位置
    let next_fartrest = 0;  // 下一跳 可以达到的 最远位置

    // 遍历数组
    for(let i = 0; i < nums.length - 1; i++) {

        next_fartrest = Math.max(next_fartrest, i + nums[i]);

        // 当前 跳跃的最大范围 已经结束，需要再跳一次
        if(i === end) {
            conut_jumps += 1;
            end = next_fartrest;  // 更新下一跳 最远位置
        }
    }
    return conut_jumps;
}

console.log(jump([2,3,1,1,4]));
console.log(jump([2,3,0,1,4]));
