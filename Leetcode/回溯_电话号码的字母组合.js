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
    // 边界判断
    if(digits.length === 0) return [];

    // 只存 每个数字 选中的 单个字母
    let track = [];
    // 最终结果数组
    let res = [];
    // 正在处理第几个（index + 1）数字
    let index = 0;
    // 电话号码对应表
    const phoneMap = {
        2: "abc",
        3: "def",
        4: "ghi",
        5: "jkl",
        6: "mno",
        7: "pqrs",
        8: "tuv",
        9: "wxyz"
    }

    function backtrack(digits, track, index){
        if(track.length === digits.length){
            // 讲track单个字母拼接放入 res 中
            res.push(track.join(''));
            // 此次 递归结束
            return;
        }

        // 取出某个数字对应的 字母列表
        let letters = phoneMap[digits[index]];

        // 循环递归
        for(let i = 0; i < letters.length; i++){
            // 递归前-选择
            track.push(letters[i]);
            index += 1;
            // 递归
            backtrack(digits, track, index);
            // 递归后-撤销选择
            track.pop();
            index -= 1;
        }
    }

    backtrack(digits, track, index);
    return res;
};
console.log(letterCombinations("23"));
console.log(letterCombinations("2"));
