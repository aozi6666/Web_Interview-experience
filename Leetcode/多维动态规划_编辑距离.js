// """
// 给你两个单词 word1 和 word2， 
// 请返回将 word1 转换成 word2 所使用的最少操作数  。

// 你可以对一个单词进行如下三种操作：

// 插入一个字符
// 删除一个字符
// 替换一个字符
 

// 示例 1：

// 输入：word1 = "horse", word2 = "ros"
// 输出：3

// 解释：
// horse -> rorse (将 'h' 替换为 'r')
// rorse -> rose (删除 'r')
// rose -> ros (删除 'e')


// 示例 2：

// 输入：word1 = "intention", word2 = "execution"
// 输出：5

// 解释：
// intention -> inention (删除 't')
// inention -> enention (将 'i' 替换为 'e')
// enention -> exention (将 'n' 替换为 'x')
// exention -> exection (将 'n' 替换为 'c')
// exection -> execution (插入 'u')

// """

/**
 * @param {string} word1
 * @param {string} word2
 * @return {number}
 */
var minDistance = function(word1, word2) {
    // 两个单词的长度
    const m = word1.length;
    const n = word2.length;

    // dp[i][j]: 把 word1 的前 i 个字符转换成 word2 的前 j 个字符的最小编辑距离。
    // dp : 行代表向更新代表 插入， 列代表删除
    const dp = Array.from({ length: m + 1}, () => Array(n + 1).fill(0));

    // word1 变成 空串 删除自己的 单词数
    for(let i = 1; i <= m; i++) dp[i][0] = i;
    // word2 从 空串 到 word2 的 需要增加自己的 单词数
    for(let j = 1; j <= n; j++) dp[0][j] = j;

    // 遍历更新： 对比的是 逐个单词
    for(let i = 1; i <= m; i++) {
        for(let j = 1; j <= n; j++) {
            // 取出的单词 如果相同，则不需要更新，距离不增加
            if(word1[i-1] === word2[j-1]) {
                dp[i][j] = dp[i-1][j-1];
            } else {
                // 取出单词不同，则需要更新，距离增加+1
                dp[i][j] = 1 + Math.min(
                    dp[i-1][j-1],  // 替换
                    dp[i-1][j], // 删除
                    dp[i][j-1] // 插入
                )
            }
        }
    }

    

    return dp[m][n];
};
 

console.log(minDistance("horse", "ros"));