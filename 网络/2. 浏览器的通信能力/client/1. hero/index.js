// 拿英雄数据 fetch
async function loadHeroes() {
  const resp = await fetch('https://study.duyiedu.com/api/herolist');
  // 当响应头完整的被浏览器读取到后，该Promise完成
  // console.log('头部信息已经到达客户端');
  // console.log(resp.headers.get('Content-Type'));
  // console.log(resp.status);
  // console.log(resp.statusText);
  const body = await resp.json();
  document.querySelector('.list').innerHTML = body.data
    .map(
      (h) => `<li>
  <a
    href="https://pvp.qq.com/web201605/herodetail/${h.ename}.shtml"
    target="_blank"
  >
    <img
      src="https://game.gtimg.cn/images/yxzj/img201606/heroimg/${h.ename}/${h.ename}.jpg"
      alt=""
    />
    <span>${h.cname}</span>
  </a>
</li>`
    )
    .join('');
}

loadHeroes();
