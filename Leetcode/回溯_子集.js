// 给你一个整数数组 nums ，数组中的元素 互不相同 。
// 返回该数组所有可能的子集（幂集）。

// 解集 不能 包含重复的子集。你可以按 任意顺序 返回解集。

 
// 示例 1：

// 输入：nums = [1,2,3]
// 输出：[[],[1],[2],[1,2],[3],[1,3],[2,3],[1,2,3]]

// 示例 2：

// 输入：nums = [0]
// 输出：[[],[0]]
var subsets = function(nums) {
    const res = [];  // 结果 集
    const path = [];  // 当前路径

    // 回溯函数：
    function dfs(start) {
        // path 当前路径存入 结果

        // [...] 是 展开运算符，把 path 里的元素“拷贝一份”出来，形成一个新数组
        // 例如 path = [1,2]，那么 [...path] = [1,2]
        res.push([...path]);

        for(let i = start; i < nums.length; i++) {
            // 将 nums[i] 存入 path 中
            path.push(nums[i]);
            // 递归：i + 1 ：表示从 nums[i + 1] 开始，避免重复
            dfs(i + 1);
            // 回溯：将 nums[i] 弹出 path 中，撤销选择
            path.pop(); 
        } 
    }
    dfs(0);
    return res;
}

console.log(subsets([1,2,3]));
console.log(subsets([0]));