class WsClient {
    private ws?: WebSocket | globalThis.WebSocket;
    private token: string;
    private isConnected = false;
    private reconnectTimer?: NodeJS.Timeout;
    private reconnectDelay = 3000; // 重连延迟（毫秒）
    private maxReconnectAttempts = 10; // 最大重连次数
    private reconnectAttempts = 0; // 当前重连次数
  
    // 构造函数：传入 WS 服务端地址
    constructor(token: string) {
      this.token = token;
      this.connect(); // 初始化时自动连接
    }
  
    /**
     * 建立 WebSocket 连接
     */
    private connect(): void {
      // 销毁已有连接（避免重复连接）
      if (this.ws) this.destroy();
  
      // 区分 Node.js/浏览器环境
      const WsConstructor = typeof window !== 'undefined' ? window.WebSocket : WebSocket;
      this.ws = new WsConstructor(`wss://service-api.fancytech.online/wallpaper/api/v1/ws/cross-platform?token=${this.token}`);
  
      // 连接成功回调
      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log(`WebSocket 连接成功`);
      };
  
      // 接收消息回调（对外暴露通过 onMessage 监听）
      this.ws.onmessage = (event) => {
        const message = event.data;
        console.log(`收到消息：${message}`);
        const data = JSON.parse(message);
        this.onMessage?.(data);
      };
  
      
    }
    
    /**
     * 发送消息（支持字符串/对象）
     * @param data 要发送的消息内容
     */
    public send(message_id: string, msg: any): boolean {
      if (!this.isConnected || !this.ws) {
        console.error('WebSocket 未连接，发送失败');
        return false;
      }
  
      const data = {
        type: 'cross_platform_message',
        from_device: 'desktop',
        to_device: 'mobile',
        message_id: message_id, 
        content: msg,
      }
      this.ws.send(JSON.stringify(data));
      console.log(`发送消息：${JSON.stringify(data)}`);
      return true;
    }
  
    /**
     * 主动断开连接（不触发重连）
     */
    public disconnect(): void {
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.destroy();
      console.log('WebSocket 主动断开连接');
    }
  
    /**
     * 销毁 WebSocket 实例
     */
    private destroy(): void {
      if (this.ws) {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.close();
        this.ws = undefined;
      }
      this.isConnected = false;
    }
  
    // 对外暴露的回调函数（供外部监听）
    onMessage?: (message: any) => void; // 接收消息回调
    onClose?: (code: number, reason: string) => void; // 连接关闭回调
    onError?: (error: Error) => void; // 错误回调
  }
  
  // 导出类供外部文件使用
  export {WsClient};