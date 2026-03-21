// 264. 丑数 II

// 给你一个整数 n ，请你找出并返回第 n 个 丑数 。
// 丑数 就是质因子只包含 2、3 和 5 的正整数。


// 示例 1：

// 输入：n = 10
// 输出：12
// 解释：[1, 2, 3, 4, 5, 6, 8, 9, 10, 12] 是由前 10 个丑数组成的序列。
// 示例 2：

// 输入：n = 1
// 输出：1
// 解释：1 通常被视为丑数。

function nthUglyNumber(n) {
    // dp[i] 表示第 i+1 个丑数, 第 i 丑数用 dp[i-1] 表示
    const dp = new Array(n);

    dp[0] = 1;  // 第一个丑数是 1
    // 定义 三指针： 分别指向 与2/3/5 相乘前的数值位置（最小值） 
    let p2 = p3 = p5 = 0;

    // 遍历 更新 dp[i]
    for(let i = 1; i < n; i++) {
        let next2 = dp[p2] * 2;
        let next3 = dp[p3] * 3;
        let next5 = dp[p5] * 5;

        // 找出三个中最小值，就是下一个丑数的值
        let next = Math.min(next2, next3, next5);
        dp[i] = next;

        // 完成更新后，移动指针： 取的 2/3/5 那个指针对应的值，那个指针就更新
        if(next === next2) {
            p2++;
        } else if(next === next3) {
            p3++;
        } else {
            p5++;
        }
    }

    return dp[n-1];
}

