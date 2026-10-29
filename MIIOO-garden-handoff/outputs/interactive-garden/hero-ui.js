const tabButtons = [...document.querySelectorAll('[data-tab]')];
const title = document.getElementById('workspace-title');
const content = document.getElementById('demo-content');
const initialContent = content.innerHTML;
const arrow = '<svg aria-hidden="true"><use href="#icon-arrow"/></svg>';
const panels = {
  storyboard: { title: '分镜工作台', html: initialContent },
  script: {
    title: '剧本创作',
    html: `<div class="project-heading"><div><h3>一座会呼吸的花园</h3><p>剧本示例 · 从一句灵感开始</p></div><a href="https://miiooai.com/script" class="project-link">打开剧本 ${arrow}</a></div><div class="table-wrap"><table class="shot-table"><thead><tr><th scope="col">场次</th><th scope="col">故事片段</th><th scope="col">场景</th><th scope="col">氛围</th><th scope="col">阶段</th></tr></thead><tbody><tr><td>01</td><td>清晨，第一束光落在花园</td><td>花园</td><td>宁静</td><td><span class="status-tag ready">已编写</span></td></tr><tr><td>02</td><td>风带来一颗远方的种子</td><td>苔藓地</td><td>好奇</td><td><span class="status-tag ready">已编写</span></td></tr><tr><td>03</td><td>它在露水中，找到自己的位置</td><td>叶片下</td><td>温柔</td><td><span class="status-tag">构思</span></td></tr><tr><td>04</td><td>日光变换，一个故事慢慢生长</td><td>花园</td><td>期待</td><td><span class="status-tag">构思</span></td></tr><tr><td>05</td><td>花朵盛开，风又一次经过</td><td>花丛</td><td>明亮</td><td><span class="status-tag">构思</span></td></tr><tr><td>06</td><td>新的种子，向新的世界出发</td><td>远方</td><td>自由</td><td><span class="status-tag">构思</span></td></tr></tbody></table></div>`
  },
  creation: {
    title: '影像创作',
    html: `<div class="project-heading"><div><h3>一座会呼吸的花园</h3><p>创作示例 · 让文字成为画面</p></div><a href="https://miiooai.com/creation" class="project-link">打开创作 ${arrow}</a></div><div class="table-wrap"><table class="shot-table"><thead><tr><th scope="col">素材</th><th scope="col">创作描述</th><th scope="col">类型</th><th scope="col">用途</th><th scope="col">阶段</th></tr></thead><tbody><tr><td>01</td><td>暗色花园，薄雾与晨光</td><td>图片</td><td>场景设计</td><td><span class="status-tag">待创作</span></td></tr><tr><td>02</td><td>沾着露水的绿色叶片</td><td>图片</td><td>细节特写</td><td><span class="status-tag">待创作</span></td></tr><tr><td>03</td><td>蒲公英在微风中轻轻摇曳</td><td>视频</td><td>动态分镜</td><td><span class="status-tag">待创作</span></td></tr><tr><td>04</td><td>镜头缓缓穿过金色花丛</td><td>视频</td><td>场景推进</td><td><span class="status-tag">待创作</span></td></tr><tr><td>05</td><td>每个故事，都从一个念头开始</td><td>配音</td><td>旁白</td><td><span class="status-tag">待创作</span></td></tr><tr><td>06</td><td>愿你的灵感，自由生长</td><td>配音</td><td>片尾</td><td><span class="status-tag">待创作</span></td></tr></tbody></table></div>`
  }
};
function selectTab(button, focus = false) {
  const panel = panels[button.dataset.tab];
  tabButtons.forEach(tab => {
    const selected = tab === button;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  title.textContent = panel.title;
  content.innerHTML = panel.html;
  content.setAttribute('aria-labelledby', button.id);
  if (focus) button.focus();
}
tabButtons.forEach((button, index) => {
  button.addEventListener('click', () => selectTab(button));
  button.addEventListener('keydown', event => {
    let target = null;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') target = (index + 1) % tabButtons.length;
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') target = (index + tabButtons.length - 1) % tabButtons.length;
    if (event.key === 'Home') target = 0;
    if (event.key === 'End') target = tabButtons.length - 1;
    if (target !== null) { event.preventDefault(); selectTab(tabButtons[target], true); }
  });
});
const enterButton = document.querySelector('[data-immersive]');
const exitButton = document.querySelector('.exit-garden');
const announcement = document.getElementById('scene-announcement');
const hiddenWhenImmersive = [...document.querySelectorAll('.site-header,.hero-copy,.workspace,.hero-bottom')];
function setImmersive(immersive) {
  document.body.classList.toggle('garden-only', immersive);
  hiddenWhenImmersive.forEach(element => { element.inert = immersive; });
  announcement.textContent = immersive ? '已进入沉浸花园。移动鼠标体验微风，按 Escape 返回首页。' : '已返回首页。';
  (immersive ? exitButton : enterButton).focus({preventScroll:true});
}
enterButton.addEventListener('click', () => setImmersive(true));
exitButton.addEventListener('click', () => setImmersive(false));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.body.classList.contains('garden-only')) setImmersive(false);
});
const motionButton = document.querySelector('button[data-motion]');
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
function renderMotionState(available = true) {
  motionButton.disabled = !available;
  motionButton.setAttribute('aria-pressed', String(paused));
  motionButton.setAttribute('aria-label', available ? (paused ? '播放背景动画' : '暂停背景动画') : '当前为静态花园背景');
  motionButton.querySelector('span').textContent = available ? (paused ? '播放动画' : '暂停动画') : '静态花园';
  motionButton.querySelector('use').setAttribute('href', paused ? '#icon-play' : '#icon-pause');
}
motionButton.addEventListener('click', () => {
  paused = !paused;
  renderMotionState();
  window.dispatchEvent(new CustomEvent('garden-motion', {detail:{paused}}));
});
window.addEventListener('garden-state', event => {
  paused = Boolean(event.detail.paused);
  renderMotionState(event.detail.available !== false);
});
renderMotionState();
