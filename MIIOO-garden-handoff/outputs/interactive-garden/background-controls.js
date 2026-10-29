const motion=document.querySelector('#motion-toggle');
const wind=document.querySelector('#wind-button');
let paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
function update(available){
  motion.disabled=!available;wind.disabled=!available;
  motion.setAttribute('aria-pressed',String(paused));
  motion.querySelector('span').textContent=!available?'静态花园':paused?'播放动画':'暂停动画';
  motion.setAttribute('aria-label',!available?'当前为静态花园':paused?'播放背景动画':'暂停背景动画');
  document.querySelector('#motion-icon').setAttribute('d',paused?'M6 3l10 7-10 7Z':'M7 4v12M13 4v12');
}
window.addEventListener('garden-state',event=>{paused=event.detail.paused;update(event.detail.available);});
motion.addEventListener('click',()=>{paused=!paused;window.dispatchEvent(new CustomEvent('garden-motion',{detail:{paused}}));update(true);});
wind.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('garden-gust')));
update(false);
