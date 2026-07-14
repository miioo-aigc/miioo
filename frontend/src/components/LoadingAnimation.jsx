import { useEffect, useRef, useState } from 'react';
import { DotLottieReact, setWasmUrl } from '@lottiefiles/dotlottie-react';
// 把 wasm 指向随包一起打包进来的本地文件：默认 dotLottie 会从 jsDelivr/unpkg CDN 拉取 wasm，
// 离线或弱网环境会加载失败，这里改成本地资源，保证一定能播。
import wasmUrl from '../assets/dotlottie-player.wasm?url';

/**
 * 结构索引
 * 状态层：
 *   - phase: 'intro' | 'loop'  入场动画 loading01 → 循环动画 loading02 阶段
 * 数据流：
 *   - 挂载即播放 loading01（autoplay + loop=false），播完触发一次 complete → 切到 loading02
 *   - loading02 预挂载并暂停，phase 切到 'loop' 时从头正序 play()，
 *     mode="bounce" 实现「正序-倒序-正序-倒序」无限往复循环
 *   - 01 尾帧与 02 首帧一致，故切换用「瞬时硬切」（无淡入淡出、无透明过渡），
 *     phase 一变就直接显隐两层，画面零掉透明度、不闪黑
 * 组件结构：
 *   - container（inline-block，aspectRatio 1118 / 405）
 *     - div#intro（底层，phase==='intro' 时满覆盖，否则直接隐藏）
 *       - DotLottieReact#loading01（src = introSrc，仅播一次）
 *     - div#loop（上层，phase==='loop' 时直接显示，无过渡）
 *       - DotLottieReact#loading02（src = loopSrc，bounce 往复循环，预挂载保首帧就绪）
 * 副作用：
 *   - useEffect[1]：拿到 loading01 实例后挂 complete 监听，播完切 phase='loop'
 *   - useEffect[2]：phase==='loop' 时让 loading02 从头正序开始 bounce 循环
 * 依赖（动画规则写在调用方，组件只负责按规则驱动）：
 *   - public/loading01.lottie：loop=false，只播一次
 *   - public/loading02.lottie：mode="bounce"，正序-倒序往复无限循环
 *   - 本地 wasm：通过 setWasmUrl 指向打包进来的 dotlottie-player.wasm
 */

// 让 dotLottie 在本地/离线环境也能加载 wasm（默认会从 CDN 拉取）。
setWasmUrl(wasmUrl);

/**
 * 品牌加载动画组件（.lottie 版）
 *
 * 播放逻辑（按运行规则）：
 *   1. 挂载立即播放 loading01（入场动画，只播一次，不循环）
 *   2. loading01 播放结束后「紧接着」切换到 loading02
 *   3. loading02 以「正序-倒序-正序-倒序」往复方向无限循环（mode="bounce"）
 *
 * 使用示例：
 *   <LoadingAnimation02 />
 *   <LoadingAnimation02 width="480px" />
 *   <LoadingAnimation02 width={240} />
 *   <LoadingAnimation02 width="100%" style={{ maxWidth: 400 }} />
 *
 * @param {string|number} [props.width='280px']  容器宽度，高度按比例自适应
 * @param {string}        [props.className]
 * @param {object}        [props.style]
 * @param {string}        [props.introSrc='/loading01.lottie']  入场动画 .lottie 源
 * @param {string}        [props.loopSrc='/loading02.lottie']   循环动画 .lottie 源
 */
export default function LoadingAnimation02({
  width = '280px',
  className,
  style,
  introSrc = '/loading01.lottie',
  loopSrc = '/loading02.lottie',
}) {
  const [phase, setPhase] = useState('intro');
  const introRef = useRef(null);
  const loopRef = useRef(null);

  // loading01 播完（loop=false 触发一次 complete）→ 进入循环阶段
  useEffect(() => {
    const dl = introRef.current;
    if (!dl) return;
    const handleComplete = () => setPhase('loop');
    dl.addEventListener('complete', handleComplete);
    return () => dl.removeEventListener('complete', handleComplete);
  }, []);
  // 进入循环阶段：让 loading02 从头正序开始，bounce = 正序-倒序-正序-倒序 无限往复
  useEffect(() => {
    if (phase !== 'loop') return;
    const loop = loopRef.current;
    if (!loop) return;
    loop.setMode('bounce');
    loop.setLoop(true);
    loop.play();
  }, [phase]);

  const containerStyle = {
    position: 'relative',
    display: 'inline-block',
    width: typeof width === 'number' ? `${width}px` : width,
    aspectRatio: '1118 / 405',
    flexShrink: 0,
    lineHeight: 0,
    ...style,
  };

  return (
    <div className={className} style={containerStyle}>
      {/* 入场动画 loading01：只播一次，结束淡出 */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: phase === 'intro' ? 1 : 0,
        }}
      >
        <DotLottieReact
          dotLottieRefCallback={(dl) => { introRef.current = dl; }}
          src={introSrc}
          autoplay
          loop={false}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
      {/* 循环动画 loading02：预挂载并暂停，phase 切到 loop 时 bounce 往复 */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: phase === 'loop' ? 1 : 0,
        }}
      >
        <DotLottieReact
          dotLottieRefCallback={(dl) => { loopRef.current = dl; }}
          src={loopSrc}
          autoplay={false}
          loop={false}
          mode="bounce"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
}
