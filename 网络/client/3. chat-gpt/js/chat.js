// 清空聊天记录：告诉服务器把之前的对话上下文清掉
fetch('http://myserver.com:7010/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    clear: true,
  }),
});

// 发消息
// 获取表单元素（发送区域）
const form = document.querySelector('.send');

const textarea = document.querySelector('.send textarea');
const username = '袁';

// 监听键盘事件：按下 Enter 直接发送，Ctrl/Shift + Enter 换行
textarea.onkeydown = (e) => {
  if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
    e.preventDefault();
    // 提交表单 自定义事件
    form.dispatchEvent(new Event('submit'));
  }
};

// 提交表单
form.onsubmit = async (e) => {
  e.preventDefault();
  // 获取 聊天框 文本内容
  const content = textarea.value;
  createUserContent(username);
  // 在页面中创建一个“机器人回复”的 DOM 盒子，用来显示 AI 的回答
  const robot = createRobotContent();
  // 发送网络请求：把用户消息传给服务器
  const resp = await fetch('http://myserver.com:7010/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content,
    }),
  });
  // 创建一个流读取器：可以一段一段地拿到服务器返回的数据
  const reader = resp.body.getReader();
  // 先读一次（可选的预读，这里主要演示用，真正循环在下面）
  const {done, value} = await reader.read();

  // 创建一个解码器：把字节数据（Uint8Array）解码成字符串
  const decoder = new TextDecoder();
  // 循环读取服务器的流式响应
  while (1) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    // 将当前这一块字节数据解码成文本
    const text = decoder.decode(value);
    // 把文本追加到机器人聊天气泡中，实现“边返回边显示”的效果
    robot.append(text);
  }
  // 标记机器人回复完成（比如可以关闭光标动画等）
  robot.over();
};
