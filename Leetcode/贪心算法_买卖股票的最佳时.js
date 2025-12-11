// """
// 给定一个数组 prices ，它的第 i 个元素 prices[i] 表示一支给定股票第 i 天的价格。

// 你只能选择 某一天 买入这只股票，并选择在 未来的某一个不同的日子 卖出该股票。设计一个算法来计算你所能获取的最大利润。

// 返回你可以从这笔交易中获取的最大利润。如果你不能获取任何利润，返回 0 。

 
// 示例 1

// 输入：[7,1,5,3,6,4]
// 输出5
// 解释：在第 2 天（股票价格 = 1的时候买入在第 5 天（股票价格 = 6的时候卖出最大利润 = 6-1 = 5 。
//      注意利润不能是 7-1 = 6, 因为卖出价格需要大于买入价格；同时，你不能在买入前卖出股票。
// 示例 2

// 输入prices = [7,6,4,3,1]
// 输出0
// 解释：在这种情况下, 没有交易完成, 所以最大利润为 0。

// """

/**
 * @param {number[]} prices
 * @return {number}
 */
var maxProfit = function(prices) {
    // minPrice：到目前为止见过的最低买入价格
    let minPrice = Infinity;
    // maxProfit：到目前为止能获得的最大利润
    let maxProfit = 0;

    for (let price of prices) {
        // 尝试更新历史最低价
        if (price < minPrice) {
            minPrice = price;
        } else {
            // 用当前价卖出，看看利润多少
            const profit = price - minPrice;
            if (profit > maxProfit) {
                maxProfit = profit;
            }
        }
    }

    return maxProfit;
};
