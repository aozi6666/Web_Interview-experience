<template>
  <div class="container">
    <h2>虚拟滚动示例（Vue 3 兼容）</h2>

    <!-- 普通列表 -->
    <div v-if="!useVirtual" class="test-list">
      <div v-for="item in list" :key="item.id" class="row">
        {{ item.name }}
      </div>
    </div>

    <!-- 虚拟滚动列表（使用 @tanstack/vue-virtual） -->
    <div v-else ref="parentRef" class="scroller">
      <div :style="{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }">
        <div
          v-for="virtualRow in virtualizer.getVirtualItems()"
          :key="virtualRow.key"
          :style="{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: `${virtualRow.size}px`,
            transform: `translateY(${virtualRow.start}px)`
          }"
          class="row"
        >
          {{ list[virtualRow.index].name }}
        </div>
      </div>
    </div>

    <button @click="useVirtual = !useVirtual" style="margin-top: 20px; padding: 8px 16px;">
      切换: {{ useVirtual ? '普通列表' : '虚拟滚动' }}
    </button>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";

const useVirtual = ref(false);
const parentRef = ref();

// 创建 1000 条数据列表
const list = ref(
  Array.from({ length: 1000 }, (_, i) => ({
    id: i + 1,
    name: `第 ${i + 1} 行`
  }))
);

// 虚拟滚动器配置
const virtualizer = useVirtualizer({
  count: list.value.length,
  getScrollElement: () => parentRef.value,
  estimateSize: () => 40, // 每项高度，必须与 CSS 中的 row 高度一致
  overscan: 5, // 预渲染的额外项数
});
</script>

<style scoped>
.container {
  width: 300px;
  margin: 30px auto;
}

.test-list {
  height: 400px;
  border: 1px solid #ccc;
  overflow: auto;
}

.scroller {
  height: 400px;         /* 必须有固定高度，否则无法滚动 */
  border: 1px solid #ccc;
  overflow: auto;
}

.row {
  height: 40px;          /* 必须与 item-size 对应 */
  line-height: 40px;
  padding-left: 10px;
  border-bottom: 1px solid #eee;
}
</style>
