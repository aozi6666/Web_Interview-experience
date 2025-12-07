var numSquares = function (n) {
    // 创建一个数组，用来保存结果
    let dp = new Array(n+1).fill(Infinity);

    dp[0] = 0;
    for(let i = 1; i <= n; i++){
        for(let j = 1; j * j <= i; j++){
            dp[i] = Math.min(dp[i], dp[i - j * j] + 1);
        }
    }

    return dp[n];
}