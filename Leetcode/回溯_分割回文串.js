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
    const res = [];  // 结果集
    const path = [];  // 当前路径
    const n = s.length;  // n:字符串长度

    // 函数： 判断 s[l ... r] 是否是回文串
    function isPalindrome(l, r) {
        while(l < r) {
            if(s[l] !== s[r]) return false;
            l++;
            r--;
        }
        return true;
    }

    // 回溯函数： 从下标 start 开始切分
    function backtrack(start) {
        // 已经切到末尾，当前 path 是一种方案，加入结果集
        if(start === n) {
            res.push([...path]);
            return;
        }

        // 枚举切分点：[start, i] 这一段
        for(let i = start; i < n; i++) {
            // 判断 s[start ... i] 是否是回文串,不是回文串则跳过
            if(!isPalindrome(start, i)) continue;

            // 选取 (start, i + 1)字串段
            path.push(s.slice(start, i + 1));
            backtrack(i + 1);
            path.pop();
        }
    }

    backtrack(0);
    return res;
};

console.log(partition("aab"));
console.log(partition("a"));
