// 可选链
const city = user?.address?.city;

// flatMap
const result = [1, 2].flatMap(item => [item, item * 2]);
console.log(result);
