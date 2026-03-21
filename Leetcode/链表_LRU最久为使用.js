// // LRU 缓存：HashMap + 双向链表（手写）
// get/put 均摊 O(1)
// 请你设计并实现一个满足  LRU (最近未使用) 缓存 约束的数据结构

// 实现 LRUCache 类：
// LRUCache(int capacity) 以 正整数 作为容量 capacity 初始化 LRU 缓存
// int get(int key) 如果关键字 key 存在于缓存中，则返回关键字的值，否则返回 -1
// void put(int key, int value) 如果关键字 key 已经存在，则变更其数据值 value ；
//          如果不存在，则向缓存中插入该组 key-value 。
//          如果插入操作导致关键字数量超过 capacity ，
//          则应该 逐出 最久未使用的关键字。
// 函数 get 和 put 必须以 O(1) 的平均时间复杂度运行


// 示例：

// 输入
// ["LRUCache", "put", "put", "get", "put", "get", "put", "get", "get", "get"]
// [[2], [1, 1], [2, 2], [1], [3, 3], [2], [4, 4], [1], [3], [4]]
// 输出
// [null, null, null, 1, null, -1, null, -1, 3, 4]

// 解释
// LRUCache lRUCache = new LRUCache(2);
// lRUCache.put(1, 1); // 缓存是 {1=1}
// lRUCache.put(2, 2); // 缓存是 {1=1, 2=2}
// lRUCache.get(1);    // 返回 1
// lRUCache.put(3, 3); // 该操作会使得关键字 2 作废，缓存是 {1=1, 3=3}
// lRUCache.get(2);    // 返回 -1 (未找到)
// lRUCache.put(4, 4); // 该操作会使得关键字 1 作废，缓存是 {4=4, 3=3}
// lRUCache.get(1);    // 返回 -1 (未找到)
// lRUCache.get(3);    // 返回 3
// lRUCache.get(4);    // 返回 4


// Node节点定义类
class Node {
    // 构造函数：初始化这个对象的属性(键值对 + 元素前后指针)
    constructor(key = 0, value = 0) {
        this.key = key;
        this.value = value;
        this.prev = null;
        this.next = null;
    }
};

// LRUCache类定义
class LRUCache {
    // 构造函数：初始化这个对象的属性(容量 + 双向链表)
    constructor(capactity) {
        this.capactity = capactity;  // 容量
        // 哈希表：key 为 键，value 为 节点Node对象
        this.map = new Map();

        // 双向链表：指向 LRU容器内，头节点 尾节点
        // 哨兵节点： head <-> ... <-> tail
        this.head = new Node();  // 头节点: head.next 指向 "最近使用" 节点
        this.tail = new Node();  // 尾节点: tail.prev 指向 "最久未使用" 节点

        // 初始化链表：头尾节点 相互指向
        this.head.next = this.tail;
        this.tail.prve = this.head;
    }
};

// 原型方法： _remove（）把 节点Node 从链表中摘掉
LRUCache.prototype._remove = function(node) {
    node.prve.next = node.next;
    node.next.prve = node.prve;
    node.prve = null;
    node.next = null;
};

// 原型方法： _addToFront（）把 节点Node 插到 head 后面（变成最近使用）
LRUCache.prototype._addToFront = function(node) {
    node.prve = this.head;
    node.next = this.head.next;
    this.head.next.prve = node;
    this.head.next = node;
};

// 原型方法：  _moveToFront（）把 node 移到最前（最近使用）
LRUCache.prototype._moveToFront = function(node) {
    this._remove(node);  // 先摘掉
    this._addToFront(node);  // 再插到最前
};

// 原型方法：_popLRU（）把 最久未使用 节点 摘掉
LRUCache.prototype._popLRU = function() {
    const last = this.tail.prev;  // 获取 最后一个节点（最久未使用）
    this._remove(last);  // 摘掉
    return last;  // 返回 最久未使用 节点 （供哈希表删除）
};

// 原型方法：get（）获取LRU缓存中的值
LRUCache.prototype.get = function(key) {
    // 如果 key 不存在，返回 -1
    if(!this.map.has(key)) return -1;

    // 如何存在该节点，获取
    const node = this.map.get(key);
    // 把该节点 移到最前（最近使用）
    this._moveToFront(node);
    // 返回该节点的值
    return node.value;
}

// 原型方法：put（）插入LRU缓存中
LRUCache.prototype.put = function(key, value) {
    // 如果 key 已经存在，更新值 + 移动到最前
    if(this.map.has(key)) {
        const node = this.map.get(key);
        node.value = value;
        this._moveToFront(ndoe);
        return;
    }

    // 如果 key 不存在，创建新节点 +  更新哈希表 + 插入到最前
    const node = new Node(key, value);
    this.map.set(key, value);
    this._addToFront(node);

    // 如果容量超过，摘掉最久未使用 节点 + 从哈希表中删除
    if(this.map.size > this.capactity) {
        const lastLru = this._popLRU();
        this.map.delete(lastLru.key);
    }
}
