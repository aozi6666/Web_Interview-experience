// 使用 fetch API 获取英雄数据
async function loadHeroes() {
  // ========== 第一步：发送请求，获取响应对象 ==========
  // fetch() 返回一个 Promise，resolve 后得到 Response 对象
  // 注意：此时只拿到了响应头（Headers），
  // 响应体（Body）还在传输中，需要再次 await 才能读取
  const resq = await fetch("https://study.duyiedu.com/api/heroes");
  
  // 从响应头中获取 Content-Type，用于判断服务器返回的数据格式
  const type = resq.headers.get("content-type");
  console.log('响应头 Content-Type:', type);
  console.log('Response 对象:', resq);
  // 注意：此时 resq.body 是 ReadableStream，还不能直接读取内容

  // ========== 第二步：读取响应体内容 ==========
  // Response 对象提供了多种方法来读取响应体，需要再次 await
  // 根据服务器返回的数据格式，选择合适的读取方法：
  
  // 方法1：读取为纯文本字符串（适合文本、HTML、XML 等）
  // const body = await resq.text();
  
  // 方法2：读取为 JSON 对象（最常用，服务器返回 JSON 时使用）
  // const body = await resq.json();
  
  // 方法3：读取为 ArrayBuffer 二进制数据（适合图片、音频、视频等二进制文件）
  const body = await resq.arrayBuffer();
  
  // 打印响应体内容
  console.log('响应体内容:', body);
}

// 调用函数，开始请求数据
loadHeroes();