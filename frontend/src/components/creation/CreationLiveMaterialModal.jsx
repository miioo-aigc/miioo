/**
 * @file CreationLiveMaterialModal.jsx
 * @structure-index
 *
 * ─── 组件职责 ─────────────────────────────────────────────────────
 *   LiveMaterialModal 真人素材组、素材选择、扫码授权和上传审核状态展示
 *   GroupCard / AssetCard                                      模态框内部展示与交互卡片
 *
 * ─── 数据流与副作用 ─────────────────────────────────────────────
 *   open / initialSelected → 加载素材组并恢复已选素材
 *   onConfirm → 向 InputCard 返回可用于生成请求的真人素材元数据
 *   qrOnly / onCreated → 为资产库复用仅扫码录入流程，不展示素材库管理页
 *   API、认证轮询、上传审核轮询和删除操作均封装在本业务域组件内
 *
 * ─── 引用边界 ─────────────────────────────────────────────────────
 *   通过显式 props 接入页面；不读取 CreationPage 闭包
 *   不负责生成请求、任务轮询、Creation Store 或页面 Toast
 *
 * ─── 更新记录 ─────────────────────────────────────────────────────
 *   2026-07-16  从 CreationPage.jsx 抽离真人素材入口及弹窗组合
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../ui';
import ConfirmDialog from '../ConfirmDialog';
import DotsLoading from '../DotsLoading';
import { normalizeImageUrl } from '../../utils/imageUrl';
import {
  apiCreateLiveMaterialAuthSession,
  apiGetLiveMaterialAuthSessionStatus,
  apiListLiveMaterialGroups,
  apiListLiveMaterialAssets,
  apiUploadLiveMaterialAsset,
  apiUpdateLiveMaterialGroup,
  apiDeleteLiveMaterialGroup,
  apiDeleteLiveMaterialAsset,
} from '../../api/liveMaterials';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

function CloseBtn({ onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#FFFFFF66', display: 'flex', alignItems: 'center' }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
    </button>
  );
}

function statusLabel(status) {
  const value = (status || '').toLowerCase();
  if (['failed', 'rejected', 'reject', 'invalid', 'error'].includes(value)) return '审核未通过';
  if (['active', 'approved', 'success', 'succeeded', 'completed', 'complete', 'ready', 'done'].includes(value)) return null;
  // 未知或空状态不能默认放行，必须等后端明确返回通过状态。
  return '审核中';
}

// ─── Live Material Modal ──────────────────────────────────────────────────────

function GroupCard({ displayName, preview, CELL, CELL_H, FONT, onClick, onSaveName, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const [editHov, setEditHov] = useState(false);
  const [editPress, setEditPress] = useState(false);
  const [delHov, setDelHov] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef(null);

  const startEdit = (e) => {
    e.stopPropagation();
    setEditValue(displayName);
    setEditing(true);
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 0);
  };

  const commitEdit = () => {
    const name = editValue.trim() || displayName;
    setEditing(false);
    if (name !== displayName) onSaveName?.(name);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') { setEditing(false); }
  };

  return (
    <div
      onClick={editing ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setEditHov(false); setDelHov(false); }}
      style={{
        width: CELL, height: CELL_H, borderRadius: '8px',
        border: `1px solid ${hovered ? '#FFFFFF1F' : 'transparent'}`,
        cursor: editing ? 'default' : 'pointer', position: 'relative', overflow: 'hidden', flexShrink: 0,
        display: 'flex', flexDirection: 'column', padding: '12px 16px',
        boxSizing: 'border-box', transition: 'border-color 0.15s',
        background: '#1a1a1a',
      }}
    >
      {/* Preview image */}
      {preview && (
        <img src={normalizeImageUrl(preview)} alt={displayName} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      {/* Gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(in oklab 180deg, oklab(100% 0 0 / 20%) 0.13%, oklab(0% 0 0 / 40%) 100%)',
        pointerEvents: 'none',
      }} />
      {/* Content row — fills card, name bottom-left, actions bottom-right */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', position: 'relative', zIndex: 1, minWidth: 0 }}>
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            maxLength={30}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={onKeyDown}
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1, minWidth: 0, fontFamily: FONT, fontSize: '14px', lineHeight: '18px',
              color: '#FFFFFFCC', background: 'transparent', border: 'none', borderBottom: '1px solid #FFFFFF4D',
              outline: 'none', padding: '0 0 1px 0', caretColor: '#FFFFFFCC',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          />
        ) : (
          <span style={{
            fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFFCC',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1,
          }}>
            {displayName}
          </span>
        )}
        {hovered && !editing && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', flexShrink: 0, marginLeft: '6px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Edit button */}
            <div
              onMouseEnter={() => setEditHov(true)}
              onMouseLeave={() => { setEditHov(false); setEditPress(false); }}
              onMouseDown={() => setEditPress(true)}
              onMouseUp={() => setEditPress(false)}
              onClick={startEdit}
              style={{
                width: '24px', height: '24px', borderRadius: '6px', flexShrink: 0,
                background: editPress ? '#44444499' : editHov ? '#2a2a2a99' : '#00000080',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'background 0.12s',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.333 14H14.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3.667 8.907V11.333H6.106L13 4.436L10.565 2L3.667 8.907Z" stroke="#FFFFFF" strokeLinejoin="round" />
              </svg>
            </div>
            {/* Delete button */}
            <div
              onMouseEnter={() => setDelHov(true)}
              onMouseLeave={() => { setDelHov(false); }}
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
              style={{
                width: '24px', height: '24px', borderRadius: '6px', flexShrink: 0,
                background: '#00000080',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'background 0.12s',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 3.333V14.667H13V3.333H3Z" stroke={delHov ? '#FF4444' : '#FFFFFF'} strokeLinejoin="round" style={{ transition: 'stroke 0.12s' }} />
                <path d="M6.667 6.667V11" stroke={delHov ? '#FF4444' : '#FFFFFF'} strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke 0.12s' }} />
                <path d="M9.333 6.667V11" stroke={delHov ? '#FF4444' : '#FFFFFF'} strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke 0.12s' }} />
                <path d="M1.333 3.333H14.667" stroke={delHov ? '#FF4444' : '#FFFFFF'} strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke 0.12s' }} />
                <path d="M5.333 3.333L6.43 1.333H9.592L10.667 3.333H5.333Z" stroke={delHov ? '#FF4444' : '#FFFFFF'} strokeLinejoin="round" style={{ transition: 'stroke 0.12s' }} />
              </svg>
            </div>
          </div>
        )}
      </div>
      {confirmDelete && (
        <ConfirmDialog
          title="确认删除"
          description={`删除「${displayName}」后无法恢复，确定要删除吗？`}
          confirmText="删除"
          onConfirm={() => { setConfirmDelete(false); onDelete?.(); }}
          onCancel={() => setConfirmDelete(false)}
          zIndex={1100}
        />
      )}
    </div>
  );
}

function AssetCard({ asset, label, isApproved, isSel, CELL, CELL_H, FONT, onClick, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const [delHov, setDelHov] = useState(false);
  const [fullHov, setFullHov] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const isPending = label === '审核中';
  const isFailed = label === '审核未通过';

  // 全屏预览尺寸：80vw 或 80vh 取最小值保持正方形
  const fsSize = 'min(80vw, 80vh)';

  return (
    <>
      <div
        onClick={isApproved ? onClick : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setDelHov(false); setFullHov(false); }}
        style={{
          width: CELL, height: CELL_H, borderRadius: '8px', flexShrink: 0, position: 'relative',
          overflow: 'hidden', cursor: isApproved ? 'pointer' : 'default', boxSizing: 'border-box',
          boxShadow: hovered && isApproved ? 'inset 0 0 0 1px #FFFFFF1F' : 'none',
          transition: 'box-shadow 0.15s',
          background: '#1a1a1a',
        }}
      >
        {/* Image */}
        {asset.preview_url ? (
          <img src={normalizeImageUrl(asset.preview_url)} alt={asset.name || ''} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: '#FFFFFF0D' }} />
        )}

        {/* 审核中：半透明遮罩 + 文字居中 */}
        {isPending && (
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#00000099, #00000099)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', textAlign: 'center' }}>
              <DotsLoading size={4} color="#2DC3E1" gap={3} />
              <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF' }}>审核中</span>
            </div>
          </div>
        )}

        {/* 审核未通过：半透明遮罩 + 文字左下 + 删除按钮右下 */}
        {isFailed && (
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#00000099, #00000099)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-end', padding: '12px 16px' }}>
            <div style={{ position: 'absolute', bottom: '12px', left: '16px', fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF' }}>审核未通过</div>
            <div
              onMouseEnter={() => setDelHov(true)}
              onMouseLeave={() => { setDelHov(false); }}
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
              style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#00000099', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 3.333V14.667H13V3.333H3Z" stroke={delHov ? '#FF4444' : '#FFFFFF'} strokeLinejoin="round" style={{ transition: 'stroke 0.12s' }} />
                <path d="M6.667 6.667V11" stroke={delHov ? '#FF4444' : '#FFFFFF'} strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke 0.12s' }} />
                <path d="M9.333 6.667V11" stroke={delHov ? '#FF4444' : '#FFFFFF'} strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke 0.12s' }} />
                <path d="M1.333 3.333H14.667" stroke={delHov ? '#FF4444' : '#FFFFFF'} strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke 0.12s' }} />
                <path d="M5.333 3.333L6.43 1.333H9.592L10.667 3.333H5.333Z" stroke={delHov ? '#FF4444' : '#FFFFFF'} strokeLinejoin="round" style={{ transition: 'stroke 0.12s' }} />
              </svg>
            </div>
          </div>
        )}

        {/* Checkbox：选中态 = 蓝色实心勾；悬停已审核未选中 = 空心占位 */}
        {(isSel || (hovered && isApproved)) && (
          <div style={{ position: 'absolute', top: '6px', left: '6px', padding: '2px', zIndex: 2, display: 'flex', alignItems: 'center' }}>
            <div style={{
              width: '16px', height: '16px', borderRadius: '3px', flexShrink: 0,
              background: isSel ? '#2DC3E1' : '#090909',
              border: '1px solid #FFFFFF33',
              outline: '1px solid #00000080',
              position: 'relative',
            }}>
              {isSel && (
                <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', left: '50%', top: '50%', translate: '-50% -50%', overflow: 'visible' }}>
                  <path d="M3.333 8L6.667 11.333L13.333 4.667" fill="none" stroke="#090909" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>
        )}

        {/* 悬停（已审核，未选中）：右下角全屏 + 删除 */}
        {hovered && isApproved && !isSel && (
          <div style={{ position: 'absolute', bottom: '12px', right: '16px', display: 'flex', gap: '6px', alignItems: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 全屏按钮 */}
            <div
              onMouseEnter={() => setFullHov(true)}
              onMouseLeave={() => setFullHov(false)}
              onClick={(e) => { e.stopPropagation(); setFullscreen(true); }}
              style={{ width: '24px', height: '24px', borderRadius: '6px', background: fullHov ? '#2a2a2a99' : '#00000099', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'background 0.12s' }}
            >
              <svg viewBox="0 0 81.92 81.92" xmlns="http://www.w3.org/2000/svg" width="16" height="16" style={{ flexShrink: 0 }}>
                <path d="M36.873 75.264h-25.6l20.992-20.992c1.024-1.024 1.024-3.072 0-4.096-1.024-1.536-3.072-1.536-4.608 0l-20.992 20.992v-27.648c0-1.536-1.536-3.072-3.072-3.072s-3.072 1.536-3.072 3.072v29.184c0 4.096 3.072 9.216 7.68 9.216h28.672c1.536 0 3.072-1.536 3.072-3.072 0-2.048-1.536-3.584-3.072-3.584zM75.273 0.512h-30.208c-1.536 0-3.072 1.536-3.072 3.072s1.536 3.072 3.072 3.072h25.6l-21.504 20.992c-1.024 1.024-1.024 3.072 0 4.608 1.536 1.024 3.584 1.024 4.608 0l20.992-20.992v25.6c0 1.536 1.536 3.072 3.072 3.072s3.072-1.536 3.072-3.072v-28.16c0.512-5.12-2.048-8.192-5.632-8.192z" fill="#FFFFFF" />
              </svg>
            </div>
            {/* 删除按钮 */}
            <div
              onMouseEnter={() => setDelHov(true)}
              onMouseLeave={() => setDelHov(false)}
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
              style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#00000099', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'background 0.12s' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 3.333V14.667H13V3.333H3Z" stroke={delHov ? '#FF4444' : '#FFFFFF'} strokeLinejoin="round" style={{ transition: 'stroke 0.12s' }} />
                <path d="M6.667 6.667V11" stroke={delHov ? '#FF4444' : '#FFFFFF'} strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke 0.12s' }} />
                <path d="M9.333 6.667V11" stroke={delHov ? '#FF4444' : '#FFFFFF'} strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke 0.12s' }} />
                <path d="M1.333 3.333H14.667" stroke={delHov ? '#FF4444' : '#FFFFFF'} strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke 0.12s' }} />
                <path d="M5.333 3.333L6.43 1.333H9.592L10.667 3.333H5.333Z" stroke={delHov ? '#FF4444' : '#FFFFFF'} strokeLinejoin="round" style={{ transition: 'stroke 0.12s' }} />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* 删除确认弹窗 */}
      {confirmDelete && (
        <ConfirmDialog
          title="确认删除"
          description="删除后无法恢复，确定要删除这张素材吗？"
          confirmText="删除"
          onConfirm={() => { setConfirmDelete(false); onDelete?.(); }}
          onCancel={() => setConfirmDelete(false)}
          zIndex={1100}
        />
      )}

      {/* 全屏预览 */}
      {fullscreen && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 2000, background: '#000000CC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setFullscreen(false)}
        >
          <img
            src={normalizeImageUrl(asset.preview_url)}
            alt={asset.name || ''}
            style={{ width: fsSize, height: fsSize, objectFit: 'contain', borderRadius: '8px', pointerEvents: 'none' }}
          />
        </div>,
        document.body
      )}
    </>
  );
}

export default function CreationLiveMaterialModal({ open, onClose, onConfirm, initialSelected = [], qrOnly = false, onCreated }) {
  const [groups, setGroups] = useState([]);
  const [assetsMap, setAssetsMap] = useState({}); // groupId -> assets[]
  const [selectedMap, setSelectedMap] = useState({}); // { [assetId]: { groupId, assetId, assetRefUrl, previewUrl, name } }
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('groups'); // 'groups' | 'assets'
  const [activeGroup, setActiveGroup] = useState(null); // LiveMaterialGroupResponse
  const [uploading, setUploading] = useState(false);
  const [uploadToast, setUploadToast] = useState(null); // string | null
  const [qrState, setQrState] = useState(null); // null | { phase:'scanning', launchUrl, sessionId } | { phase:'success', newGroup }
  const [pendingGroupName, setPendingGroupName] = useState('');
  const [groupNameOverrides, setGroupNameOverrides] = useState({}); // groupId -> display name（临时覆盖，后端已持久化）
  const pollTimerRef = useRef(null);
  const fileInputRef = useRef(null);
  const assetPollRef = useRef(null);

  // Load groups when modal opens
  useEffect(() => {
    if (!open) return;
    if (qrOnly) {
      // 资产库只复用扫码录入流程，不加载或展示创作模块的素材库管理页。
      return;
    }
    // 用已选素材初始化 selectedMap，保持跨次打开的选中状态
    const initMap = Object.fromEntries((initialSelected || []).map(m => [m.assetId, m]));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 打开弹窗时恢复上次选中的素材
    setSelectedMap(initMap);
    setView('groups');
    setActiveGroup(null);
    setQrState(null);
    setLoading(true);
    apiListLiveMaterialGroups()
      .then(async (gs) => {
        setGroups(gs);
        const entries = await Promise.all(
          gs.map(async (g) => {
            try { return [g.id, await apiListLiveMaterialAssets(g.id, { refresh: true })]; }
            catch { return [g.id, []]; }
          })
        );
        setAssetsMap(Object.fromEntries(entries));
    })
      .catch((error) => { console.warn('[CreationLiveMaterialModal] 加载真人素材组失败', error); })
      .finally(() => setLoading(false));
  // 仅在弹窗从关闭变为打开时加载；initialSelected 在 InputCard 中按渲染生成新数组。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, qrOnly]);

  // Cleanup polling on unmount / close
  useEffect(() => {
    if (!open) {
      clearInterval(pollTimerRef.current);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 关闭弹窗时清理认证子弹窗
      setQrState(null);
    }
    return () => clearInterval(pollTimerRef.current);
  }, [open]);


  const handleAddNew = async () => {
    try {
      const session = await apiCreateLiveMaterialAuthSession({ source: qrOnly ? 'assets' : 'creation' });
      const prevIds = new Set(groups.map(g => g.id));
      setQrState({ phase: 'scanning', launchUrl: session.launch_url, sessionId: session.session_id });
      pollTimerRef.current = setInterval(async () => {
        try {
          const { status, group: statusGroup } = await apiGetLiveMaterialAuthSessionStatus(session.session_id);
          if (status === 'completed') {
            clearInterval(pollTimerRef.current);
            // 刷新 groups 列表
            const gs = await apiListLiveMaterialGroups();
            setGroups(gs);
            const entries = await Promise.all(
              gs.map(async (g) => {
                try { return [g.id, await apiListLiveMaterialAssets(g.id, { refresh: true })]; }
                catch { return [g.id, []]; }
              })
            );
            setAssetsMap(Object.fromEntries(entries));
            // 优先用 status 接口返回的 group，其次从刷新列表中找新增的
            const newGroup = statusGroup || gs.find(g => !prevIds.has(g.id)) || null;
            setPendingGroupName(newGroup?.name || '默认姓名');
            setQrState({ phase: 'success', newGroup });
          } else if (status === 'failed') {
            clearInterval(pollTimerRef.current);
            setQrState(null);
          }
        } catch (error) { console.warn('[CreationLiveMaterialModal] operation failed', error); }
      }, 3000);
    } catch (error) { console.warn('[CreationLiveMaterialModal] operation failed', error); }
  };

  const handleSaveName = async () => {
    const finalName = pendingGroupName.trim() || '默认姓名';
    if (qrState?.newGroup) {
      try {
        const updated = await apiUpdateLiveMaterialGroup(qrState.newGroup.id, { name: finalName });
        // 用后端返回的最新数据更新 groups 列表
        setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
        onCreated?.(updated);
      } catch (error) {
        console.warn('[CreationLiveMaterialModal] 保存素材组名称失败', error);
        // 接口失败时降级：仅更新本地显示
        setGroupNameOverrides(prev => ({ ...prev, [qrState.newGroup.id]: finalName }));
        onCreated?.({ ...qrState.newGroup, name: finalName });
      }
    }
    setQrState(null);
    if (qrOnly) onClose?.();
  };

  useEffect(() => {
    if (!open || !qrOnly) return undefined;
    const startTimer = setTimeout(() => handleAddNew(), 0);
    return () => {
      clearTimeout(startTimer);
      clearInterval(pollTimerRef.current);
    };
  // 仅在扫码模式打开时创建一次认证会话。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, qrOnly]);

  const handleGroupClick = async (group) => {
    setActiveGroup(group);
    setView('assets');
    // 每次进入都带 refresh=true，从 OneLinkAI 同步最新审核状态
    try {
      const assets = await apiListLiveMaterialAssets(group.id, { refresh: true });
      setAssetsMap(prev => ({ ...prev, [group.id]: assets }));
    } catch (error) { console.warn('[CreationLiveMaterialModal] operation failed', error); }
  };

  const handleGroupSaveName = async (group, newName) => {
    try {
      const updated = await apiUpdateLiveMaterialGroup(group.id, { name: newName });
      setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
    } catch (error) {
      console.warn('[CreationLiveMaterialModal] 更新素材组名称失败', error);
      setGroupNameOverrides(prev => ({ ...prev, [group.id]: newName }));
    }
  };

  const handleGroupDelete = async (group) => {
    try {
      await apiDeleteLiveMaterialGroup(group.id);
      setGroups(prev => prev.filter(g => g.id !== group.id));
      setAssetsMap(prev => { const next = { ...prev }; delete next[group.id]; return next; });
      if (activeGroup?.id === group.id) { setActiveGroup(null); setView('groups'); }
    } catch (err) {
      console.error('删除素材组失败', err);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeGroup) return;
    // 仅允许图片格式
    if (!file.type.startsWith('image/')) {
      setUploadToast('仅支持上传图片格式');
      setTimeout(() => setUploadToast(null), 3000);
      e.target.value = '';
      return;
    }
    // 30MB 限制
    if (file.size > 30 * 1024 * 1024) {
      setUploadToast('图片大小不能超过 30MB');
      setTimeout(() => setUploadToast(null), 3000);
      e.target.value = '';
      return;
    }
    setUploading(true);
    try {
      const asset = await apiUploadLiveMaterialAsset(activeGroup.id, file, 'image');
      setAssetsMap(prev => ({ ...prev, [activeGroup.id]: [asset, ...(prev[activeGroup.id] || [])] }));
      startAssetStatusPolling(activeGroup.id);
    } catch {
      setUploadToast('上传失败，请重试');
      setTimeout(() => setUploadToast(null), 3000);
    }
    setUploading(false);
    e.target.value = '';
  };

  // 轮询该组内所有 pending/processing 资产的审核状态，直到全部终态
  const startAssetStatusPolling = (groupId) => {
    if (assetPollRef.current) return; // 已在轮询
    assetPollRef.current = setInterval(async () => {
      try {
        const assets = await apiListLiveMaterialAssets(groupId, { refresh: true });
        setAssetsMap(prev => {
          const previousAssets = prev[groupId] || [];
          const previousById = new Map(previousAssets.map(asset => [asset.id, asset]));
          const nextAssets = assets.map(asset => {
            const previous = previousById.get(asset.id);
            const currentStatus = (asset.status || '').toLowerCase();
            const previousStatus = (previous?.status || '').toLowerCase();
            if (previous && !['active', 'approved', 'success', 'succeeded', 'completed', 'complete', 'ready', 'done', 'failed', 'rejected', 'reject', 'invalid', 'error'].includes(currentStatus)
              && !['active', 'approved', 'success', 'succeeded', 'completed', 'complete', 'ready', 'done', 'failed', 'rejected', 'reject', 'invalid', 'error'].includes(previousStatus)) {
              return { ...previous, status: asset.status || previous.status, error_message: asset.error_message || previous.error_message, updated_at: asset.updated_at || previous.updated_at };
            }
            return asset;
          });
          return { ...prev, [groupId]: nextAssets };
        });
        const allDone = assets.every(a => { const s = (a.status || '').toLowerCase(); return s !== 'pending' && s !== 'processing'; });
        if (allDone) { clearInterval(assetPollRef.current); assetPollRef.current = null; }
      } catch (error) { console.warn('[CreationLiveMaterialModal] operation failed', error); }
    }, 4000);
  };

  const handleAssetDelete = async (asset) => {
    try {
      await apiDeleteLiveMaterialAsset(asset.id);
      const gid = asset.group_id || activeGroup?.id;
      setAssetsMap(prev => ({ ...prev, [gid]: (prev[gid] || []).filter(a => a.id !== asset.id) }));
      if (selectedMap[asset.id]) setSelectedMap(prev => { const next = { ...prev }; delete next[asset.id]; return next; });
    } catch (err) {
      console.error('删除素材失败', err);
    }
  };

  const handleConfirm = () => {
    const items = Object.values(selectedMap);
    if (!items.length) { onClose(); return; }
    onConfirm?.(items);
    onClose();
  };

  if (!open) return null;

  const MODAL_W = 800;
  const MODAL_H = 600;
  const CELL = 242;
  const CELL_H = 160;
  const GAP = 12;

  const groupAssets = activeGroup ? (assetsMap[activeGroup.id] || []) : [];

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Main modal：资产库的 qrOnly 模式只显示下面的扫码弹窗。 */}
      {!qrOnly && <div style={{ width: MODAL_W, height: MODAL_H, background: '#161616', borderRadius: '16px', border: '1px solid #FFFFFF0D', boxShadow: '0 8px 32px #00000099', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header — 固定标题 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', flexShrink: 0 }}>
          <span style={{ fontFamily: FONT, fontSize: '16px', fontWeight: 500, lineHeight: '20px', color: '#FFFFFF', flex: 1 }}>Seedance2.0真人素材库</span>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible', flexShrink: 0 }}>
              <path d="M2.667 2.667L13.333 13.333" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2.667 13.333L13.333 2.667" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: '1 1 0%', overflow: 'auto', padding: '0 24px 8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* 面包屑 — 仅在 assets 视图显示 */}
          {view === 'assets' && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <button type="button" onClick={() => { setView('groups'); setActiveGroup(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF66' }}>
                返回/
              </button>
              <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF' }}>
                {groupNameOverrides[activeGroup?.id] || activeGroup?.name || '素材库'}
              </span>
            </div>
          )}
          {loading ? (
            <div style={{ color: '#FFFFFF66', fontFamily: FONT, fontSize: '13px' }}>加载中...</div>
          ) : view === 'groups' ? (
            /* Groups view */
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: GAP }}>
              {/* Add new */}
              <button type="button" onClick={handleAddNew}
                style={{ width: CELL, height: CELL_H, borderRadius: '8px', border: '1px dashed #FFFFFF33', background: '#FFFFFF08', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#FFFFFF66', fontFamily: FONT, fontSize: '12px', flexShrink: 0, transition: 'background 0.15s, border-color 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#FFFFFF14'; e.currentTarget.style.borderColor = '#FFFFFF55'; e.currentTarget.style.color = '#FFFFFF99'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF08'; e.currentTarget.style.borderColor = '#FFFFFF33'; e.currentTarget.style.color = '#FFFFFF66'; }}
                onMouseDown={(e) => { e.currentTarget.style.background = '#FFFFFF1F'; e.currentTarget.style.borderColor = '#FFFFFF66'; }}
                onMouseUp={(e) => { e.currentTarget.style.background = '#FFFFFF14'; e.currentTarget.style.borderColor = '#FFFFFF55'; }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M10 6.5v7M6.5 10h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                录入新的真人
              </button>
              {/* Group cards */}
              {groups.map((group) => {
                const displayName = groupNameOverrides[group.id] || group.name || '未命名';
                const preview = assetsMap[group.id]?.[0]?.preview_url;
                return (
                  <GroupCard key={group.id} displayName={displayName} preview={preview} CELL={CELL} CELL_H={CELL_H} FONT={FONT}
                    onClick={() => handleGroupClick(group)}
                    onSaveName={(newName) => handleGroupSaveName(group, newName)}
                    onDelete={() => handleGroupDelete(group)}
                  />
                );
              })}
            </div>
          ) : (
            /* Assets view */
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: GAP }}>
              {/* Upload card */}
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                style={{ width: CELL, height: CELL_H, borderRadius: '8px', border: '1px dashed #FFFFFF33', background: '#FFFFFF08', cursor: uploading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexShrink: 0, transition: 'background 0.15s' }}
                onMouseEnter={(e) => { if (!uploading) { e.currentTarget.style.background = '#FFFFFF14'; e.currentTarget.style.borderColor = '#FFFFFF55'; } }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF08'; e.currentTarget.style.borderColor = '#FFFFFF33'; }}
              >
                <svg viewBox="0 0 102.4 102.4" xmlns="http://www.w3.org/2000/svg" width="20" height="20" style={{ flexShrink: 0 }}>
                  <path d="M79.997 76.8H22.397a3.2 3.2 0 0 1-3.2-3.2v-25.6a3.2 3.2 0 0 1 3.2-3.2h6.4a3.2 3.2 0 1 1 0 6.4H25.597v19.2h51.2v-19.2h-3.2a3.2 3.2 0 0 1 0-6.4h6.4a3.2 3.2 0 0 1 3.2 3.2v25.6a3.2 3.2 0 0 1-3.2 3.2z m-25.6-40.272v24.275a3.2 3.2 0 0 1-6.4 0v-24.288l-4.128 4.128a3.2 3.2 0 0 1-4.512-4.512l9.408-9.408a3.194 3.194 0 0 1 1.981-1.088 3.197 3.197 0 0 1 2.723 0.896l9.6 9.6A3.2 3.2 0 0 1 60.797 41.6a3.2 3.2 0 0 1-2.272-0.928L54.397 36.528z" fill="#FFFFFFCC" />
                </svg>
                <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFFCC', flexShrink: 0 }}>
                  {uploading ? '上传中...' : '上传'}
                </span>
              </button>
              {/* Asset cards */}
              {groupAssets.map((asset) => {
                const label = statusLabel(asset.status);
                const isApproved = !label;
                const isSel = !!selectedMap[asset.id];
                return (
                  <AssetCard key={asset.id} asset={asset} label={label} isApproved={isApproved} isSel={isSel} CELL={CELL} CELL_H={CELL_H} FONT={FONT}
                    onClick={() => {
                      if (!isApproved) return;
                      if (isSel) {
                        setSelectedMap(prev => { const next = { ...prev }; delete next[asset.id]; return next; });
                      } else {
                        setSelectedMap(prev => ({ ...prev, [asset.id]: { groupId: asset.group_id, groupType: activeGroup?.group_type, assetId: asset.id, assetRefUrl: asset.asset_ref_url, previewUrl: asset.preview_url, name: asset.name || activeGroup?.name } }));
                      }
                    }}
                    onDelete={() => handleAssetDelete(asset)}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: '#161616', borderTop: '1px solid #FFFFFF0D' }}>
          <div style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: Object.keys(selectedMap).length > 0 ? '#FFFFFF' : 'transparent', userSelect: 'none' }}>
            已选 {Object.keys(selectedMap).length}
          </div>
          <Button variant="primary" size="large" onClick={handleConfirm}>确定</Button>
        </div>
      </div>}

      {/* QR scanning sub-modal */}
      {qrState?.phase === 'scanning' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1001, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) { clearInterval(pollTimerRef.current); setQrState(null); if (qrOnly) onClose?.(); } }}
        >
          <div style={{ width: 400, background: '#161616', borderRadius: '12px', border: '1px solid #FFFFFF0D', boxShadow: '0 8px 32px #00000099', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px' }}>
              <span style={{ fontFamily: FONT, fontSize: '14px', fontWeight: 500, color: '#FFFFFFCC' }}>扫码授权人像资产</span>
              <CloseBtn onClick={() => { clearInterval(pollTimerRef.current); setQrState(null); if (qrOnly) onClose?.(); }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 24px 32px', gap: '16px' }}>
              <div style={{ background: 'white', padding: '12px', borderRadius: '8px' }}>
                <QRCodeSVG value={qrState.launchUrl} size={200} />
              </div>
              <span style={{ fontFamily: FONT, fontSize: '13px', color: '#FFFFFF99' }}>请使用手机扫码进行人脸检测</span>
            </div>
          </div>
        </div>
      )}

      {/* Success + name editing sub-modal */}
      {qrState?.phase === 'success' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1001, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 400, background: '#161616', borderRadius: '12px', border: '1px solid #FFFFFF0D', boxShadow: '0 8px 32px #00000099', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px' }}>
              <span style={{ fontFamily: FONT, fontSize: '14px', fontWeight: 500, color: '#FFFFFFCC' }}>扫码授权人像资产</span>
              <CloseBtn onClick={handleSaveName} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px', gap: '12px' }}>
              {/* Success icon */}
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="28" height="22" viewBox="0 0 28 22" fill="none">
                  <path d="M2 11l8 8L26 2" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span style={{ fontFamily: FONT, fontSize: '13px', color: '#FFFFFFCC' }}>授权成功</span>
            </div>
            {/* Name input */}
            <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input
                type="text"
                value={pendingGroupName}
                onChange={(e) => setPendingGroupName(e.target.value)}
                placeholder="默认姓名"
                style={{
                  width: '100%', height: '40px', boxSizing: 'border-box',
                  background: 'transparent', border: '1px solid #FFFFFF1F',
                  borderRadius: '8px', padding: '0 12px',
                  fontFamily: FONT, fontSize: '14px', color: '#FFFFFFCC',
                  outline: 'none',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#FFFFFF40'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#FFFFFF1F'; }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="primary" size="large" onClick={handleSaveName}>保存</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload error toast */}
      {uploadToast && createPortal(
        <div style={{ position: 'fixed', top: '25vh', left: '50%', transform: 'translateX(-50%)', zIndex: 2100, pointerEvents: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: '#1E1E1ECC', backdropFilter: 'blur(20px)', whiteSpace: 'nowrap', fontFamily: FONT, fontSize: '13px', color: '#FF6B6B', border: '1px solid #FF4444' + '33' }}>
            {uploadToast}
          </div>
        </div>,
        document.body
      )}
    </div>,
    document.body
  );
}
