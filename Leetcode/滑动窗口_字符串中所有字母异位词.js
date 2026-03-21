// 给定两个字符串 s 和 p，找到 s 中所有 p 的 异位词 的子串，返回这些子串的起始索引。
// 字母异位词: 字母异位词是通过重新排列不同单词或短语的字母而形成的单词或短语，并使用所有原字母一次。
// 不考虑答案输出的顺序。

// 示例 1:

// 输入: s = "cbaebabacd", p = "abc"
// 输出: [0,6]
// 解释:
// 起始索引等于 0 的子串是 "cba", 它是 "abc" 的异位词。
// 起始索引等于 6 的子串是 "bac", 它是 "abc" 的异位词。

//  示例 2:

// 输入: s = "abab", p = "ab"
// 输出: [0,1,2]
// 解释:
// 起始索引等于 0 的子串是 "ab", 它是 "ab" 的异位词。
// 起始索引等于 1 的子串是 "ba", 它是 "ab" 的异位词。
// 起始索引等于 2 的子串是 "ab", 它是 "ab" 的异位词。

/**
 * 438. 找到字符串中所有字母异位词
 * O(n)，并且每次滑动判断是 O(1)（看 diff 是否为 0）
 * @param {string} s
 * @param {string} p
 * @return {number[]}
 */
var findAnagrams = function (s, p) {
    const n = s.length, m = p.length;
    if (m > n) return [];
  
    const base = "a".charCodeAt(0);
    const cnt = new Array(26).fill(0);
  
    // 先把 p 的需求减进去：cnt[x] = -need[x]
    for (let i = 0; i < m; i++) {
      const pi = p.charCodeAt(i) - base;
      cnt[pi]--;
    }
  
    // diff = 当前有多少个字母 cnt[i] != 0
    let diff = 0;
    for (let i = 0; i < 26; i++) {
      if (cnt[i] !== 0) diff++;
    }
  
    const res = [];  // 结果数组
  
    // 辅助函数：更新 数组cnt[pos] 前后，O(1) 维护 diff（当前有多少个字母 cnt[i] != 0）
    const add = (pos, delta) => {
        // delta 为 +1 或 -1
        const before = cnt[pos];
        const after = before + delta;
    
        // before 是否为 0，after 是否为 0，决定 diff 怎么变
        if (before === 0 && after !== 0) diff++;
        else if (before !== 0 && after === 0) diff--;
            
        cnt[pos] = after;
    };
  
    // 初始化窗口：把 s[0..m-1] 加进去
    for (let i = 0; i < m; i++) {
      const si = s.charCodeAt(i) - base;
      add(si, +1);
    }
    // 初始化窗口后，如果diff为0，则说明窗口内的字符串是p的异位词
    if (diff === 0) res.push(0);
  
    // 滑动窗口
    for (let r = m; r < n; r++) {
        // 滑动窗口始终是：m 长度 [r-m, r];
        const inPos = s.charCodeAt(r) - base;       // 右边界的进入窗口的字符
        const outPos = s.charCodeAt(r - m) - base;  // 左边界脱离窗口的字符
    
        add(inPos, +1);
        add(outPos, -1);
        
        // 如果diff为0，则说明窗口内的字符串是p的异位词，则将窗口的起始索引加入结果数组
        if (diff === 0) res.push(r - m + 1);
    }
  
    return res;
};
  console.log(findAnagrams("cbaebabacd", "abc"));
  console.log(findAnagrams("abab", "ab"));
