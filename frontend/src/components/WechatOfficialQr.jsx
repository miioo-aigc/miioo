import { useEffect, useRef } from 'react';

/**
 * 官方微信二维码组件
 * 动态加载微信官方脚本，从授权链接中解析参数，通过 WxLogin 渲染真实二维码
 * 自动适配外部容器大小
 */
export default function WechatOfficialQr({ authUrl, onReady, onError, containerId = 'wechat-qr-container' }) {
  const containerRef = useRef(null);
  const wxLoginInstanceRef = useRef(null);
  const observerRef = useRef(null);

  useEffect(() => {
    if (!authUrl || !containerRef.current) return;

    // 1. 从授权链接中解析参数
    let appid, redirect_uri, state, scope;
    try {
      const url = new URL(authUrl);
      appid = url.searchParams.get('appid');
      redirect_uri = url.searchParams.get('redirect_uri');
      state = url.searchParams.get('state');
      scope = url.searchParams.get('scope') || 'snsapi_login';
    } catch (err) {
      console.error('[WechatOfficialQr] 解析授权链接失败:', err);
      onError?.(err);
      return;
    }

    if (!appid || !redirect_uri) {
      const err = new Error('授权链接缺少必要参数（appid 或 redirect_uri）');
      console.error('[WechatOfficialQr]', err.message);
      onError?.(err);
      return;
    }

    // 2. 动态加载微信官方脚本
    const loadWxScript = () => {
      return new Promise((resolve, reject) => {
        if (window.WxLogin) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js';
        script.async = true;
        script.onload = () => {
          if (window.WxLogin) {
            resolve();
          } else {
            reject(new Error('微信官方脚本加载失败'));
          }
        };
        script.onerror = () => {
          reject(new Error('微信官方脚本加载失败'));
        };
        document.head.appendChild(script);
      });
    };

    // 3. 自定义 CSS：隐藏二维码页面的标题/提示文字，居中显示
    const customCss = [
      '.impowerBox .qrcode { margin: 0 auto; }',
      '.impowerBox .title { display: none; }',
      '.impowerBox .info { display: none; }',
      '.impowerBox .status { display: none; }',
      '.impowerBox .wrap { overflow: hidden; }',
    ].join('');
    const href = `data:text/css;charset=utf-8,${encodeURIComponent(customCss)}`;

    const initWxLogin = async () => {
      try {
        await loadWxScript();

        // 清空容器
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        // 通过 WxLogin 渲染二维码
        wxLoginInstanceRef.current = new window.WxLogin({
          self_redirect: true,
          id: containerRef.current.id,
          appid,
          redirect_uri,
          state,
          scope,
          style: 'black',
          href,
        });

        // 监听 iframe 插入，自适应容器大小
        if (containerRef.current) {
          const fitIframe = () => {
            const iframe = containerRef.current.querySelector('iframe');
            if (iframe) {
              const containerWidth = containerRef.current.offsetWidth;
              const containerHeight = containerRef.current.offsetHeight;
              
              // WxLogin 默认内容尺寸约 300×400
              const originalWidth = 300;
              const originalHeight = 400;
              
              // 计算缩放比例（保持宽高比，取较小值确保不溢出）
              const scale = Math.min(containerWidth / originalWidth, containerHeight / originalHeight);
              
              // 设置 iframe 为原始尺寸
              iframe.style.width = `${originalWidth}px`;
              iframe.style.height = `${originalHeight}px`;
              iframe.style.border = 'none';
              iframe.style.display = 'block';
              
              // 居中 + 缩放：translate 先居中，scale 再缩放
              iframe.style.position = 'absolute';
              iframe.style.left = '50%';
              iframe.style.top = '50%';
              iframe.style.transform = `translate(-50%, -50%) scale(${scale})`;
              iframe.style.transformOrigin = 'center center';
              
              return true;
            }
            return false;
          };

          // 尝试立即适配
          if (!fitIframe()) {
            // iframe 异步插入，用 MutationObserver 监听
            observerRef.current = new MutationObserver(() => {
              if (fitIframe()) {
                observerRef.current?.disconnect();
                observerRef.current = null;
              }
            });
            observerRef.current.observe(containerRef.current, {
              childList: true,
              subtree: true,
            });
          }
        }

        onReady?.();
      } catch (err) {
        console.error('[WechatOfficialQr] 初始化失败:', err);
        onError?.(err);
      }
    };

    initWxLogin();

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (wxLoginInstanceRef.current) {
        wxLoginInstanceRef.current = null;
      }
    };
  }, [authUrl, onReady, onError]);

  return (
    <div
      ref={containerRef}
      id={containerId}
      className="w-full h-full overflow-hidden"
    />
  );
}
