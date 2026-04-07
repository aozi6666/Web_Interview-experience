import { CloseOutlined, SearchOutlined } from '@ant-design/icons';
import { DatePicker, Input, Modal, Pagination, Spin } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useSnapshot } from 'valtio';
import {
  conversationModalActions,
  conversationModalStore,
} from '../../stores/ConversationModalStore';
import { useStyles } from './styles';

const { RangePicker } = DatePicker;

function ConversationModal() {
  const { styles } = useStyles();
  const [localKeyword, setLocalKeyword] = useState('');

  // 时间戳转换函数
  const formatTimestamp = (timestamp: number | null | undefined): string => {
    if (!timestamp) return '未知时间';

    const date = new Date(timestamp * 1000);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  // 使用useSnapshot获取store的响应式状态
  const store = useSnapshot(conversationModalStore);

  // 监听store变化
  useEffect(() => {
    setLocalKeyword(store.searchKeyword);
  }, [store.searchKeyword]);

  // 调试：输出当前状态
  useEffect(() => {
    console.log('🔍 ConversationModal 状态变化:', {
      isVisible: store.isVisible,
      searchKeyword: store.searchKeyword,
      conversationsCount: store.conversations.length,
    });
  }, [store.isVisible, store.searchKeyword, store.conversations.length]);

  // 处理关闭弹窗
  const handleClose = () => {
    conversationModalActions.hideModal();
  };

  // 处理时间范围变化
  const handleDateRangeChange = (
    dates: [Dayjs | null, Dayjs | null] | null,
  ) => {
    const dateRange: [Date | null, Date | null] = [
      dates?.[0]?.isValid() ? dates[0].toDate() : null,
      dates?.[1]?.isValid() ? dates[1].toDate() : null,
    ];
    conversationModalActions.updateDateRange(dateRange);
  };

  // 处理搜索关键词变化
  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalKeyword(e.target.value);
  };

  // 处理搜索
  const handleSearch = () => {
    conversationModalActions.updateSearchKeyword(localKeyword);
    // 这里可以触发重新获取数据的逻辑
  };

  // 处理页码变化
  const handlePageChange = (page: number) => {
    conversationModalActions.updateCurrentPage(page);
    // 这里可以触发重新获取数据的逻辑
  };

  // 如果不可见，直接返回null
  if (!store.isVisible) {
    return null;
  }

  return (
    <Modal
      open={store.isVisible}
      onCancel={handleClose}
      footer={null}
      width={800}
      centered={false} // 禁用 Antd 的 centered，使用自定义样式
      className={styles.modal}
      destroyOnClose
      zIndex={1000}
    >
      {/* 头部 */}
      <div className={styles.header}>
        <h3 className={styles.title}>聊天记录</h3>
        <div className={styles.closeBtn} onClick={handleClose}>
          <CloseOutlined />
        </div>
      </div>

      {/* 内容区域 */}
      <div className={styles.content}>
        {/* 时间选择和搜索 */}
        <div className={styles.filterSection}>
          <div className={styles.filterRow}>
            <div className={styles.filterItem}>
              <RangePicker
                value={[
                  store.dateRange[0] ? dayjs(store.dateRange[0]) : null,
                  store.dateRange[1] ? dayjs(store.dateRange[1]) : null,
                ]}
                onChange={handleDateRangeChange}
                placeholder={['开始日期', '结束日期']}
                className={styles.datePicker}
              />
            </div>
            <div className={styles.filterItem}>
              <div className={styles.searchBox}>
                <Input
                  value={localKeyword}
                  onChange={handleKeywordChange}
                  placeholder="请输入..."
                  onPressEnter={handleSearch}
                  className={styles.searchInput}
                />
                <button className={styles.searchBtn} onClick={handleSearch}>
                  <SearchOutlined />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 列表 */}
        <div className={styles.listSection}>
          {store.isLoading ? (
            <div className={styles.loading}>
              <Spin size="large" />
            </div>
          ) : (
            <div className={styles.conversationList}>
              {store.conversations.length > 0 ? (
                store.conversations.map((conversation, index) => (
                  <div
                    key={conversation.id || index}
                    className={styles.conversationItem}
                  >
                    <div className={styles.conversationHeader}>
                      <div className={styles.conversationTitle}>
                        {conversation.role == 'user' ? '用户' : '角色'}
                      </div>
                      <div className={styles.conversationTime}>
                        {formatTimestamp(conversation.updated_at)}
                      </div>
                    </div>
                    <div className={styles.conversationContent}>
                      {conversation.content ||
                        conversation.summary ||
                        '暂无内容'}
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.empty}>
                  <p>暂无会话记录</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 分页 */}
        <div className={styles.pagination}>
          <Pagination
            defaultCurrent={store.currentPage}
            total={store.totalPages}
            onChange={handlePageChange}
          />
        </div>
      </div>
    </Modal>
  );
}

export default ConversationModal;
