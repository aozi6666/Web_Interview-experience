// """
// 给你一个字符串 s，找到 s 中最长的 回文子串。

// 回文：如果字符串向前和向后读都相同，则它满足 回文性。
// 子串:子字符串 是字符串中连续的 非空 字符序列


// 示例 1：
// 输入：s = "babad"
// 输出："bab"
// 解释："aba" 同样是符合题意的答案。

// 示例 2：
// 输入：s = "cbbd"
// 输出："bb"

// """

/**
 * @param {string} s
 * @return {string}
 */
var longestPalindrome = function(s) {
    if (s.length < 2) return s;

    let start = 0;   // 最长回文子串的起点
    let maxLen = 1;  // 最长回文长度

    // 函数：从中心向两侧扩展,返回当前回文的长度
    function expand(left, right) {
        while (left >= 0 && right < s.length && s[left] === s[right]) {
            left--;
            right++;
        }
        // 返回当前回文的长度
        return right - left - 1;
    }

    for (let i = 0; i < s.length; i++) {
        // 情况1：以 s[i] 为中心（奇数回文，如 "aba"）
        let len1 = expand(i, i);
        // 情况2：以 s[i] 和 s[i+1] 为中心（偶数回文，如 "abba"）
        let len2 = expand(i, i + 1);

        let curMax = Math.max(len1, len2);

        if (curMax > maxLen) {
            maxLen = curMax;
            // 根据长度倒推出回文的左右边界
            start = i - Math.floor((curMax - 1) / 2);
        }
    }

    return s.substring(start, start + maxLen);
};

/**
 * @param {string} s
 * @return {string}
 */
var longestPalindrome_dp = function(s) {
    const n = s.length;
    if (n < 2) return s;

    // dp[i][j] 表示 s[i..j] 是否是回文串
    const dp = Array.from({ length: n }, () => Array(n).fill(false));

    let start = 0;   // 最长回文起始下标
    let maxLen = 1;  // 最长回文长度，至少为 1

    // 所有单个字符都是回文
    for (let i = 0; i < n; i++) {
        dp[i][i] = true;
    }

    // i 从大到小，j 从 i 到 n-1
    for (let i = n - 1; i >= 0; i--) {
        for (let j = i + 1; j < n; j++) {
            if (s[i] === s[j]) {
                if (j - i <= 2) {
                    // 长度 2 或 3，形如 "aa"、"aba"
                    dp[i][j] = true;
                } else {
                    // 看内部是否是回文
                    dp[i][j] = dp[i + 1][j - 1];
                }
            } else {
                dp[i][j] = false;
            }

            // 更新最长回文子串
            if (dp[i][j] && (j - i + 1 > maxLen)) {
                maxLen = j - i + 1;
                start = i;
            }
        }
    }

    return s.substring(start, start + maxLen);
};





        
