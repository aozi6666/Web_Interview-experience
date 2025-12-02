// 给你一个 无重复元素 的整数数组 candidates 和一个目标整数 target ，
// 找出 candidates 中可以使数字和为目标数 target 的 所有 不同组合 ，
// 并以列表形式返回。你可以按 任意顺序 返回这些组合。

// candidates 中的 同一个 数字可以 无限制重复被选取 。
// 如果至少一个数字的被选数量不同，则两种组合是不同的。 

// 对于给定的输入，保证和为 target 的不同组合数少于 150 个。

 
// 示例 1：

// 输入：candidates = [2,3,6,7], target = 7
// 输出：[[2,2,3],[7]]
// 解释：
// 2 和 3 可以形成一组候选，2 + 2 + 3 = 7 。注意 2 可以使用多次。
// 7 也是一个候选， 7 = 7 。
// 仅有这两种组合。


// 示例 2：

// 输入: candidates = [2,3,5], target = 8
// 输出: [[2,2,2,2],[2,3,3],[3,5]]

// 示例 3：

// 输入: candidates = [2], target = 1
// 输出: []
/**
 * @param {number[]} candidates
 * @param {number} target
 * @return {number[][]}
 */
var combinationSum = function(candidates, target) {
  // 结果集
  const res = [];
  // 当前路径
  const path = [];

  // 回溯函数
  function backtrack(start, sum) {
    // 如果 sum和 等于 target，收集结果
    if(sum === target) {
        res.push([...path]);
        return;
    }

    // 如果 sum 大于 target，直接剪枝，不加入结果返回
    if(sum > target) return;

    // 从 start 开始，因为每个数字可以重复使用
    for(let i = start; i < candidates.length; i++) {
        // 当前数字
        let num = candidates[i];
        // 将 num 存入 path 中
        path.push(num);

        // 递归：i 不变，因为可以重复选择同一个数字
        backtrack(i, sum + num);

        // 回溯：将 num 弹出 path 中，撤销选择
        path.pop();
    }
  }
  backtrack(0, 0);
  return res;
};

console.log(combinationSum([2,3,6,7], 7));
console.log(combinationSum([2,3,5], 8));
console.log(combinationSum([2], 1));

