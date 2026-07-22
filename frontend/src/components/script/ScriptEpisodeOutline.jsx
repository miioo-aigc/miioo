/**
 * @file ScriptEpisodeOutline.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   展示分集选择、当前集剧情，以及当前集的编辑和 AI 操作
 *   编辑态复用 ScriptEditor；所有数据修改通过 props 回调交给页面
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-21  新增后端驱动的分集剧情交互区
 *   2026-07-21  支持编排页定位器将分集剧情标题滚动到容器顶部
 *   2026-07-21  剧集标签区改为带外描边的自适应布局，单行时隐藏展开按钮
 *   2026-07-21  调整分集剧情标题行的顶部间距为 4px
 *   2026-07-21  将剧集标签文字字号调整为 14px
 *   2026-07-21  分集操作按钮统一使用通用 Button 的 secondary/danger 变体
 *   2026-07-21  按设计反馈将剧集标签内边距调整为 6px 16px
 *   2026-07-21  将分集剧情展示和编辑区域固定为 600px 高度
 *   2026-07-21  增加剧集标签悬停、新增分集和双击重命名交互
 *   2026-07-21  将剧集标签间距调整为 16px，并为新增按钮动态扩展间隔槽
 *   2026-07-21  新增分集标签从插入间隔中间向两侧展开显示
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../ui';
import ScriptEditor from './ScriptEditor';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

function SparkleIcon() {
  return <svg width="16" height="16" viewBox="0 0 82 82" fill="none" aria-hidden="true"><path d="M51.5 31.5c.5-1.5.7-2.2 1.1-2.4.2-.1.4-.1.6 0 .4.2.7.9 1.1 2.4 2.1 6.3 3.1 9.4 5 11.9.9 1.1 1.9 2.2 3.1 3.1 2.5 1.9 5.6 3 11.9 5 .8.3 1.3.5 1.3 1.1s-.5.8-1.3 1.1c-6.3 2-9.4 3.1-11.9 5-1.2.9-2.2 1.9-3.1 3.1-1.9 2.5-3 5.6-5 11.9-.3.8-.5 1.3-1.1 1.3s-.8-.5-1.1-1.3c-2-6.3-3.1-9.4-5-11.9a18 18 0 0 0-3.1-3.1c-2.5-1.9-5.6-3-11.9-5-.8-.3-1.3-.5-1.3-1.1s.5-.8 1.3-1.1c6.3-2 9.4-3.1 11.9-5 1.1-.9 2.2-1.9 3.1-3.1 1.9-2.5 3-5.6 5-11.9Z" fill="currentColor"/><path d="M20 19c.3-1 .5-1.5.8-1.6.1 0 .2 0 .4 0 .3.1.4.6.8 1.6 1.4 4.2 2.1 6.3 3.4 7.9.6.8 1.3 1.5 2.1 2.1 1.7 1.3 3.7 2 7.9 3.4 1 .3 1.5.5 1.6.8.1.1.1.2 0 .4-.1.3-.6.4-1.6.8-4.2 1.4-6.3 2.1-7.9 3.4-.8.6-1.5 1.3-2.1 2.1-1.3 1.7-2 3.7-3.4 7.9-.3 1-.5 1.5-.8 1.6-.1 0-.2 0-.4 0-.3-.1-.4-.6-.8-1.6-1.4-4.2-2.1-6.3-3.4-7.9-.6-.8-1.3-1.5-2.1-2.1-1.7-1.3-3.7-2-7.9-3.4-1-.3-1.5-.5-1.6-.8-.1-.1-.1-.2 0-.4.1-.3.6-.4 1.6-.8 4.2-1.4 6.3-2.1 7.9-3.4.8-.6 1.5-1.3 2.1-2.1 1.3-1.7 2-3.7 3.4-7.9Z" fill="currentColor"/></svg>;
}

function EditIcon() {
  return <svg width="16" height="16" viewBox="0 0 88 82" fill="none" aria-hidden="true"><path d="M74 74H47c-1.2 0-1.9-1.6-1.9-4s.8-4.1 1.9-4.1h27c1.2 0 1.9 2 1.9 4.1S75.2 74 74 74ZM12.4 74c-.4 0-.8-.4-1.1-.4-.4-.4-.4-.8-.4-1.2l2.7-13c0-.4.4-.8 1.1-1.2.4 0 1.2 0 1.5.4l9.6 10.1c.4.4.4.8.4 1.6 0 .4-.4.8-1.2 1.2L12.4 74ZM34.3 61.9c-.4 0-.8 0-1.2-.4L22.7 51.4c-.4-.4-.4-.8-.4-1.2s0-.8.4-1.2L63 9.3c.4-.4.8-.4 1.2-.4.4 0 .8 0 1.2.4l10.4 10.1c.4.4.4.8.4 1.2s0 .8-.4 1.2L35.4 61.5c-.4.4-.8.4-1.1.4Z" fill="currentColor"/></svg>;
}

function DeleteIcon() {
  return <svg width="16" height="16" viewBox="0 0 82 82" fill="none" aria-hidden="true"><path d="M20.4 65.2c0 4.2 3.5 8.3 7.6 8.3h25.8c4.1 0 7.6-3.6 7.6-8.3l5.3-42.8H15.1l5.3 42.8ZM48.9 30.8h5.3v34.5h-5.3V30.8Zm-11 0h5.9v34.5h-5.9V30.8Zm-10 0h5.3v34.5h-5.3V30.8ZM65.6 12.4H48.6S47.4 7 46.2 7H35.7c-1.2 0-2.3 5.4-2.3 5.4H16.3c-1.8 0-3.5 1.8-3.5 4.2v4.1h56.3v-4.1c0-2.4-1.8-4.2-3.5-4.2Z" fill="currentColor"/></svg>;
}

function getEpisodeContent(episode) {
  return episode?.content || episode?.description || episode?.synopsis || '';
}

export default function ScriptEpisodeOutline({ episodes = [], revision = 0, selectedModel, onResplit, onRegenerate, onPatch, onAdd, onDelete, actionLoading = false, actionError = '', sectionRef }) {
  const [selectedId, setSelectedId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [isEpisodeListExpanded, setIsEpisodeListExpanded] = useState(false);
  const [hasOverflowingEpisodes, setHasOverflowingEpisodes] = useState(false);
  const [editingEpisodeId, setEditingEpisodeId] = useState(null);
  const [episodeNameDraft, setEpisodeNameDraft] = useState('');
  const [revealingEpisodeId, setRevealingEpisodeId] = useState(null);
  const revealTimerRef = useRef(null);
  const episodeListRef = useRef(null);

  useEffect(() => () => {
    if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
  }, []);

  const selectedEpisode = useMemo(() => episodes.find((episode) => episode.id === selectedId) || episodes[0] || null, [episodes, selectedId]);

  useEffect(() => {
    const list = episodeListRef.current;
    if (!list) return undefined;

    const measureOverflow = () => {
      const firstItem = list.firstElementChild;
      const rowHeight = firstItem?.getBoundingClientRect().height || 38;
      const overflowing = list.scrollHeight > rowHeight + 1;
      setHasOverflowingEpisodes(overflowing);
      if (!overflowing) setIsEpisodeListExpanded(false);
    };

    measureOverflow();
    const observer = new ResizeObserver(measureOverflow);
    observer.observe(list);
    return () => observer.disconnect();
  }, [episodes]);

  const selectEpisode = (episode) => {
    if (actionLoading) return;
    setSelectedId(episode.id);
    setIsEditing(false);
    setDraft(getEpisodeContent(episode));
  };

  const saveDraft = async () => {
    if (!selectedEpisode?.id) return;
    await onPatch?.({
      expected_revision: revision,
      operations: [{ type: 'replace_field', target: 'episode_plots', field: 'content', value: draft, item_id: selectedEpisode.id }],
    });
    setIsEditing(false);
  };

  const commitEpisodeName = async () => {
    if (!editingEpisodeId) return;
    const nextName = episodeNameDraft.trim() || '未命名';
    const episode = episodes.find((item) => item.id === editingEpisodeId);
    const currentName = episode?.title || episode?.name || '';
    setEditingEpisodeId(null);
    if (nextName === currentName) return;
    await onPatch?.({
      expected_revision: revision,
      operations: [{ type: 'replace_field', target: 'episode_plots', field: 'title', value: nextName, item_id: editingEpisodeId }],
    });
  };

  const addEpisode = async (afterEpisodeId) => {
    if (actionLoading) return;
    const addedEpisodeId = await onAdd?.(afterEpisodeId);
    if (addedEpisodeId) {
      setSelectedId(addedEpisodeId);
      setRevealingEpisodeId(addedEpisodeId);
      if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = window.setTimeout(() => {
        setRevealingEpisodeId(null);
        revealTimerRef.current = null;
      }, 420);
    }
  };

  return (
    <section ref={sectionRef} style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0 0' }}>
        <span style={{ width: '2px', height: '18px', flexShrink: 0, background: '#FFFFFF' }} />
        <h3 style={{ flex: 1, margin: 0, color: '#FFFFFF', fontSize: '18px', lineHeight: '22px', fontWeight: 600 }}>分集剧情（{episodes.length}）</h3>
        <Button type="button" variant="secondary" icon={<SparkleIcon />} onClick={() => onResplit?.({ base_revision: revision, model: selectedModel })} disabled={actionLoading} contentClassName="!whitespace-nowrap">AI重新分集</Button>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', alignSelf: 'stretch', padding: '12px', border: '1px solid #3E3D3D', borderRadius: '12px', boxSizing: 'border-box' }}>
        <div
          ref={episodeListRef}
          style={{ display: 'flex', flex: 1, minWidth: 0, flexWrap: 'wrap', alignItems: 'flex-start', alignContent: 'flex-start', gap: '8px 0', maxHeight: hasOverflowingEpisodes && !isEpisodeListExpanded ? '38px' : 'none', overflow: hasOverflowingEpisodes && !isEpisodeListExpanded ? 'hidden' : 'visible' }}
        >
          {episodes.map((episode, index) => {
            const active = episode.id === selectedEpisode?.id;
            const episodeName = episode.title || episode.name || '未命名';
            return <div key={episode.id || `${episode.name}-${index}`} className={revealingEpisodeId === episode.id ? 'episode-tag-reveal' : ''} style={{ display: 'flex', flex: '0 0 auto', alignItems: 'center', maxWidth: '100%' }}>
              {editingEpisodeId === episode.id ? <div style={{ display: 'flex', flex: '0 0 auto', alignItems: 'center', maxWidth: '100%', padding: '5px 15px', border: '1px solid #2DC3E180', borderRadius: '999px', background: '#2DC3E133' }}>
                <span style={{ flexShrink: 0, color: '#FFFFFF', fontFamily: FONT, fontSize: '14px', lineHeight: '20px' }}>{String(index + 1).padStart(2, '0')}.</span>
                <input autoFocus value={episodeNameDraft} onChange={(event) => setEpisodeNameDraft(event.target.value)} onBlur={commitEpisodeName} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') setEditingEpisodeId(null); }} aria-label={`编辑第${index + 1}集名称`} style={{ width: '120px', minWidth: 0, padding: 0, border: 0, outline: 0, background: 'transparent', color: '#FFFFFF', fontFamily: FONT, fontSize: '14px', lineHeight: '20px' }} />
              </div> : <button className="episode-tag" data-active={active ? 'true' : 'false'} type="button" onClick={() => selectEpisode(episode)} onDoubleClick={() => { setEditingEpisodeId(episode.id); setEpisodeNameDraft(episodeName); }} disabled={actionLoading} style={{ flex: '0 0 auto', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '6px 16px', borderRadius: '999px', border: `1px solid ${active ? '#2DC3E180' : '#FFFFFF26'}`, background: active ? '#2DC3E133' : '#FFFFFF0D', color: active ? '#FFFFFF' : '#FFFFFFCC', fontFamily: FONT, fontSize: '14px', lineHeight: '20px', cursor: actionLoading ? 'not-allowed' : 'pointer' }} title={`${String(index + 1).padStart(2, '0')}.${episodeName}`}>{String(index + 1).padStart(2, '0')}.{episodeName}</button>}
              {<div className="episode-insert-slot"><button type="button" aria-label={`在第${index + 1}集后新增一集`} onClick={() => addEpisode(episode.id)} disabled={actionLoading} style={{ display: 'flex', width: '16px', height: '16px', flexShrink: 0, alignItems: 'center', justifyContent: 'center', margin: 0, padding: 0, border: 0, borderRadius: '50%', background: 'transparent', color: '#2DC3E1', opacity: 0, cursor: actionLoading ? 'not-allowed' : 'pointer', transition: 'opacity 180ms ease' }} className="episode-insert-button"><svg viewBox="0 0 82 82" width="16" height="16" aria-hidden="true"><path d="M76.271 40.956C76.271 21.454 60.462 5.645 40.961 5.645 21.46 5.645 5.651 21.454 5.651 40.956 5.651 60.457 21.46 76.266 40.961 76.266 60.462 76.266 76.271 60.457 76.271 40.956ZM43.786 38.131V21.184C43.786 19.613 42.521 18.357 40.961 18.357 39.39 18.357 38.136 19.623 38.136 21.184V38.131H21.19C19.618 38.131 18.362 39.396 18.362 40.956 18.362 42.527 19.628 43.781 21.19 43.781H38.136V60.727C38.136 62.298 39.401 63.554 40.961 63.554 42.532 63.554 43.786 62.289 43.786 60.727V43.781H60.732C62.304 43.781 63.56 42.516 63.56 40.956 63.56 39.385 62.294 38.131 60.732 38.131H43.786ZM0.001 40.956C0.001 18.334 18.339-0.004 40.961-0.004 63.583-0.004 81.921 18.334 81.921 40.956 81.921 63.577 63.583 81.916 63.583 81.916 18.339 81.916 0.001 63.577 0.001 40.956Z" fill="currentColor" /></svg></button></div>}
            </div>;
          })}
          {episodes.length === 0 && <div style={{ color: '#FFFFFF66', fontSize: '14px', lineHeight: '20px' }}>暂无分集剧本</div>}
        </div>
        {hasOverflowingEpisodes && <button type="button" onClick={() => setIsEpisodeListExpanded((expanded) => !expanded)} style={{ display: 'flex', flexShrink: 0, alignItems: 'center', gap: '4px', padding: '8px 16px', border: 0, borderRadius: '999px', background: 'transparent', color: '#2DC3E1', fontFamily: FONT, fontSize: '16px', lineHeight: '20px', cursor: 'pointer' }}>
          <svg viewBox="0 0 109.9 71.68" width="14" height="14" aria-hidden="true" style={{ flexShrink: 0, transform: isEpisodeListExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 180ms ease' }}><path d="M106.882 11.725c0 1.3-0.435 2.614-1.3 3.707L59.444 72.786a5.92 5.92 90 0 1-9.213 0L4.337 15.676A5.912 5.912 0 0 1 13.555 8.269l41.287 51.375L96.364 8.015a5.912 5.912 0 0 1 10.513 3.71z" fill="currentColor" /></svg>
          {isEpisodeListExpanded ? '收起' : '展开'}
        </button>}
      </div>

      <div style={{ display: 'flex', height: '600px', minHeight: '600px', flexDirection: 'column', gap: '12px', padding: '12px', border: '1px solid #3E3D3D', borderRadius: '12px', boxSizing: 'border-box' }}>
        {selectedEpisode ? (isEditing ? <div style={{ display: 'flex', minHeight: 0, flex: 1 }}><ScriptEditor initialContent={draft} onContentChange={setDraft} /></div> : <div className="script-md" style={{ flex: 1, minHeight: 0, overflowY: 'auto', whiteSpace: 'pre-wrap', color: '#FFFFFF', fontSize: '14px', lineHeight: '20px' }}>{getEpisodeContent(selectedEpisode) || '暂无剧情内容'}</div>) : <div style={{ color: '#FFFFFF66', fontSize: '14px' }}>暂无可编辑的分集剧情</div>}
        {actionError && <div role="alert" style={{ color: '#F75F5F', fontSize: '12px', lineHeight: '18px' }}>{actionError}</div>}
        {selectedEpisode && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', flexShrink: 0 }}>
          {isEditing ? <><Button type="button" variant="secondary" onClick={saveDraft} disabled={actionLoading}>保存</Button><Button type="button" variant="secondary" onClick={() => { setIsEditing(false); setDraft(getEpisodeContent(selectedEpisode)); }} disabled={actionLoading}>取消</Button></> : <>
            <Button type="button" variant="secondary" icon={<SparkleIcon />} onClick={() => onRegenerate?.(selectedEpisode.id, { base_revision: revision, model: selectedModel })} disabled={actionLoading} contentClassName="!whitespace-nowrap">AI重写本集</Button>
            <Button type="button" variant="secondary" icon={<EditIcon />} onClick={() => { setDraft(getEpisodeContent(selectedEpisode)); setIsEditing(true); }} disabled={actionLoading} contentClassName="!whitespace-nowrap">编辑</Button>
            <Button type="button" variant="danger" icon={<DeleteIcon />} onClick={() => onDelete?.(selectedEpisode.id, revision)} disabled={actionLoading} contentClassName="!whitespace-nowrap">删除本集</Button>
          </>}
        </div>}
      </div>
    </section>
  );
}
