// 给定一个字符串 s ，请你找出其中不含有重复字符的 最长 子串 的长度。

// 示例 1:

// 输入: s = "abcabcbb"
// 输出: 3 
// 解释: 因为无重复字符的最长子串是 "abc"，所以其长度为 3。注意 "bca" 和 "cab" 也是正确答案。

// 示例 2:
// 输入: s = "bbbbb"
// 输出: 1
// 解释: 因为无重复字符的最长子串是 "b"，所以其长度为 1。

// 示例 3:
// 输入: s = "pwwkew"
// 输出: 3
// 解释: 因为无重复字符的最长子串是 "wke"，所以其长度为 3。
//      请注意，你的答案必须是 子串 的长度，"pwke" 是一个子序列，不是子串。

const lengthOfLongestSubstring = function(s) {
    /*
    Map字典(键-值对)：{key, value} 值value是索引
    方法：Map.has(ch) 判断Map中是否存在键 ch，返回true/false
    方法：Map.get(ch) 获取键ch的对应的值value，不存在返回undefined
    方法：Map.set(key, value) 设置键(key,value)写入Map中
    */

    // 记录 每个字符 上一次出现的位置（key:字符，value:索引）
   const last = new Map();

   // 当前滑动窗口的左边界
   let left = 0;
   // 结果：最长无重复字符子串的长度
   let res = 0;

   // 遍历更新滑动窗口
   for(let right = 0; right < s.length; right++) {
        // 获取当前 滑动窗口右边界 字符
        let ch = s[right];

        // 如何 当前右边界字符 在窗口中有重复字符，更新左边界
        if(last.has(ch) && last.get(ch) >= left) {
            left = last.get(ch) + 1;
        }

        // 更新/添加 当前字符 到Map
        last.set(ch, right);

        // 更新最大 窗口大小（无重复字符子串的长度）
        res = Math.max(res, right - left + 1);
   }
   
   return res;
}

console.log(lengthOfLongestSubstring("abcabcbb"));
console.log(lengthOfLongestSubstring("bbbbb"));
console.log(lengthOfLongestSubstring("pwwkew"));