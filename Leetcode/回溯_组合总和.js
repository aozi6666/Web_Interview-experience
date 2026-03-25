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
  // 本质：回溯中的 组合问题(start) + 元素可重复使用

  // 边界判断
  if(candidates.length === 0) return [];

  // [路径]：存 已选的 数字
  let track = [];
  // 结果数组
  let res = [];
  // 组合问题用 start(选了一个数，再选下一个)
  let start = 0;

  function backtrack(candidates, track, start){
      let sum = 0;
      for(let i = 0; i < track.length; i++){
          sum += track[i];
      }

      if(sum === target){
          res.push([...track]);
          // 结束此次递归
          return;
      }
      if(sum > target) return;

      // 循环遍历
      for(let i = start; i < candidates.length; i++){
          // 递归前选择
          track.push(candidates[i]);
          //递归
          backtrack(candidates, track, i);
          // 递归后-撤销选择
          track.pop();
      }
  }

  backtrack(candidates, track, start);
  return res;
};

console.log(combinationSum([2,3,6,7], 7));
console.log(combinationSum([2,3,5], 8));
console.log(combinationSum([2], 1));

