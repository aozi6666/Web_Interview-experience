// 给定 n 个非负整数表示每个宽度为 1 的柱子的高度图，
// 计算按此排列的柱子，下雨之后能接多少雨水。

 

// 示例 1：

// （蓝色部分表示雨水）。

// 输入：height = [0,1,0,2,1,0,1,3,2,1,2,1]
// 输出：6
// 解释：上面是由数组 [0,1,0,2,1,0,1,3,2,1,2,1] 表示的高度图，
//      在这种情况下，可以接 6 个单位的雨水（蓝色部分表示雨水）。 
// 示例 2：

// 输入：height = [4,2,0,3,2,5]
// 输出：9

var trap = function(height) {
    // 定义左右指针
    let left = 0;
    let right = height.length - 1;

    // 定义 左右指针 的 柱状最大高度
    let max_left = 0;
    let max_right = 0;

    let reslut = 0;  // 接水结果（累加）

    while(left < right) {
        // 左侧高度 < 右侧高度， 更新左侧
        if(height[left] < height[right]) {
            // 当前高度 >= 最大高度，更新 最大高度
            if(height[left] >= max_left) {
                max_left = height[left];
            } 
            // 当前高度 < 最大高度，计算 接水量
            else {
                reslut += max_left - height[left];
            }

            left++;  // 更新完毕，左指针 右移
        }
        // 左侧高度 >= 右侧高度，更新右侧 
        else if(height[left >= height[right]]) {
            // 当前高度 >= 最大高度，更新 最大高度
            if(height[right] >= max_right) {
                max_right = height[right];
            }
            // 当前高度 < 最大高度，计算 接水量
            else {
                reslut += max_right - height[right];
            }
            right--;  // 更新完毕，右指针 左移
        }
    }

    return reslut;
}

console.log(trap([0,1,0,2,1,0,1,3,2,1,2,1]));
console.log(trap([4,2,0,3,2,5]));