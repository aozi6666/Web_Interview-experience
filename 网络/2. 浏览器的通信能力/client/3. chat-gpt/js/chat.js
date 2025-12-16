// 清空聊天记录
fetch('http://myserver.com:7010/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    clear: true,
  }),
});

const form = document.querySelector('.send');
const textarea = document.querySelector('.send textarea');
const username = '袁';
textarea.onkeydown = (e) => {
  if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
    e.preventDefault();
    form.dispatchEvent(new Event('submit'));
  }
};

form.onsubmit = async (e) => {
  e.preventDefault();
  const content = textarea.value;
  createUserContent(username);
  const robot = createRobotContent();
  // 请求服务器
  const resp = await fetch('http://myserver.com:7010/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content,
    }),
  });
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  while (1) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    const text = decoder.decode(value);
    robot.append(text);
  }
  robot.over();
};
