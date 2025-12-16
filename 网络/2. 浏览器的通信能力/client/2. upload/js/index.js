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

doms.selectFile.onchange = (e) => {
  const file = e.target.files[0];
  // 显示预览图
  const reader = new FileReader();
  reader.onload = (e) => {
    // 读取完成
    doms.img.src = e.target.result;
    showArea('progress');
    upload(file);
  };
  reader.readAsDataURL(file); // 将文件数据读取为 DataURL（base64编码）
};

function upload(file) {
  setProgress(0);
  // XHR
  const xhr = new XMLHttpRequest();
  xhr.open('POST', 'http://myserver.com:9527/upload/single'); // 配置请求
  xhr.upload.onprogress = (e) => {
    const percent = Math.floor((e.loaded / e.total) * 100);
    setProgress(percent);
  };
  xhr.onload = () => {
    showArea('result');
  };
  // xhr.abort(); // 中止请求
  const form = new FormData(); // 生成multipart/form-data格式的请求体
  form.append('avatar', file);
  xhr.send(form);
}
