import { useState, useEffect } from 'react';

/**
 * 结构索引
 * 状态层：
 *   - phase: 'intro' | 'loop'          入场动画 → 循环动画 阶段
 *   - introDropped: boolean           底层 loading01 是否在 loading02 完全覆盖后被撤下
 * 数据流：
 *   - 挂载 2300ms 后 phase 切到 'loop'，触发上层 loading02 淡入
 *   - phase 切到 'loop' 后 260ms，introDropped 置 true，底层 loading01 淡出
 * 组件结构：
 *   - container（inline-block，aspectRatio 1118 / 405）
 *     - object#loading01（绝对定位，底层，先保持满覆盖）
 *       - data 走 introSrc prop，默认 /loading01.svg（可用 /loading01b.svg 作连贯版对比）
 *     - object#loading02（绝对定位，上层，淡入覆盖底层）
 * 副作用：
 *   - useEffect[1]：2300ms 定时器，切换 phase
 *   - useEffect[2]：phase==='loop' 后定时器，撤下 loading01
 */

/**
 * 品牌加载动画组件
 *
 * 播放逻辑：
 *   1. 挂载后立即播放 loading01（入场动画，2.3s，播一次）
 *   2. 2.3s 后无缝切换到 loading02（正序→倒序交替循环）
 *
 * 使用示例：
 *   <LoadingAnimation />
 *   <LoadingAnimation width="480px" />
 *   <LoadingAnimation width={240} />
 *   <LoadingAnimation width="100%" style={{ maxWidth: 400 }} />
 *
 * @param {string|number} [props.width='280px']  容器宽度，高度按比例自适应
 * @param {string}        [props.className]
 * @param {object}        [props.style]
 * @param {string}        [props.introSrc='/loading01.svg']  入场动画 SVG 源（默认现版 loading01，可传 /loading01b.svg 预览连贯版）
 */
export default function LoadingAnimation({ width = '280px', className, style, introSrc = '/loading01.svg' }) {
  const [phase, setPhase] = useState('intro');
  const [introDropped, setIntroDropped] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setPhase('loop'), 2300);
    return () => clearTimeout(timer);
  }, []);

  // loading02 在 loading01 之上淡入；等它完全覆盖底层后再撤掉 loading01。
  // 过渡期间画面始终被底层 loading01 完整覆盖，不会露出深色背景 → 不会闪黑。
  useEffect(() => {
    if (phase !== 'loop') return;
    const timer = setTimeout(() => setIntroDropped(true), 260);
    return () => clearTimeout(timer);
  }, [phase]);

  const containerStyle = {
    display: 'inline-block',
    width: typeof width === 'number' ? `${width}px` : width,
    aspectRatio: '1118 / 405',
    flexShrink: 0,
    lineHeight: 0,
    ...style,
  };

  return (
    <div className={className} style={containerStyle}>
      {/*
        用 <object> 而非 <img> 或内联 SVG：
        - <img> 沙箱禁止 offset-path / CSS Motion Path
        - 内联 SVG 的 transform-box:view-box 坐标系与独立文档有差异
        - <object> 给 SVG 独立 browsing context，效果与直接打开文件完全一致

        两个 <object> 同时挂载、互不重建：
        - loading02 在后台预加载并持续播放，切换时已经渲染完，不再有加载空白帧
        - 不再用 key={phase} 重建元素，避免重新请求 SVG 产生的间隙
        - 过渡采用「上层 loading02 淡入覆盖、底层 loading01 先保持满覆盖、被完全盖住后再撤掉」：
          任何时刻画面都被 loading01 完整覆盖，深色背景不会从两层之间透出来 → 不闪黑
      */}
      <object
        type="image/svg+xml"
        data={introSrc}
        width="100%"
        height="100%"
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          pointerEvents: 'none',
          opacity: introDropped ? 0 : 1,
          transition: 'opacity 220ms ease',
        }}
      />
      <object
        type="image/svg+xml"
        data="/loading02.svg"
        width="100%"
        height="100%"
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          pointerEvents: 'none',
          opacity: phase === 'loop' ? 1 : 0,
          transition: 'opacity 220ms ease',
        }}
      />
    </div>
  );
}
