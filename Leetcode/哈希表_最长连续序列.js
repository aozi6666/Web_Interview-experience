function longestConsecutive(nums) {
    // 空数组情形
    if(!nums || nums.length === 0) return 0;

    set = new Set(nums); // 将数组转换为集合，去重
    let maxLength = 0;

    for (x of set) {
        if(!set.has(x - 1)) {
            let cur = x;
            let length = 1;
            while(set.has(cur + 1)) {
                cur ++;
                length ++;
            }
            if(length > maxLength) {
                maxLength = length;
            }
        }
    }
    return maxLength;
}

console.log(longestConsecutive([100,4,200,1,3,2]));
console.log(longestConsecutive([0,3,7,2,5,8,4,6,0,1]));
