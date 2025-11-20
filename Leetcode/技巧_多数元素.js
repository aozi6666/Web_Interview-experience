// 给定一个大小为 n 的数组 nums ，返回其中的多数元素。
//   多数元素:是指在数组中出现次数 大于 ⌊ n/2 ⌋ 的元素。

// 你可以假设数组是非空的，并且给定的数组总是存在多数元素。

 

// 示例 1：

// 输入：nums = [3,2,3]
// 输出：3

// 示例 2：

// 输入：nums = [2,2,1,1,1,2,2]
// 输出：2


/*
核心思想：

    多数元素出现次数 > n/2

    使用一个“候选人 candidate”和一个“票数 count”

遍历数组：

如果 count 为 0，把当前数字设为 candidate
如果当前数字 等于 candidate，count++
                       否则 count--

最终的 candidate 就是多数元素。
*/ 
var majorityElement = function(nums) {
    let candidate = null;  // 候选者
    let count = 0;  // 投票数

    for(let num of nums) {
        // 投票数是否持平
        if (count === 0) {
            candidate = num;  // 投票数持平，则更换候选者
        }

        // 候选者与当前元素相同，则投票数加1
        // 否则，投票数减1
        if(num === candidate) {
            count ++;
        } else {
            count --;
        }
    }
    return candidate;
}

console.log(majorityElement([3,2,3]));
console.log(majorityElement([2,2,1,1,1,2,2]));
console.log(majorityElement([1,2,3,2,2,2,5,4,2]));