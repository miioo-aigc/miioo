/**
 * @file ScriptStoryboardDocument.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   只读展示分镜脚本文稿信息和下载动作，不调用 API。
 *   下载动作复用 UI TextButton 的 link 变体。
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-22  下载入口改用 TextButton link 变体，保留后端地址和禁用态
 *   2026-08-06  后端未返回下载地址时允许父级通过稳定接口兜底下载
 */
import { TextButton } from '../ui';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

function ExcelIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 133.12 133.12" width="26" height="26" style={{ flexShrink: 0 }}>
      <path d="M117.211 120.477c0 1.664-.665 3.262-1.863 4.46-1.198 1.198-2.795 1.864-4.459 1.863H22.164c-1.664 0-3.328-.665-4.459-1.863-1.198-1.198-1.864-2.795-1.865-4.46V6.327c0-1.664.665-3.328 1.865-4.46C18.836.669 20.5.004 22.164.004h54.446c1.664 0 3.328.665 4.526 1.863l34.279 34.279c1.198 1.198 1.864 2.795 1.863 4.526V120.477z" fill="#EBECF0" />
      <path d="M3.128 69.759h126.797v31.681c0 3.528-2.862 6.323-6.323 6.324H9.518c-1.664 0-3.328-.665-4.46-1.863-1.198-1.198-1.864-2.795-1.863-4.526V69.759z" fill="#47B347" />
      <path d="M29.685 93.055l-3.994 6.922H16.573l8.72-12.78-7.855-11.781h9.053l3.461 6.257 3.593-6.257h9.053l-8.387 11.781 8.387 12.846h-9.053l-3.86-6.988zM64.696 100.043H45.46v-24.56h8.121v18.836h11.115v5.724zM103.566 93.055l-3.993 6.922H90.521l8.653-12.846-7.854-11.782h9.119l3.46 6.257 3.595-6.257h9.052l-8.453 11.782 8.387 12.846h-9.053l-3.861-6.988z" fill="#FFFFFF" />
    </svg>
  );
}

export default function ScriptStoryboardDocument({ fileName = '', downloadUrl = '', onDownload }) {
  const canDownload = Boolean(downloadUrl || onDownload);
  return (
    <section style={{ display: 'flex', alignItems: 'flex-start', flexDirection: 'column', gap: '6px', width: '100%', fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '8px 0', boxSizing: 'border-box' }}>
        <span style={{ width: '2px', height: '18px', flexShrink: 0, background: '#FFFFFF' }} />
        <h2 style={{ flex: 1, margin: 0, color: '#FFFFFF', fontSize: '18px', lineHeight: '22px', fontWeight: 600 }}>分镜脚本</h2>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', minHeight: '72px', padding: '12px 24px 12px 12px', border: '1px solid #3E3D3D', borderRadius: '12px', boxSizing: 'border-box' }}>
        <ExcelIcon />
        <span title={fileName} style={{ minWidth: 0, overflow: 'hidden', color: '#FFFFFF', fontSize: '14px', lineHeight: '20px', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName || '未获取到分镜脚本文稿'}</span>
        <TextButton
          type="button"
          variant="link"
          disabled={!canDownload}
          onClick={() => { if (downloadUrl) window.open(downloadUrl, '_blank', 'noopener,noreferrer'); else onDownload?.(); }}
          style={{ marginLeft: 'auto', fontFamily: FONT, fontSize: '14px', lineHeight: '20px' }}
          icon={(
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg"><path d="M7 2V9M7 9L4 6.5M7 9L10 6.5M2 11H12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          )}
        >下载</TextButton>
      </div>
    </section>
  );
}
