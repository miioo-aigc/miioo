import { useEffect, useMemo, useState } from 'react';

import {
  apiCompleteLiveMaterialAuthSession,
  emitLiveMaterialAuthCompleted,
} from '../api/liveMaterials';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

export default function LiveMaterialAuthCallbackPage() {
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('正在完成真人认证，请稍候…');

  const query = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      sessionId: params.get('session_id') || '',
      resultCode: params.get('resultCode') || '',
      bytedToken: params.get('bytedToken') || '',
      source: params.get('source') || '',
      projectId: params.get('project_id') || '',
      storyboardId: params.get('storyboard_id') || '',
      returnPath: params.get('return_path') || '/',
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!query.sessionId) {
        setStatus('error');
        setMessage('缺少 session_id，无法完成真人认证。');
        return;
      }

      try {
        const result = await apiCompleteLiveMaterialAuthSession({
          session_id: query.sessionId,
          result_code: query.resultCode,
          byted_token: query.bytedToken,
          query_params: {
            source: query.source,
            project_id: query.projectId,
            storyboard_id: query.storyboardId,
            return_path: query.returnPath,
          },
        });
        if (cancelled) return;
        emitLiveMaterialAuthCompleted(result);
        setStatus('success');
        setMessage('真人认证已完成，正在返回页面…');
        window.setTimeout(() => {
          window.location.replace(result?.redirect_path || query.returnPath || '/');
        }, 600);
      } catch (error) {
        if (cancelled) return;
        setStatus('error');
        setMessage(error?.message || '真人认证失败，请返回后重试。');
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#111111',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          borderRadius: '16px',
          background: '#161616',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
          padding: '28px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div
          style={{
            fontFamily: FONT_MEDIUM,
            fontSize: '18px',
            lineHeight: '24px',
            color: '#FFFFFF',
          }}
        >
          真人素材认证
        </div>
        <div
          style={{
            fontFamily: FONT,
            fontSize: '14px',
            lineHeight: '22px',
            color: status === 'error' ? '#FF8A8A' : 'rgba(255,255,255,0.80)',
          }}
        >
          {message}
        </div>
        {status === 'error' && (
          <button
            type="button"
            onClick={() => window.location.replace(query.returnPath || '/')}
            style={{
              marginTop: '4px',
              alignSelf: 'flex-start',
              height: '36px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.14)',
              background: '#2DC3E1',
              color: '#090909',
              padding: '0 16px',
              fontFamily: FONT_MEDIUM,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            返回页面
          </button>
        )}
      </div>
    </div>
  );
}
