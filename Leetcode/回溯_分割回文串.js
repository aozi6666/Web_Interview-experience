// 给你一个字符串 s，请你将 s 分割成一些 子串，
// 使每个子串都是 回文串 。返回 s 所有可能的分割方案。

 
// 回文 串： 向前和向后读都相同的字符串。
// 示例 1：

// 输入：s = "aab"
// 输出：[["a","a","b"],["aa","b"]]
// 示例 2：

// 输入：s = "a"
// 输出：[["a"]]

/**
 * @param {string} s
 * @return {string[][]}
 */
var partition = function(s) {
    // 本质：切分区间 + 回溯

    if(s.length === 0) return [];

    let res = [];
    // 路径：表示当前 已经切出来的若干段
    let track = [];
    // start: 从 start 开始的 所有回文前缀: 
    // s[0..0] = "a" ; s[0..1] = "aa"; s[0..2] = "aab"
    let start = 0;

    // 回调：判断是不是回文
    function isPalindrome(str, start, end){
       while(start < end){
            if(str[start] !== str[end]) return false;
            start++;
            end--;
       }
       return true;
    }

    function backtrak(s, track, start){
        // 结束条件
        if(start === s,length){
            res.push([...track]);
            return;
        }

        // 循环-递归
        // ！ 决定这 一刀切 到哪里为止 ， 切出区间[start, end]
        for(let end = start; end < s.length; end++){
            // 不是回文串，直接跳过
            if(!isPalindrome(s, start, end)) continue;

            // 回溯前-选择
            // slice(a, b): 左闭右开 [a, b),从 a 开始，但是取不到b !!!
            track.push(s.slice(start, end + 1));
            end += 1;

            //回溯
            backtrak(s, track, end);

            // 回溯后-撤销选择
            track.pop();
            end -= 1;
        }
    }

    backtrak(s, track, start);
    return res;
  
};

console.log(partition("aab"));
console.log(partition("a"));
