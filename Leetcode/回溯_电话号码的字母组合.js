// 给定一个仅包含数字 2-9 的字符串，返回所有它能表示的字母组合。
// 答案可以按 任意顺序 返回。

// 给出数字到字母的映射如下（与电话按键相同）。注意 1 不对应任何字母。


// 示例 1：

// 输入：digits = "23"
// 输出：["ad","ae","af","bd","be","bf","cd","ce","cf"]
// 示例 2：

// 输入：digits = "2"
// 输出：["a","b","c"]

// 建立映射 + 回溯
var letterCombinations = function(digits) {
    // 空数组
    if(digits.length === 0) return [];

    const res = [];  // 结果 集

    // 创建映射：数字到字母的映射
    const phoneMap = {
        2: "abc",
        3: "def",
        4: "ghi",
        5: "jkl",
        6: "mno",
        7: "pqrs",
        8: "tuv",
        9: "wxyz"
    };

    // 回溯函数: 拼接，index 表示当前处理到 digits 的第 index 位
    function backtrack(index, currentCombination) {
        // 如果 当前索引 等于数字长度，添加到结果中 
        if(index === digits.length) {
            res.push(currentCombination);
            return;
        };

        // 当前数字（字符串转数字）
        const cur_digit = parseInt(digits[index]); 
        //  当前数字对应的字母 字符集
        const letters = phoneMap[cur_digit]; 

        // 遍历当前数字对应的每个字母
        for(let i = 0; i < letters.length; i++){
            // 回溯
            backtrack(index + 1, currentCombination + letters[i]);
        }
    }
    backtrack(0, '');

    return res;
}

console.log(letterCombinations("23"));
console.log(letterCombinations("2"));
