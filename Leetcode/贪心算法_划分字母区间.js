// 给你一个字符串 s 。
// 我们要把这个字符串划分为尽可能多的片段，
// 同一字母最多出现在一个片段中。
// 例如，字符串 "ababcc" 能够被分为 ["abab", "cc"]，
//      但类似 ["aba", "bcc"] 或 ["ab", "ab", "cc"] 的划分是非法的。

// 注意，划分结果需要满足：将所有划分结果按顺序连接，
//                     得到的字符串仍然是 s 。

// 返回一个表示 每个字符串片段的长度 的列表。

 
// 示例 1：

// 输入：s = "ababcbacadefegdehijhklij"
// 输出：[9,7,8]
// 解释：
// 划分结果为 "ababcbaca"、"defegde"、"hijhklij" 。
// 每个字母最多出现在一个片段中。
// 像 "ababcbacadefegde", "hijhklij" 这样的划分是错误的，
// 因为划分的片段数较少。 


// 示例 2：

// 输入：s = "eccbbbbdec"
// 输出：[10]

var partitionLabels = function(s) {
    const last = {};  

    const res = [];  // 结果数组
    let start = 0;  // 当前片段的 起始位置
    let end = 0;  // 当前片段的 结束位置

    // 记录 每个字符 最后一次出现的下标
    for(let i = 0; i < s.length; i++){
        last[s[i]] = i;
    }

    // 贪心遍历数组
    for(let i = 0; i < s.length; i++){
        // 更新当前片段 的结束位置(最远)
        end = Math.max(end, last[s[i]]);

        if(i === end) {
            res.push(end - start + 1);  // 结果存入数组

            start = i + 1;  // 更新 下一个片段 的起始位置
        }
    }
    return res;
}

console.log(partitionLabels("ababcbacadefegdehijhklij"));
console.log(partitionLabels("eccbbbbdec"));
