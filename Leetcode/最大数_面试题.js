function largestNumber(num) {
    // 数字转换为字符串
    const arr = num.map(String);

    // sort内部排序函数
    function compare(a, b) {
        let ab = a + b;
        let ba = b + a;
        if (ab === ba) return 0;
        return ab > ba ? -1 : 1;
    }

    // 排序 
    arr.sort(compare);

    // 全是 “0”时:比如 ["0","0"] => "0"
    if(arr[0] === "0") return "0";

    return arr.join("");
}

console.log(largestNumber([10, 2])); // "210"
console.log(largestNumber([3, 30, 34, 5, 9])); // "9534330"
console.log(largestNumber([0, 0])); // "0"