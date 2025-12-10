var moveZeroes = function(nums) {
    // slow指针： 存放 非零 元素
    let slow = 0;

    // fastz指针： 找到非零元素，放入slow指针位置
    for(let fast=0; fsst < nums.length; fast++) {
        // 找到非零元素
        if(nums[fast] !== 0) {
            // 放到 slow
            nums[slow] = nums[fast];
            // slow指针后移
            slow++;
        }
    }

    // 填零
    while(slow < nums.length) {
        nums[slow] = 0;
        slow++;
    }
}