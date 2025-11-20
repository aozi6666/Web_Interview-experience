// 给定一个包含红色、白色和蓝色、共 n 个元素的数组 nums ，
// [原地] 对它们进行排序，使得相同颜色的元素相邻，
// 并按照红色、白色、蓝色顺序排列。

// 我们使用整数 0、 1 和 2 分别表示红色、白色和蓝色。

// 必须在不使用库内置的 sort 函数的情况下解决这个问题。

 

// 示例 1：

// 输入：nums = [2,0,2,1,1,0]
// 输出：[0,0,1,1,2,2]

// 示例 2：

// 输入：nums = [2,0,1]
// 输出：[0,1,2]

var sortColors = function(nums) {
    let p0 = 0;  // 0的右边界
    let p2 = nums.length - 1;  // 2的左边界
    let i = 0;

    while( i <= p2) {
        // 遇到0
        if( nums[i] === 0) {
            // 交换 nums[p0] 与 nums[i]
            [nums[i], nums[p0]] = [nums[p0], nums[i]];
            p0++;
            i++;
        }  
        // 遇到2
        else if( nums[i] === 2) {
            // 交换 nums[p2] 与 nums[i]
            [nums[i], nums[p2]] = [nums[p2], nums[i]];
            p2--;
        }
        
        // 遇到1,直接 i ++
        else {
            i++;
        }
    }
}

// 测试示例1
let nums1 = [2,0,2,1,1,0];
sortColors(nums1);
console.log('示例1:', nums1);  // 输出: [0,0,1,1,2,2]

// 测试示例2
let nums2 = [2,0,1];
sortColors(nums2);
console.log('示例2:', nums2);  // 输出: [0,1,2]
