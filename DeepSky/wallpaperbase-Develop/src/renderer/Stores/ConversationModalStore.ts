import { proxy } from 'valtio';

// 会话列表弹窗状态接口
interface ConversationModalState {
  // 是否显示弹窗
  isVisible: boolean;
  // 时间范围筛选
  dateRange: [Date | null, Date | null];
  // 搜索关键词
  searchKeyword: string;
  // 会话列表数据
  conversations: any[];
  // 当前页码
  currentPage: number;
  // 总页数
  totalPages: number;
  // 每页条数
  pageSize: number;
  // 加载状态
  isLoading: boolean;
  // 会话ID
  conversationsId: number;
}

// 创建全局会话弹窗状态
export const conversationModalStore = proxy<ConversationModalState>({
  isVisible: false,
  dateRange: [null, null],
  searchKeyword: '',
  conversations: [],
  currentPage: 1,
  totalPages: 1,
  pageSize: 10,
  isLoading: false,
  conversationsId: 0,
});

// 会话弹窗操作方法
export const conversationModalActions = {
  /**
   * 显示会话弹窗
   */
  showModal: () => {
    console.log('📋 ConversationModalStore: 显示会话弹窗');

    conversationModalStore.isVisible = true;
    // 重置搜索条件
    conversationModalStore.dateRange = [null, null];
    conversationModalStore.searchKeyword = '';
    conversationModalStore.currentPage = 1;

      (conversationModalStore.totalPages = 1);
  },

  /**
   * 隐藏会话弹窗
   */
  hideModal: () => {
    console.log('📋 ConversationModalStore: 隐藏会话弹窗');

    conversationModalStore.isVisible = false;
  },

  /**
   * 更新时间范围
   */
  updateDateRange: (dateRange: [Date | null, Date | null]) => {
    console.log('📅 ConversationModalStore: 更新时间范围', dateRange);
    conversationModalStore.dateRange = dateRange;
  },

  /**
   * 更新搜索关键词
   */
  updateSearchKeyword: (keyword: string) => {
    console.log('🔍 ConversationModalStore: 更新搜索关键词', keyword);
    conversationModalStore.searchKeyword = keyword;
  },

  /**
   * 更新会话列表数据
   */
  updateConversations: (conversations: any[], totalPages: number = 1) => {
    console.log('📝 ConversationModalStore: 更新会话列表', {
      count: conversations.length,
      totalPages,
    });

    conversationModalStore.conversations = conversations;
    conversationModalStore.totalPages = totalPages;
  },

  /**
   * 更新当前页码
   */
  updateCurrentPage: (page: number) => {
    console.log('📄 ConversationModalStore: 更新当前页码', page);
    conversationModalStore.currentPage = page;
  },

  /**
   * 设置加载状态
   */
  setLoading: (isLoading: boolean) => {
    conversationModalStore.isLoading = isLoading;
  },

  /**
   * 设置会话ID
   */
  setConversationsId: (id: number) => {
    conversationModalStore.conversationsId = id;
  },

  /**
   * 获取当前弹窗状态
   */
  getModalState: () => {
    return {
      isVisible: conversationModalStore.isVisible,
      dateRange: conversationModalStore.dateRange,
      searchKeyword: conversationModalStore.searchKeyword,
      conversations: conversationModalStore.conversations,
      currentPage: conversationModalStore.currentPage,
      totalPages: conversationModalStore.totalPages,
      pageSize: conversationModalStore.pageSize,
      isLoading: conversationModalStore.isLoading,
      conversationsId: conversationModalStore.conversationsId,
    };
  },
};
