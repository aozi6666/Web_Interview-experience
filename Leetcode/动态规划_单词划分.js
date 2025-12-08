var wordBreak = function(s, wordDict) {
    // 统计 s的长度
    const n = s.length;

    // dp[i] 表示 s[0 ... i] 是否可以划分,类型为boolen
    const dp = new Array(n+1).fill(false);

    // 遍历
    for(let i = 0; i < n; i++) {
        // 每到位置i ,依次用 word 尝试切分
        for(let word of wordDict) {
            let len = word.length;  // word的长度
            
            // 可以切分的状态
            // (1） 当前长度 i >= word的长度
            // (2) 是否是上个已经可以切分的开始位置 dp[i-len] 必须为 true
            //     否则就会空出字母没切割
            // (3) 切割出来的字符串  === word 
            if(i >= len && dp[i - len] && s.slice(i-len, i) === word) {
                dp[i] = true;
                break;  // 跳出循环
            }
        }
    }

    return dp[n];
}