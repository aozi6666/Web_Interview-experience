var _user;
import "core-js/modules/es.array.flat-map.js";
import "core-js/modules/es.array.unscopables.flat-map.js";
import "core-js/modules/es.object.to-string.js";
// 可选链
var city = (_user = user) === null || _user === void 0 || (_user = _user.address) === null || _user === void 0 ? void 0 : _user.city;

// flatMap
var result = [1, 2].flatMap(function (item) {
  return [item, item * 2];
});
console.log(result);
