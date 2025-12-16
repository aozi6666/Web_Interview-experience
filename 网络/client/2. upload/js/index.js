const $ = document.querySelector.bind(document);
const doms = {
  img: $('.preview'),
  container: $('.upload'),
  select: $('.upload-select'),
  selectFile: $('.upload-select input'),
  progress: $('.upload-progress'),
  cancelBtn: $('.upload-progress button'),
  delBtn: $('.upload-result button'),
};

function showArea(areaName) {
  doms.container.className = `upload ${areaName}`;
}

function setProgress(value) {
  doms.progress.style.setProperty('--percent', value);
}

// 监视文件选择 input 的变化
doms.selectFile.onchange = (e) =>{ 
  // 文件对象
  const file = e.target.files[0];
  console.log(file);

  // 切换到“上传进度”区域
  showArea('progress');
  // 设置进度为 0%
  setProgress(0); 

  // 创建文件读取器，用于在页面中预览图片
  const reader = new FileReader();

  reader.onload = (e) => {
    const dataUrl = e.target.result;
    console.log(dataUrl);

    // 显示图片
    doms.img.src = dataUrl;
  };

  // 将文件读取为 DataURL（base64），方便直接赋值给 img.src
  reader.readAsDataURL(file);

  // 上传文件（Ajax）
  uploadFile(file);
};

// // 回调：上传文件（手动构建 multipart/form-data 请求体）
// function uploadFile(file) {
//   console.log(file);

//   // 创建 XMLHttpRequest 对象
//   const xhr = new XMLHttpRequest();
  
//   // 上传接口地址
//   const url = 'http://127.0.0.1:3000/upload';
//   xhr.open('POST', url);

//   // 设置请求头，声明这是 multipart/form-data
//   xhr.setRequestHeader('Content-Type', 'multipart/form-data');

//   // 用自定义的 BufferBuilder 来拼接二进制请求体
//   const bfBuilder = new BufferBuilder();
//   // 先添加一个字段（字段名 file，对应上传的文件）
//   bfBuilder.addField('file', file);

//   // 再用 FileReader 把文件读成 ArrayBuffer，拼接到请求体末尾
//   const render = new FileReader();
//   render.onload = (e) => {
//     // 得到文件的二进制数据
//     const buffer = e.target.result;
//     console.log(buffer);

//     // 将文件二进制数据拼接到请求体中
//     bfBuilder.appendBuffer(buffer);
//     // 拼接结束边界
//     bfBuilder.appendString('\r\n--aaa--');

//     // 得到完整的 二进制 数据
//     const bf = bfBuilder.toBuffer();

//     // 发请求
//     xhr.send(bf);
//   };
//   render.readAsArrayBuffer(file);
// }

// 回调：上传文件（直接使用浏览器提供的 FormData API）
function uploadFile(file) {
  console.log(file);

  // 1. 创建 XMLHttpRequest 对象
  const xhr = new XMLHttpRequest();
  
  // 2. 打开连接，指定请求方法和上传接口地址
  const url = 'http://127.0.0.1:9527/upload/single';
  xhr.open('POST', url);

  // 3. 在真正发送请求前，先监听「上传进度」事件
  //    这个事件会在上传过程中不断触发，用来计算进度条
  xhr.upload.onprogress = (e) => {
    console.log(e.loaded, e.total);
    // 拿到当前进度：已上传字节 / 总字节
    const percent = e.loaded / e.total;
    // 更新页面上的进度条
    setProgress(percent);
  };

  // 4. 监听请求完成事件（上传 + 服务端处理都结束后会触发）
  xhr.onload = (e) => {
    // 拿 响应体（服务器返回的 JSON）
    const res = JSON.parse(e.target.responseText);
    if (res.code === 0) {
      // 上传成功，切换到“结果”区域
      showArea('result');
    } else {
      // 这里可以根据需要做错误提示，这里先简单打印
      console.error('上传失败：', res);
    }

    // 如有需要，也可以查看响应头（这里仅做演示）
    // const resHeaders = xhr.getAllResponseHeaders();
    // console.log(resHeaders);
  };

  // 5. 构建表单数据，把文件塞到 FormData 中，字段名为 avatar
  const formData = new FormData();
  formData.append('avatar', file);

  // 6. 发送表单数据，浏览器会自动处理 multipart/form-data 的细节
  xhr.send(formData);
}
