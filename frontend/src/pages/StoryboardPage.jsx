/**
 * @file StoryboardPage.jsx
 * @structure-index
 *
 * ─── 全局常量与工具函数 ───────────────────────────────────── L121–L144
 *   normalizeStoryboard / normalizeStoryboardList / toBackendStoryboard  utils/storyboardDataAdapter.js
 *   buildStoryboardPrompt                      utils/buildStoryboardPrompt.js
 *   enrichMainRefs / buildStoryboardRefFromAsset         适配工具：主体参考图补全与资产映射
 *   PARAM_OPTIONS / PARAM_LABELS               镜头参数枚举
 *   storyboardTaskAdapter.js                   任务状态与媒体结果读取适配
 *
 * ─── 页面内稳定组件 ───────────────────────────────────────── L145–L265
 *   EpisodeSelector / ModalCloseBtn             components/storyboard/StoryboardControls.jsx
 *   ParamSelect / ParamTrigger / DescriptionCol  components/storyboard/DescriptionCol.jsx
 *   CharTag / AddSlotBtn                       components/storyboard/NarrationAtoms.jsx
 *   StoryboardIconPlus                           components/storyboard/StoryboardActionPrimitives.jsx
 *   VoiceDubModal                             components/storyboard/VoiceDubModal.jsx
 *   NarrationItem                              components/storyboard/NarrationItems.jsx
 *   NarrationAddButton                         components/storyboard/NarrationAddButton.jsx
 *   NarrationColWrapper                         components/storyboard/NarrationCol.jsx
 *   ShotRow                                      页面业务桥接 L196–L265
 *   ShotNumberColumn                            components/storyboard/ShotNumberColumn.jsx
 *   StoryboardToast / StoryboardHeader            components/storyboard/
 *   makeStoryboardShot                           utils/storyboardDataAdapter.js
 *   PanelSelect / ModalSelectItem 已迁移至 components/storyboard/PanelSelect.jsx
 *
 * ─── 外部业务域组件 ────────────────────────────────────────
 *   BatchImageModal / BatchVideoModal          components/storyboard/BatchGenerateModals.jsx
 *   StoryboardBatchToolbar                     components/storyboard/StoryboardBatchToolbar.jsx
 *   StoryboardShotRow                          components/storyboard/StoryboardShotRow.jsx
 *   MediaCol / MainRefCol / TextEditCol        components/storyboard/
 *   ShotNumberColumn                            components/storyboard/ShotNumberColumn.jsx
 *   GenerateImagePanel                         components/storyboard/GenerateImagePanel.jsx
 *   GenerateVideoPanel / ReferenceMediaEditor  components/storyboard/
 *
 * ─── 主页面入口 ──────────────────────────────────────────── L274–L1304
 *   [状态与副作用] 分镜数据、API、任务轮询、缓存和持久化 L286–L870
 *   [加载与错误态] LoadingAnimation、DotsLoading、失败操作和统计    L871–L934
 *   [镜头 CRUD] 上传、编辑、复制、删除、排序          L735–L860
 *   [渲染] 状态结果、内容区（列表/时间轴）、生成面板和 Toast L934–L1303
 *   [边界] 页面保留轮询循环、状态写回、缓存、持久化、Toast 和 API 副作用
 *   [外部上传] ReferenceMediaEditor 直接引入 StoryboardUploadSlots，页面不转发上传槽位
 *
 * ─── 更新记录 ──────────────────────────────────────────────────────
 *   2026-07-16  迁移 makeStoryboardShot 至 utils/storyboardDataAdapter.js；页面保留新增分镜 API 和状态写回
 *   2026-07-16  迁移 normalizeStoryboard、toBackendStoryboard、urlPathKey 和 enrichMainRefs 至 utils/storyboardDataAdapter.js；页面保留数据请求、写回和副作用
 *   2026-07-16  迁移 ShotNumberColumn、CardActionBtn、NUMBER_BTNS 和镜头编号列图标至 components/storyboard/ShotNumberColumn.jsx；页面继续通过显式回调接入镜头新增、复制和选择
 *   2026-07-16  迁移 ParamSelect、ParamTrigger、DescriptionCol 至 components/storyboard/DescriptionCol.jsx；镜头字段仍通过显式 onChange 写回
 *   2026-07-16  迁移 VoiceDubModal、NarrationItem、NarrationAddButton 至 components/storyboard；旁白列保留状态和保存副作用
 *   2026-07-16  迁移 NarrationCol / NarrationColWrapper 至 components/storyboard/NarrationCol.jsx；页面仅保留镜头写回接线
 *   2026-07-16  迁移 CharTag / AddSlotBtn 至 components/storyboard/NarrationAtoms.jsx；旁白列仍通过显式点击回调接入
 *   2026-07-16  迁移 EpisodeSelector、ModalCloseBtn 及选集工具函数至 components/storyboard/StoryboardControls.jsx；页面保留当前集数和业务回调
 *   2026-07-08  修复台词分配列：删除所有台词后刷新又出现 → toBackendStoryboard 在 segments 为空时显式发送 gen_params.narration_segments=[]，
 *              后端不再保留旧结构化数据，normalizeStoryboard 不再从 be.narration 恢复旧台词
*   2026-07-08  修复分镜视频弹窗 @ 主体标签分类错乱（场景/道具都显示成「角色」、本地上传显示「其他」）：
 *              1) 新增 subjectTypeFromCategory + MENTION 常量增加 other:「其他」；
 *              2) videoReferenceItems 兜底改为 other（不再假冒 char）；
 *              3) buildStoryboardRefFromAsset 按资产 category 还原真实类型（角色/场景/道具），不再硬编码 char；
 *              4) 视频弹窗 onAssetConfirm 改用 buildStoryboardRefFromAsset，与图片弹窗一致，类型正确且落到 character_ids；
 *              5) refSubjects 初始化时用 subjectId 跨 chars/scenes/props 反查真实类型 → 刷新后场景/道具标签不再退化成角色
 *   2026-07-07  修复「主体参考」与主体定稿图脱节：新增 buildStoryboardRefFromAsset，从资产库选中带 subject_id 的图片时建立主体引用（落到 character_ids），
 *              enrichMainRefs 改用 subjectId/type 识别并始终同步最新定稿图；preSelectedSubjectIds 只传真实 subjectId → 换定稿图自动替换、同一主体不可重复添加
 *   2026-07-06  MediaDetailModal 新增 source prop：区分 AI 生成/本地上传/资产库；非 AI 图片右侧显示「来源」字段，提示词和生成参数留空；normalizeStoryboard 根据 image_prompt/gen_params 判断来源；MediaCol onUpload 标记 source
 *   2026-07-06  MediaDetailModal 两处调用补传 generatedAt；生成图片时写入 created_at
 *   2026-07-03  MediaCol 查看大图：传入完整生成历史图片列表（genImageHistoryMap），
 *              底部缩略图展示创作历史而非参考图；参考图仅显示在右侧信息区
 *              MediaDetailModal/ShotViewerModal 传入 zIndex 避免被侧面板遮挡
 *              GenerateImagePanel/GenerateVideoPanel 生成图片时快照 refImages
 *   2026-07-06  enrichMainRefs 移除 !ref.url 守卫，始终用最新 chars 数据更新；新增 useEffect 监听 chars/scenes/props 变化重新富化 shots
 *   2026-07-01  初始结构索引建立
 *   2026-07-02  生成任务跨刷新持久化（taskPersistence）
 *   2026-07-13  修复分镜页破图：ImgItem/MediaCol/生成历史缩略图等渲染点裸用相对路径（media.url/item.url/img.url/shortcutImage.url），
 *              统一用 normalizeImageUrl 包裹，避免后端返回相对路径跨越 origin 时裂图（幂等，完整 URL 原样返回）
 *   2026-07-15  抽离 StoryboardShotRow 行容器、MediaCol 媒体卡片和 MediaColWrapper 媒体列容器到 components/storyboard/，
 *              页面继续持有上传/生成回调、任务轮询、缓存与持久化；新增组件通过显式 props 接收媒体状态和事件出口
 *   2026-07-15  抽离主体参考列 MainRefColWrapper、MainRefCol、添加菜单和悬浮预览到 components/storyboard/MainRefCol.jsx，
 *              页面继续持有主体参考上传 API、资产映射和 mainRefs 写回；通过显式 onUploadFile/onAssetConfirm 接入
 *   2026-07-15  抽离 EditableText 和 TextEditCol 到 components/storyboard/TextEditCol.jsx，
 *              画面描述继续显式使用共享文本编辑器，光影/环境音列通过显式 value/onChange 接入；页面继续持有 shot 写回
 *   2026-07-15  统一剧本页局部按钮到 components/ui/Button；页面包装函数仅保留业务语义，生成失败态的重试和手动添加按钮也完成迁移
 *   2026-07-15  抽离批量生成图片/视频弹窗到 components/storyboard/BatchGenerateModals.jsx，
 *              页面继续持有批量生成 API、任务轮询、状态更新、持久化和 Toast；模型选择器复用 components/ui/Select
 *   2026-07-15  抽离批量生成/批量下载工具栏到 components/storyboard/StoryboardBatchToolbar.jsx，
 *              页面继续持有下载 API、生成回调、任务状态和 Toast；工具栏仅管理展开菜单和事件出口
 *   2026-07-15  抽离 GenerateImagePanel 到 components/storyboard/GenerateImagePanel.jsx，
 *              页面继续持有图片生成 API、任务轮询、持久化、状态写回和 Toast；图片面板通过显式 props 接收页面 UI 与业务回调
 *              同步修复迁移遗留的图片时长引用和视频面板 ModalToggle 未定义引用，改用已有 Toggle 组件
 *   2026-07-15  抽离 GenerateVideoPanel 到 components/storyboard/GenerateVideoPanel.jsx；
 *              后续 VideoUploadCard、VideoResultCard 也归入 components/storyboard/，页面继续持有视频生成任务、轮询、持久化、定稿写回和 Toast
 *   2026-07-16  将 FrameUploadSlot / PanelUploadSlot 迁移至 components/storyboard/StoryboardUploadSlots.jsx，
 *              ReferenceMediaEditor 通过业务域入口直接引入，页面不再持有上传槽位实现或向下转发组件
 *   2026-07-16  新增 utils/storyboardTaskAdapter.js，统一任务状态、图片结果和视频结果字段读取；
 *              页面继续持有 pollTask、状态更新、缓存、持久化、Toast 和分镜写回
 *   2026-07-17  迁移 Toast Portal 展示至 components/storyboard/StoryboardToast.jsx；页面继续持有 toast 状态和触发逻辑
 *   2026-07-17  迁移分镜头部、选集提示和批量工具栏组合至 components/storyboard/StoryboardHeader.jsx；页面继续持有状态和动作回调
 *   2026-07-23  接入 LoadingAnimation、任务提示文案和新版面包屑统计
 *   2026-07-23  分集选择器改用剧本分集全量；切换到未生成分集时按集生成并轮询
 *   2026-07-23  重新分镜时先清空旧列表并进入 LoadingAnimation 加载态，避免旧数据覆盖重新生成状态
 *   2026-07-23  面包屑重新分镜改为打开独立 AIRegenerateStoryboardModal，提交后复用当前分集任务轮询
 *   2026-07-23  重组分镜列表与定稿时间轴为上下两个独立面板，保留镜头行和时间轴卡片业务交互
 *   2026-07-23  未生成分集改为展示手动启动按钮，不再切换分集后自动抽取；空状态容器背景按页面反馈使用透明底色叠加 #060606
 *   2026-07-30  分镜列表按当前返回顺序重新连续编号，分页追加时延续已有编号，修复首个镜头显示为 08 等后端残留编号
 *   2026-07-24  分镜生成失败态支持清除失败快照后重新发起任务
 *   2026-07-15  抽离 PanelPromptInput、ReferenceMentionDropdown 和 SubjectTag 到 components/storyboard/PanelPromptInput.jsx，
 *              页面只负责把提示词组件注入生成面板；提示词编辑、原子提及、光标处理和展示态标签由组件内部维护
 *   2026-07-15  抽离 PanelSelect / ModalSelectItem 到 components/storyboard/PanelSelect.jsx，
 *              图片和视频生成面板直接复用选择器；页面只负责模型、比例、时长和分辨率的值与变更回调
 *   2026-07-15  治理 StoryboardPage 历史 ESLint 问题：清理未使用导入、变量和无调用方的旧局部组件，
 *              恢复并修正仍被旁白/新增分镜流程使用的 CharTag、AddSlotBtn、makeStoryboardShot 等引用；
 *              补全 Hook 依赖并将页面同步副作用延后到 requestAnimationFrame；定向 ESLint 达到 0 errors / 0 warnings，
 *              不改变 API、任务轮询、缓存、持久化和用户交互边界
 *   2026-07-29  分镜详情查看统一使用 StoryboardMediaDetailModal，图片/视频候选共用列表和定稿状态
 *   2026-07-30  分镜详情参考图改为缩略图展示，兼容参考图嵌套字段，并补齐提示词字段读取
 *   2026-07-30  按真实后端逻辑文档统一生成任务响应适配：兼容 task_id/id 及嵌套任务，单集覆盖生成显式确认，图片/视频生成统一进入任务轮询
 *   2026-07-30  修复定稿时间轴初始媒体缺失：兼容候选媒体预览/封面字段和 is_finalized，使用分镜主记录字段兜底匹配，候选与定稿映射按镜头增量合并
 *   2026-07-30  修复重新分镜 409：API 层补发 confirm_overwrite=true，确保页面确认覆盖意图传到后端
 *   2026-07-30  修复重新分镜任务未继续轮询：提交后立即读取任务状态，持久化 storyboard 任务，并在刷新/返回页面后恢复轮询
 *   2026-07-30  统一重新分镜任务 ID 与状态适配：未知处理中状态继续轮询，避免提交成功后提前结束
 *   2026-07-30  分镜列表网络加载期间在内容区居中显示 DotsLoading，避免请求期间误显示空态或空列表
 *   2026-07-31  修复主体参考列漏查场景和道具：分镜加载、分页、刷新及新增镜头统一使用角色/场景/道具主体索引，旁白列仍仅使用角色
 *   2026-07-31  修复主体参考本地上传封面显示「？」：兼容上传响应 image/asset 嵌套图片地址，解析失败时回滚临时卡片
 *   2026-07-31  分镜首屏优先保留本地缓存文字：后台刷新期间不清空已缓存镜头，仅在无缓存或切换分集时显示整页加载
 *   2026-07-31  修复分集信息异步到达时缓存未及时恢复：分集 effect 内同步读取当前分集缓存，已有镜头时不再显示整页 loading
 *   2026-07-31  分镜数据请求失败时区分网络错误与真实空集，避免已有数据未加载时误显示「开始智能分镜」
 *   2026-07-31  切回分镜页面时媒体候选重新请求期间保持局部加载动画，未完成本轮请求不因文字缓存或旧媒体字段提前结束
 *   2026-07-31  分镜首轮数据请求增加分集级完成标记，接口返回前不误显示「开始智能分镜」或失败态
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ModalCloseBtn } from '../components/storyboard/StoryboardControls';
import StoryboardToast from '../components/storyboard/StoryboardToast';
import StoryboardHeader from '../components/storyboard/StoryboardHeader';
import { getEpisodeId } from '../components/storyboard/storyboardControlUtils';
import { apiUploadStoryboardImage, apiUploadStoryboardVideo, apiGenerateStoryboardImage, apiGenerateStoryboardVideo, apiGenerateStoryboardsFromEpisode, apiCreateStoryboard, apiUpdateStoryboard, apiUpdateStoryboardCreationForm, apiDeleteStoryboard, apiReorderStoryboards, apiGetStoryboards, apiBatchDownloadStoryboardImages, apiBatchDownloadStoryboardVideos, apiGetTask, apiListStoryboardMediaCandidates, apiCreateStoryboardMediaCandidate, apiUpdateStoryboardMediaCandidate, apiDownloadStoryboardMediaCandidate } from '../api/storyboard';
import { apiGetEpisodes, normalizeEpisodeListResponse } from '../api/subject';
import { apiUploadCreationImage } from '../api/creation';
import LoadingAnimation from '../components/LoadingAnimation';
import DotsLoading from '../components/DotsLoading';
import { normalizeImageUrl, toAbsoluteUrl } from '../utils/imageUrl';
import {
  extractStoryboardImageUrl,
  extractStoryboardVideoUrl,
  getStoryboardTaskId as getTaskIdFromAdapter,
  getStoryboardTaskStatus,
  hasStoryboardImageTaskResult,
  hasStoryboardVideoTaskResult,
  isStoryboardTaskInProgress,
} from '../utils/storyboardTaskAdapter';

function getCandidateKey(media) {
  return media?.id || media?.url || media?.download_url || media?.downloadUrl || null;
}

function mergeCandidateOrder(previous = [], incoming = []) {
  const incomingByKey = new Map(incoming.map((item) => [getCandidateKey(item), item]).filter(([key]) => key));
  const ordered = previous
    .map((item) => incomingByKey.get(getCandidateKey(item)))
    .filter(Boolean);
  const existingKeys = new Set(ordered.map(getCandidateKey));
  const additions = incoming.filter((item) => {
    const key = getCandidateKey(item);
    return key && !existingKeys.has(key);
  });
  return [...ordered, ...additions];
}

function getStoryboardTaskId(task) {
  return getTaskIdFromAdapter(task);
}

function unwrapStoryboardTaskResponse(value) {
  let payload = value?.data ?? value?.payload ?? value;
  if (payload?.task && typeof payload.task === 'object') return payload.task;
  if (payload && typeof payload === 'object' && (
    payload.id || payload.task_id || payload.taskId || payload.status || payload.raw_status
  )) return payload;
  if (payload?.result && typeof payload.result === 'object') {
    payload = payload.result;
    if (payload.task && typeof payload.task === 'object') return payload.task;
  }
  return payload;
}

function getStoryboardTaskError(task, fallback) {
  const detail = task?.detail;
  const detailMessage = typeof detail === 'string' ? detail : detail?.message || detail?.detail;
  return task?.status_message
    || task?.statusMessage
    || task?.params?.status_message
    || task?.params?.statusMessage
    || detailMessage
    || task?.error?.message
    || task?.error?.detail
    || task?.error
    || task?.message
    || task?.params?.error
    || fallback;
}

function hasBackendStoryboardIds(items) {
  return Array.isArray(items) && items.every((item) => isBackendStoryboardId(
    item?.id ?? item?.storyboard_id ?? item?.storyboardId ?? item?.uuid
  ));
}

import { Button } from '../components/ui';
import { subscribe, peekCache, invalidate } from '../utils/cache';
import { K, MEDIUM } from '../utils/cacheKeys';
import { buildStoryboardRefFromAsset, getUploadedImageId, getUploadedImageUrl, toSafeStoryboardReferenceUrls } from '../utils/storyboardReferenceAdapter';
import { enrichMainRefs, isBackendStoryboardId, makeStoryboardShot, normalizeStoryboard, normalizeStoryboardList, toBackendStoryboard } from '../utils/storyboardDataAdapter';
import buildStoryboardPrompt from '../utils/buildStoryboardPrompt';
import { addPendingTask, removePendingTask, getPendingTasks } from '../utils/taskPersistence';
import { downloadBlob } from '../utils/downloadBlob';
import {
  MainRefColWrapper as StoryboardMainRefColWrapper,
  TextEditCol as StoryboardTextEditCol,
  BatchImageModal,
  BatchVideoModal,
  GenerateImagePanel,
  GenerateVideoPanel,
  PanelPromptInput,
  StoryboardShotRow,
  ShotNumberColumn,
  NarrationColWrapper,
  DescriptionCol,
  StoryboardIconPlus,
  StoryboardContentArea,
  StoryboardShotMediaColumn,
  StoryboardFinalizedTimeline,
  StoryboardCreationPanel,
  StoryboardMediaDetailModal,
  AIRegenerateStoryboardModal,
} from '../components/storyboard';

// ─── 后端/前端数据模型双向映射 ───────────────────────────────────────────────


// ─── 集数选择器（面包屑下拉）─────────────────────────────────────────────────

// ─── 生成分镜图面板 ────────────────────────────────────────────────────────────

// ─── 删除确认弹窗 ─────────────────────────────────────────────────────────────
// DeleteConfirmModal 已迁移至 ConfirmDialog 共享组件（接受 description 参数渲染镜头编号）

// 资产 category → 主体参考 _type：仅角色/场景/道具为真实主体类型，其余（分镜图/参考图/创作资产/本地上传）统一为 other
// ─── 角色 Tag（旁白列展示用）───────────────────────────────────────────────────

// ─── 旁白配音弹窗 ─────────────────────────────────────────────────────────────

// ─── 旁白配音列 ───────────────────────────────────────────────────────────────

// ─── (旧版内联编辑已废弃，保留以备参考) ─────────────────────────────────────

// ─── 主体参考列 ───────────────────────────────────────────────────────────────

// ─── 媒体列（分镜图 / 分镜视频）已迁移至 components/storyboard/MediaCol.jsx ─────────

// ─── 镜头编号列已迁移至 components/storyboard/ShotNumberColumn.jsx ───────────

// ─── 旁白配音列容器 ───────────────────────────────────────────────────────────

// ─── 主体参考列容器 ───────────────────────────────────────────────────────────

// ─── 分镜行 ───────────────────────────────────────────────────────────────────

function ShotRow({ shot, onChange, onAdd, onCopy, onDelete, chars, isDragging, onDragStart, onDragOver, onDrop, insertBefore, insertAfter, globalVoiceParams, onSaveGlobalVoice, projectId, generatingImage, generatingVideo, candidates = [], mediaLoading = false, onOpenCreation, onFinalizeToggle, onSelectShot, isSelectMode = false, isSelected = false, isActive = false, onSelect, onToggleSelect, onUploadImage, onUploadVideo }) {
  async function handleMainRefFileUpload({ file, tempRef, nextRefs }) {
    const result = await apiUploadCreationImage({ file, category: 'reference', project_id: projectId });
    const uploadedUrl = normalizeImageUrl(getUploadedImageUrl(result));
    if (!uploadedUrl) {
      throw new Error('上传成功但未返回可用的图片地址');
    }
    const updatedRefs = nextRefs.map((ref) => (
      ref.id === tempRef.id
        ? { id: getUploadedImageId(result, uploadedUrl), url: uploadedUrl, name: file.name, type: file.type, uploaded: true }
        : ref
    ));
    onChange({ ...shot, mainRefs: updatedRefs });
  }

  function handleMainRefAssetConfirm(assets) {
    const newRefs = assets.map(buildStoryboardRefFromAsset);
    onChange({ ...shot, mainRefs: [...shot.mainRefs, ...newRefs] });
  }

  return (
    <StoryboardShotRow
      shot={shot}
      onDelete={onDelete}
      isDragging={isDragging}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      insertBefore={insertBefore}
      insertAfter={insertAfter}
      isSelectMode={isSelectMode}
      isSelected={isSelected}
      isActive={isActive}
      onSelect={onSelect}
    >
          <ShotNumberColumn
            number={shot.number}
            onAdd={onAdd}
            onCopy={onCopy}
            isSelectMode={isSelectMode}
            isSelected={isSelected}
            onToggleSelect={onToggleSelect}
          />
          <DescriptionCol shot={shot} onChange={onChange} />
          <StoryboardTextEditCol label="光影" value={shot.lightShadow} onChange={(v) => onChange({ ...shot, lightShadow: v })} />
          <StoryboardTextEditCol label="环境音" value={shot.ambientSound} onChange={(v) => onChange({ ...shot, ambientSound: v })} />
          <NarrationColWrapper shot={shot} onChange={onChange} chars={chars} globalVoiceParams={globalVoiceParams} onSaveGlobalVoice={onSaveGlobalVoice} />
          <StoryboardMainRefColWrapper
            shot={shot}
            onChange={onChange}
            projectId={projectId}
            onUploadFile={handleMainRefFileUpload}
            onAssetConfirm={handleMainRefAssetConfirm}
          />
          <StoryboardShotMediaColumn
            image={shot.storyboardImage}
            video={shot.storyboardVideo}
            candidates={candidates}
            loading={mediaLoading}
            generating={generatingImage || generatingVideo}
            onOpenCreation={onOpenCreation}
            onFinalizeToggle={onFinalizeToggle}
            onSelectShot={onSelectShot}
            onUpload={(file) => {
              if (file.type.startsWith('video/')) onUploadVideo?.(shot, { id: URL.createObjectURL(file), url: URL.createObjectURL(file), name: file.name, type: file.type, file });
              else onUploadImage?.(shot, { id: URL.createObjectURL(file), url: URL.createObjectURL(file), name: file.name, type: file.type, file });
            }}
            shotLabel={`镜头 ${String(shot.number).padStart(2, '0')}`}
          />
    </StoryboardShotRow>
  );
}

// 新增分镜默认数据由纯适配工具提供，页面只负责调用和提交。

const EPISODES = ['第一集', '第二集'];
const STORYBOARD_PAGE_SIZE = 10;

function StartStoryboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M14.333 5.667V3H11.333M14.333 5.667V10.333M14.333 5.667H11.333M11.333 3V5.667M11.333 3H10M14.333 10.333V13H11.333M14.333 10.333H11.333M11.333 5.667H10M1.667 5.667V3H4.667M1.667 5.667V10.333M1.667 5.667H4.667M4.667 3V5.667M4.667 3H6M1.667 10.333V13H4.667M1.667 10.333H4.667M4.667 5.667H6M4.667 13V10.333M4.667 13H6M4.667 10.333H6M11.333 13V10.333M11.333 13H10M11.333 10.333H10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 2.333V3.667M8 5.667V7M8 9V10.333M8 12.333V13.667" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

export default function StoryboardPage({ projectId, projectName = '两只老虎的奇遇', projectRatio, chars = [], scenes = [], props = [], episodes = EPISODES, initialEpisodeIndex = null, onUnlockStep, onGenerateStoryboards, onRetryGenerateStoryboards, generateError = null, isGenerating: homeIsGenerating = false, completedEpisodesCount = 0, statusMessage = '' }) {

  // 分镜主体参考可能同时包含角色、场景和道具；旁白列仍只使用 chars。
  const storyboardSubjects = useMemo(() => {
    const seen = new Set();
    return [...chars, ...scenes, ...props].filter((subject) => {
      const key = subject?.id;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [chars, scenes, props]);

  // 选择器的唯一数据源是剧本分集，不根据当前分镜接口返回结果裁剪列表。
  const [scriptEpisodes, setScriptEpisodes] = useState(() => episodes.length > 0 ? episodes : []);
  const activeEpisodes = scriptEpisodes.length > 0 ? scriptEpisodes : EPISODES;
  // 用 peekCache 同步读取缓存，第一次渲染直接呈现旧数据，避免空状态闪烁
  const [shots, setShots] = useState(() => {
    if (!projectId) return [];
    const cachedEpisodes = episodes.length > 0
      ? episodes
      : (peekCache(K.episodes(projectId), MEDIUM.CONTENT) ?? []);
    const targetIdx = (initialEpisodeIndex != null && initialEpisodeIndex >= 0 && initialEpisodeIndex < cachedEpisodes.length)
      ? initialEpisodeIndex : 0;
    const initialEpisode = cachedEpisodes[targetIdx];
    if (!initialEpisode || typeof initialEpisode === 'string') return [];
    const episodeId = initialEpisode?.id ?? '';
    if (!episodeId) return [];
    // 先找 episode 级缓存，找不到 fallback 到 :all（:all 是项目全量分镜，同样可用）
    const raw =
      peekCache(K.storyboards(projectId, episodeId), MEDIUM.CONTENT) ??
      peekCache(K.storyboards(projectId), MEDIUM.CONTENT);
    if (!raw || !Array.isArray(raw)) return [];
    const currentEpisodeRaw = raw.filter((item) => (item.episode_id ?? item.episodeId) === episodeId);
    return normalizeStoryboardList(currentEpisodeRaw, storyboardSubjects).slice(0, STORYBOARD_PAGE_SIZE);
  });
  const [globalVoiceParams, setGlobalVoiceParams] = useState({});
  const [episode, setEpisode] = useState(() => {
    const idx = (initialEpisodeIndex != null && initialEpisodeIndex >= 0 && initialEpisodeIndex < activeEpisodes.length)
      ? initialEpisodeIndex : 0;
    return activeEpisodes[idx] ?? '第一集';
  });
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [episodeGenerationError, setEpisodeGenerationError] = useState(false);
  const [isLoadingEpisode, setIsLoadingEpisode] = useState(() => shots.length === 0);
  const [hasLoadedEpisodeData, setHasLoadedEpisodeData] = useState(false);
  const [loadedEpisodeDataKey, setLoadedEpisodeDataKey] = useState(null);
  const [storyboardLoadError, setStoryboardLoadError] = useState(false);
  const [hasMoreShots, setHasMoreShots] = useState(true);
  const [isLoadingMoreShots, setIsLoadingMoreShots] = useState(false);
  const generatingEpisodeRef = useRef(null);
  const generatedEpisodeIdsRef = useRef(new Set());
  const loadedEpisodeRef = useRef(null);
  const shotListRef = useRef(null);
  const storyboardPageRef = useRef(null);

  useEffect(() => {
    function handleOutsideStoryboardClick(event) {
      if (storyboardPageRef.current?.contains(event.target)) return;
      if (event.target.closest('[role="dialog"], [data-storyboard-overlay="true"]')) return;
      setActiveShotId(null);
    }

    document.addEventListener('mousedown', handleOutsideStoryboardClick);
    return () => document.removeEventListener('mousedown', handleOutsideStoryboardClick);
  }, []);

  // 用户是否手动操作过（添加/删除分镜），如果操作过就不再展示智能分镜失败的错误态
  const hasManuallyInteracted = useRef(false);

  const [loadingTextIndex, setLoadingTextIndex] = useState(0);
  const loadingTexts = ['正在智能分镜中', '请稍等', '等待时间大约5分钟', '请耐心等待'];

  useEffect(() => {
    if (!isGenerating && !homeIsGenerating) return;
    const timer = setInterval(() => {
      setLoadingTextIndex(prev => (prev + 1) % loadingTexts.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [isGenerating, homeIsGenerating, loadingTexts.length]);

  const [generatingImages, setGeneratingImages] = useState(false);
  const [generatingVideos, setGeneratingVideos] = useState(false);
  const [generatingImageShotIds, setGeneratingImageShotIds] = useState(new Set());
  const [generatingVideoShotIds, setGeneratingVideoShotIds] = useState(new Set());
  const [toast, setToast] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [downloadMode, setDownloadMode] = useState(false);
  const [selectedShotIds, setSelectedShotIds] = useState(new Set());
  // 单镜头生成面板
  const [imagePanel, setImagePanel] = useState(null); // { shot }
  const [videoPanel, setVideoPanel] = useState(null); // { shot, nextShot }
  const [genImageHistoryMap, setGenImageHistoryMap] = useState({}); // { [shotId]: generatedImages[] }
  const [genVideoHistoryMap, setGenVideoHistoryMap] = useState({}); // { [shotId]: generatedVideos[] }
  const [imageFormStateMap, setImageFormStateMap] = useState({}); // { [shotId]: image creation form state }
  const [videoFormStateMap, setVideoFormStateMap] = useState({}); // { [shotId]: video creation form state }
  const imageFormStateRef = useRef({});
  const videoFormStateRef = useRef({});
  const creationFormSaveTimersRef = useRef(new Map());
  const shotsRef = useRef(shots);
  shotsRef.current = shots;
  const [candidateMediaMap, setCandidateMediaMap] = useState({});
  const [finalizedMediaMap, setFinalizedMediaMap] = useState({});
  const [mediaLoadingMap, setMediaLoadingMap] = useState({});
  const mediaRequestVersionRef = useRef(new Map());
  const [timelinePreviewMedia, setTimelinePreviewMedia] = useState(null);
  const [creationPanel, setCreationPanel] = useState(null); // { shot, tab }
  const [activeShotId, setActiveShotId] = useState(null);
  const [regenerateModalOpen, setRegenerateModalOpen] = useState(false);
  const [regenerateModalKey, setRegenerateModalKey] = useState(0);
  const [regenerateModalError, setRegenerateModalError] = useState('');

  function hydrateCreationForms(nextShots) {
    const backendImages = {};
    const backendVideos = {};
    (nextShots || []).forEach((shot) => {
      if (shot.creationForm?.image) backendImages[shot.id] = shot.creationForm.image;
      if (shot.creationForm?.video) backendVideos[shot.id] = shot.creationForm.video;
    });
    imageFormStateRef.current = { ...backendImages, ...imageFormStateRef.current };
    videoFormStateRef.current = { ...backendVideos, ...videoFormStateRef.current };
    setImageFormStateMap(imageFormStateRef.current);
    setVideoFormStateMap(videoFormStateRef.current);
  }

  const scheduleCreationFormSave = useCallback((shotId, image, video) => {
    const timer = creationFormSaveTimersRef.current.get(shotId);
    if (timer) clearTimeout(timer);
    const nextTimer = setTimeout(() => {
      const shot = shotsRef.current.find((item) => item.id === shotId);
      apiUpdateStoryboardCreationForm(projectId, shotId, {
        image,
        video,
        genParams: shot?.genParams,
      }).catch((error) => {
        console.error('[StoryboardPage] 保存创作面板状态失败:', error);
      }).finally(() => {
        creationFormSaveTimersRef.current.delete(shotId);
      });
    }, 450);
    creationFormSaveTimersRef.current.set(shotId, nextTimer);
  }, [projectId]);

  useEffect(() => () => {
    creationFormSaveTimersRef.current.forEach((timer) => clearTimeout(timer));
    creationFormSaveTimersRef.current.clear();
  }, []);

function fallbackCandidates(shot) {
    const fallbackMedia = [shot.storyboardImage, shot.storyboardVideo].filter(Boolean);
    const finalizedId = fallbackMedia[0]?.id || fallbackMedia[0]?.url;
    return fallbackMedia.map((media) => ({
      ...media,
      id: media.id || media.url,
      url: media.url,
      media_type: media.type?.startsWith('video') ? 'video' : 'image',
      is_finalized: (media.id || media.url) === finalizedId,
      source: media.source || 'storyboard-existing',
    }));
  }

  const loadShotCandidates = useCallback(async (currentShots) => {
    const validShots = (currentShots || []).filter((shot) => isBackendStoryboardId(shot?.backendId || shot?.id));
    const loadingIds = validShots.map((shot) => shot.id);
    const requestVersions = new Map(loadingIds.map((id) => {
      const nextVersion = (mediaRequestVersionRef.current.get(id) || 0) + 1;
      mediaRequestVersionRef.current.set(id, nextVersion);
      return [id, nextVersion];
    }));
    setMediaLoadingMap((prev) => ({ ...prev, ...Object.fromEntries(loadingIds.map((id) => [id, true])) }));
    const entries = await Promise.all(validShots.map(async (shot) => {
      const backendId = shot.backendId || shot.id;
      try {
        const items = await apiListStoryboardMediaCandidates(projectId, backendId);
        return [shot.id, items, shot];
      } catch {
        return [shot.id, fallbackCandidates(shot), shot];
      }
    }));
    const nextCandidates = Object.fromEntries(entries.map(([id, items]) => [id, items]));
    const nextFinalized = Object.fromEntries(entries.map(([id, items, shot]) => {
      const explicitFinalized = items.find((item) => item.is_finalized || item.isFinalized);
      if (explicitFinalized) return [id, explicitFinalized];

      // 兼容后端候选接口暂未返回 is_finalized，但分镜主记录已有定稿地址的情况。
      const storyboardMedia = [shot.storyboardImage, shot.storyboardVideo].filter(Boolean);
      const matched = storyboardMedia.find((media) => {
        const mediaKey = getCandidateKey(media);
        return mediaKey && items.some((item) => getCandidateKey(item) === mediaKey);
      });
      if (!matched) return [id, null];
      return [id, items.find((item) => getCandidateKey(item) === getCandidateKey(matched)) || null];
    }));
    setCandidateMediaMap((prev) => {
      const merged = { ...prev };
      Object.entries(nextCandidates).forEach(([shotId, items]) => {
        const finalized = nextFinalized[shotId];
        merged[shotId] = mergeCandidateOrder(prev[shotId] || [], items).map((item) => ({
          ...item,
          is_finalized: finalized ? getCandidateKey(item) === getCandidateKey(finalized) : Boolean(item.is_finalized),
        }));
      });
      return merged;
    });
    setFinalizedMediaMap((prev) => ({ ...prev, ...nextFinalized }));
    setMediaLoadingMap((prev) => {
      const next = { ...prev };
      loadingIds.forEach((id) => {
        if (mediaRequestVersionRef.current.get(id) === requestVersions.get(id)) next[id] = false;
      });
      return next;
    });
  }, [projectId]);

  async function loadMoreShots() {
    const episodeId = getEpisodeId(episode);
    if (!episodeId || isLoadingMoreShots || !hasMoreShots || isGenerating || homeIsGenerating) return;
    setIsLoadingMoreShots(true);
    try {
      const nextPage = await apiGetStoryboards(projectId, {
        episode_id: episodeId,
        limit: STORYBOARD_PAGE_SIZE,
        offset: shotsRef.current.length,
      });
      if (getEpisodeId(episode) !== episodeId || loadedEpisodeRef.current !== episodeId) return;
      const normalized = normalizeStoryboardList(nextPage, storyboardSubjects, shotsRef.current.length);
      setShots((prev) => {
        const existingIds = new Set(prev.map((shot) => shot.id));
        const additions = normalized.filter((shot) => !existingIds.has(shot.id));
        if (additions.length > 0) {
          hydrateCreationForms(additions);
          loadShotCandidates(additions);
        }
        return [...prev, ...additions];
      });
      setHasMoreShots(nextPage.length >= STORYBOARD_PAGE_SIZE);
    } catch (error) {
      console.warn('[StoryboardPage] 加载更多分镜失败:', error);
    } finally {
      setIsLoadingMoreShots(false);
    }
  }

  const refreshCandidateForShot = useCallback(async (shot) => {
    const backendId = shot?.backendId || shot?.id;
    if (!isBackendStoryboardId(backendId)) return;
    try {
      const items = await apiListStoryboardMediaCandidates(projectId, backendId);
      setCandidateMediaMap((prev) => ({
        ...prev,
        [shot.id]: mergeCandidateOrder(prev[shot.id] || [], items),
      }));
      setFinalizedMediaMap((prev) => ({ ...prev, [shot.id]: items.find((item) => item.is_finalized) || null }));
    } catch (error) {
      console.warn('[StoryboardPage] 刷新分镜候选媒体失败:', error);
    }
  }, [projectId]);

  async function saveCandidateMedia(shotId, media) {
    const mediaType = media.mediaType || media.media_type || (media.type?.startsWith('video') ? 'video' : 'image');
    const mediaUrl = media.url || media.fileUrl || media.file_url;
    const rawMetadata = media.metadata || media.metadata_json || media.metadataJson || {};
    const parseObject = (value) => {
      if (!value) return {};
      if (typeof value === 'object' && !Array.isArray(value)) return value;
      if (typeof value !== 'string') return {};
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      } catch {
        return {};
      }
    };
    const metadata = typeof rawMetadata === 'string'
      ? (() => { try { return JSON.parse(rawMetadata) || {}; } catch { return {}; } })()
      : (rawMetadata && typeof rawMetadata === 'object' ? rawMetadata : {});
    const parameterContainers = [
      media.params, media.parameters, media.generation, media.options,
      media.genParams, media.gen_params, media.generation_params, media.generationParams,
      media.provider_params, media.providerParams,
      metadata.params, metadata.parameters, metadata.generation, metadata.options,
      metadata.gen_params, metadata.genParams, metadata.generation_params, metadata.generationParams,
      metadata.provider_params, metadata.providerParams,
    ].map(parseObject).filter((value) => Object.keys(value).length > 0);
    const mergedGenerationParams = Object.assign({}, ...parameterContainers);
    const isAssetLibraryMedia = ['asset-library', 'asset', 'library'].includes(String(media.source || '').toLowerCase());
    const generationKeys = new Set([
      'model', 'resolution', 'size', 'duration', 'ratio', 'aspect_ratio', 'aspectRatio',
      'sound_effect', 'soundEffect', 'generate_audio', 'generateAudio', 'audio_setting', 'audioSetting',
      'reference_images', 'referenceImages', 'first_frame_url', 'firstFrameUrl',
      'reference_image_urls', 'referenceImageUrls',
      'last_frame_url', 'lastFrameUrl', 'reference_video_url', 'referenceVideoUrl',
      'reference_audio_url', 'referenceAudioUrl', 'reference_mode', 'referenceMode',
      'generation_mode', 'generationMode', 'generate_mode', 'generateMode',
      'watermark', 'multi_shot', 'multiShot', 'expand_options', 'expandOptions',
      'subject_completion_options', 'subjectCompletionOptions', 'optimize_prompt', 'optimizePrompt',
      'sequential_image_generation', 'sequentialImageGeneration', 'provider_params', 'providerParams',
    ]);
    const filterGenerationParams = (value) => Object.fromEntries(
      Object.entries(value && typeof value === 'object' ? value : {})
        .filter(([key, value]) => generationKeys.has(key) && value !== undefined && value !== null && value !== ''),
    );
    const rawGenerationParams = mergedGenerationParams;
    const prompt = media.prompt || media.input_prompt || media.inputPrompt || media.prompt_raw || media.promptRaw
      || media.prompt_resolved || media.promptResolved
      || metadata.prompt || metadata.input_prompt || metadata.inputPrompt || metadata.prompt_raw || metadata.promptRaw
      || metadata.prompt_resolved || metadata.promptResolved
      || mergedGenerationParams.prompt || mergedGenerationParams.input_prompt || mergedGenerationParams.inputPrompt;
    const mediaMetadata = isAssetLibraryMedia
      ? {
        ...metadata,
        ...(prompt ? { prompt, input_prompt: prompt } : {}),
        ...(media.prompt_raw || media.promptRaw || metadata.prompt_raw || metadata.promptRaw ? { prompt_raw: media.prompt_raw || media.promptRaw || metadata.prompt_raw || metadata.promptRaw } : {}),
        ...(media.prompt_resolved || media.promptResolved || metadata.prompt_resolved || metadata.promptResolved ? { prompt_resolved: media.prompt_resolved || media.promptResolved || metadata.prompt_resolved || metadata.promptResolved } : {}),
        ...(filterGenerationParams({
          model: media.model ?? metadata.model,
          resolution: media.resolution ?? metadata.resolution,
          size: media.size ?? metadata.size,
          duration: media.duration ?? metadata.duration,
          ratio: media.ratio ?? media.aspect_ratio ?? media.aspectRatio ?? metadata.ratio ?? metadata.aspect_ratio ?? metadata.aspectRatio,
          reference_images: media.referenceImages ?? media.reference_images ?? metadata.reference_images ?? metadata.referenceImages,
          reference_image_urls: media.referenceImageUrls ?? media.reference_image_urls ?? metadata.reference_image_urls ?? metadata.referenceImageUrls,
          provider_params: media.providerParams ?? media.provider_params ?? metadata.provider_params ?? metadata.providerParams,
        })),
        ...(Object.keys(filterGenerationParams(rawGenerationParams)).length > 0 ? { gen_params: filterGenerationParams(rawGenerationParams) } : {}),
      }
      : {
        ...metadata,
        ...(prompt ? { prompt, input_prompt: prompt } : {}),
        ...(media.prompt_raw || media.promptRaw || metadata.prompt_raw || metadata.promptRaw ? { prompt_raw: media.prompt_raw || media.promptRaw || metadata.prompt_raw || metadata.promptRaw } : {}),
        ...(media.prompt_resolved || media.promptResolved || metadata.prompt_resolved || metadata.promptResolved ? { prompt_resolved: media.prompt_resolved || media.promptResolved || metadata.prompt_resolved || metadata.promptResolved } : {}),
        ...(media.model ? { model: media.model } : {}),
        ...(media.resolution ? { resolution: media.resolution } : {}),
        ...(media.duration != null ? { duration: media.duration } : {}),
        ...(media.ratio || media.aspect_ratio || media.aspectRatio ? { ratio: media.ratio || media.aspect_ratio || media.aspectRatio } : {}),
        ...(media.referenceImages || media.reference_images ? { reference_images: media.referenceImages || media.reference_images } : {}),
        ...(Object.keys(rawGenerationParams).length > 0 ? { gen_params: rawGenerationParams } : {}),
      };
    if (isAssetLibraryMedia && Object.keys(mergedGenerationParams).length > 0) {
      mediaMetadata.params = mergedGenerationParams;
      mediaMetadata.generation_params = mergedGenerationParams;
    }
    const payload = {
      media_type: mediaType,
      url: mediaUrl,
      thumbnail_url: media.thumbnail_url || media.thumbnailUrl || media.poster_url || media.posterUrl || mediaUrl,
      poster_url: media.poster_url || media.posterUrl || media.thumbnail_url || media.thumbnailUrl || mediaUrl,
      download_url: media.download_url || media.downloadUrl || null,
      source: media.source || 'ai-generated',
      asset_id: media.asset_id || media.assetId || null,
      metadata: mediaMetadata,
    };
    if (media.created_at || media.createdAt) payload.created_at = media.created_at || media.createdAt;
    if (!payload.url) return null;
    try {
      const saved = await apiCreateStoryboardMediaCandidate(projectId, shotId, payload);
      const candidate = {
        ...payload,
        ...saved,
        // 后端响应可能只返回媒体基础字段，不能覆盖刚从创作资产带来的详情。
        metadata: { ...(payload.metadata || {}), ...(saved?.metadata || {}) },
        prompt: saved?.prompt || saved?.inputPrompt || saved?.input_prompt || payload.metadata?.prompt || payload.metadata?.input_prompt || payload.metadata?.params?.prompt || '',
        input_prompt: saved?.input_prompt || saved?.inputPrompt || saved?.prompt || payload.metadata?.input_prompt || payload.metadata?.prompt || payload.metadata?.params?.input_prompt || '',
        model: saved?.model || payload.metadata?.model || payload.metadata?.params?.model || '',
        resolution: saved?.resolution || payload.metadata?.resolution || payload.metadata?.params?.resolution || '',
        ratio: saved?.ratio || payload.metadata?.ratio || payload.metadata?.params?.ratio || '',
        duration: saved?.duration ?? payload.metadata?.duration ?? payload.metadata?.params?.duration ?? null,
        reference_images: saved?.reference_images || saved?.referenceImages || payload.metadata?.reference_images || payload.metadata?.referenceImages || payload.metadata?.params?.reference_images || null,
        genParams: saved?.genParams || saved?.gen_params || saved?.generation_params || payload.metadata?.gen_params || payload.metadata?.params || {},
        gen_params: saved?.gen_params || saved?.genParams || saved?.generation_params || payload.metadata?.gen_params || payload.metadata?.params || {},
        id: saved?.id || payload.url,
      };
      setCandidateMediaMap((prev) => {
        const current = prev[shotId] || [];
        const candidateKey = getCandidateKey(candidate);
        const withoutDuplicate = current.filter((item) => getCandidateKey(item) !== candidateKey);
        return {
          ...prev,
          [shotId]: [...withoutDuplicate, candidate],
        };
      });
      setFinalizedMediaMap((prev) => ({ ...prev, [shotId]: candidate.is_finalized ? candidate : (prev[shotId] || null) }));
      return candidate;
    } catch (error) {
      console.warn('[StoryboardPage] 候选媒体接口暂不可用，保留兼容媒体字段:', error);
      return null;
    }
  }

  // 从剧本分集接口兜底同步列表。分镜接口只用于读取镜头，不负责提供分集选择项。
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    apiGetEpisodes(projectId).then((data) => {
      if (!cancelled && Array.isArray(data) && data.length > 0) setScriptEpisodes(data);
    }).catch((err) => {
      console.warn('[StoryboardPage] 同步剧本分集失败，继续使用页面传入分集:', err);
    });
    return () => { cancelled = true; };
  }, [projectId]);

  // apiGetEpisodes 使用 SWR 时可能先返回旧缓存，订阅缓存更新后立即替换下拉列表。
  useEffect(() => {
    if (!projectId) return undefined;
    return subscribe(K.episodes(projectId), (data) => {
      const nextEpisodes = normalizeEpisodeListResponse(data);
      if (nextEpisodes.length > 0) setScriptEpisodes(nextEpisodes);
    });
  }, [projectId]);

  // 页面加载时从后端获取剧本数据
  useEffect(() => {
    if (!projectId) return;
    if (typeof episode === 'string') return;

    const episodeId = getEpisodeId(episode);
    if (!episodeId) return;

    // 分集对象可能晚于页面首次渲染到达，因此不能只依赖 useState 初始化时的缓存读取。
    // 在当前分集 effect 内再次同步读取，确保文字缓存先展示，后台请求只负责校验更新。
    const cacheKey = K.storyboards(projectId, episodeId);
    const cacheKeyAll = K.storyboards(projectId);
    const cachedEpisodeData = peekCache(cacheKey, MEDIUM.CONTENT);
    const cachedAllData = peekCache(cacheKeyAll, MEDIUM.CONTENT);
    const cachedRaw = Array.isArray(cachedEpisodeData)
      ? cachedEpisodeData
      : (Array.isArray(cachedAllData)
        ? cachedAllData.filter((item) => (item.episode_id ?? item.episodeId) === episodeId)
        : []);
    const cachedShots = normalizeStoryboardList(cachedRaw, storyboardSubjects).slice(0, STORYBOARD_PAGE_SIZE);
    const hasCachedShots = cachedShots.length > 0;
    const currentEpisode = activeEpisodes.find((item) => getEpisodeId(item) === episodeId);
    const episodeStatus = String(
      currentEpisode?.status
      ?? currentEpisode?.storyboard_status
      ?? currentEpisode?.storyboardStatus
      ?? '',
    ).toLowerCase();
    const episodeStoryboardCount = Number(
      currentEpisode?.storyboard_count
      ?? currentEpisode?.storyboardCount
      ?? currentEpisode?.shot_count
      ?? currentEpisode?.shotCount
      ?? 0,
    );
    const episodeHasKnownStoryboard = episodeStoryboardCount > 0
      || ['storyboarded', 'generated', 'videos_ready', 'no_image', 'images_ready', 'edited'].includes(episodeStatus);
    const episodeIsExplicitlyUngenerated = ['pending', 'draft', 'initial', 'not_started', 'not-started'].includes(episodeStatus);
    const shouldTreatEmptyAsLoadError = !episodeIsExplicitlyUngenerated
      && (episodeHasKnownStoryboard || !currentEpisode);
    let cancelled = false;

    // 切换分集时清空上一集镜头，避免第二集尚未返回时继续显示第一集内容。
    if (loadedEpisodeRef.current !== episodeId) {
      loadedEpisodeRef.current = episodeId;
      setHasLoadedEpisodeData(false);
      setLoadedEpisodeDataKey(null);
      if (hasCachedShots) {
        requestAnimationFrame(() => {
          if (cancelled) return;
          setShots(cachedShots);
          hydrateCreationForms(cachedShots);
          setIsLoadingEpisode(false);
          setStoryboardLoadError(false);
          loadShotCandidates(cachedShots);
        });
      } else {
        requestAnimationFrame(() => {
          if (cancelled) return;
          setShots([]);
          setIsLoadingEpisode(true);
          setStoryboardLoadError(false);
        });
      }
      requestAnimationFrame(() => {
        if (cancelled) return;
        setHasMoreShots(true);
        setIsLoadingMoreShots(false);
      });
      requestAnimationFrame(() => setEpisodeGenerationError(false));
    }

    const onlyCurrentEpisode = (data) => {
      if (!Array.isArray(data)) return [];
      return data.filter((item) => (item.episode_id ?? item.episodeId) === episodeId);
    };

    const loadStoryboardData = async () => {
      const currentData = await apiGetStoryboards(projectId, {
        episode_id: episodeId,
        limit: STORYBOARD_PAGE_SIZE,
        offset: 0,
        include_gen_params: true,
      });
      if (currentData.length > 0) return currentData;

      // 当前集返回空数组不能直接判定为“未生成”：缓存失效、分集 ID 切换，
      // 或后端按集过滤异常时，都可能只让按集请求返回空结果。再查一次项目全量
      // 分镜，避免已有数据被误判为空态。
      const allData = await apiGetStoryboards(projectId, {
        limit: 200,
        offset: 0,
        include_gen_params: true,
      });
      return allData.filter((item) => (item.episode_id ?? item.episodeId) === episodeId);
    };

    loadStoryboardData()
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return;
        // 重新分镜期间保持加载态，避免请求完成后把旧缓存再次显示出来。
        // 任务结束后 homeIsGenerating 变化会重新触发本 effect，再读取最新结果。
        if (isGenerating || homeIsGenerating) return;
        const normalized = normalizeStoryboardList(data, storyboardSubjects);
        setHasMoreShots(data.length >= STORYBOARD_PAGE_SIZE);
        if (normalized.length > 0) {
          // 有数据：直接覆盖（正常加载 / 刷新场景）
          const visible = normalized.slice(0, STORYBOARD_PAGE_SIZE);
          setShots(visible);
          hydrateCreationForms(visible);
          loadShotCandidates(visible);
          setStoryboardLoadError(false);
        } else {
          // 空数组：只有在当前 shots 也为空时才清空，避免剧本定稿后
          // episode ID 变更导致 API 用新 ID 查不到数据而误清已有分镜
          setShots((prev) => (prev.length > 0 ? prev : normalized));
          if (shouldTreatEmptyAsLoadError) setStoryboardLoadError(true);
        }
        if (!cancelled) setIsLoadingEpisode(false);
        if (!cancelled) {
          setHasLoadedEpisodeData(true);
          setLoadedEpisodeDataKey(episodeId);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[StoryboardPage] 加载分镜失败:', err);
          setIsLoadingEpisode(false);
          setHasLoadedEpisodeData(true);
          setLoadedEpisodeDataKey(episodeId);
          setStoryboardLoadError(true);
        }
      });

    const unsub1 = subscribe(cacheKey, (data) => {
      if (!Array.isArray(data)) return;
      if (isGenerating || homeIsGenerating) return;
      const normalized = normalizeStoryboardList(data, storyboardSubjects);
      if (normalized.length > 0) {
        const visible = normalized.slice(0, STORYBOARD_PAGE_SIZE);
        setHasMoreShots(normalized.length >= STORYBOARD_PAGE_SIZE);
        setShots(visible);
        hydrateCreationForms(visible);
        setIsLoadingEpisode(false);
        setHasLoadedEpisodeData(true);
        setLoadedEpisodeDataKey(episodeId);
        setStoryboardLoadError(false);
        loadShotCandidates(visible);
      } else {
        // 空缓存不是“加载完成”：缓存可能刚被清理、持久化失败，或仍在等待接口校验。
        // 保持 loading，避免缓存订阅先发 [] 时误显示「开始智能分镜」。
        setShots((prev) => (prev.length > 0 ? prev : normalized));
      }
    });
    const unsub2 = subscribe(cacheKeyAll, (data) => {
      if (!Array.isArray(data)) return;
      if (isGenerating || homeIsGenerating) return;
      const normalized = normalizeStoryboardList(onlyCurrentEpisode(data), storyboardSubjects);
      if (normalized.length > 0) {
        const visible = normalized.slice(0, STORYBOARD_PAGE_SIZE);
        setHasMoreShots(normalized.length >= STORYBOARD_PAGE_SIZE);
        setShots(visible);
        setIsLoadingEpisode(false);
        setHasLoadedEpisodeData(true);
        setLoadedEpisodeDataKey(episodeId);
        setStoryboardLoadError(false);
        loadShotCandidates(visible);
      } else {
        // :all 缓存同样不能用空数组结束当前分集的加载状态，交给接口请求确认。
        setShots((prev) => (prev.length > 0 ? prev : normalized));
      }
    });

    return () => {
      cancelled = true;
      unsub1();
      unsub2();
    };
  }, [projectId, episode, activeEpisodes, storyboardSubjects, homeIsGenerating, isGenerating, generateError, episodeGenerationError, loadShotCandidates]);

  // 当主体数据变化时（如主体页修改了定稿图），一次性用三类主体重新富化已有 shots。
  useEffect(() => {
    if (!storyboardSubjects.length) return;
    const frameId = requestAnimationFrame(() => {
      setShots(prev => prev.map(shot => enrichMainRefs({ ...shot }, storyboardSubjects)));
    });
    return () => cancelAnimationFrame(frameId);
  }, [storyboardSubjects]);


  useEffect(() => {
    if (activeEpisodes.length > 0 && !activeEpisodes.some(ep => getEpisodeId(ep) === getEpisodeId(episode))) {
      const frameId = requestAnimationFrame(() => setEpisode(activeEpisodes[0]));
      return () => cancelAnimationFrame(frameId);
    }
    const currentEpisode = activeEpisodes.find(ep => getEpisodeId(ep) === getEpisodeId(episode));
    if (currentEpisode && currentEpisode !== episode) {
      const frameId = requestAnimationFrame(() => setEpisode(currentEpisode));
      return () => cancelAnimationFrame(frameId);
    }
  }, [activeEpisodes, episode]);

  // episode 还是字符串（episodes prop 尚未到位）时，订阅 :all key
  // 一旦有数据写入就尝试把 episode 切换到真实对象
  useEffect(() => {
    if (typeof episode !== 'string') return;
    if (!projectId) return;
    const unsub = subscribe(K.storyboards(projectId), () => {
      if (activeEpisodes.length > 0) {
        setEpisode(activeEpisodes[0]);
      }
    });
    return unsub;
  }, [projectId, episode, activeEpisodes]);

  // ── 恢复跨刷新挂起的生成任务 ────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId || typeof episode === 'string') return;
    const epId = getEpisodeId(episode);
    if (!epId) return;

    const pending = getPendingTasks(projectId, epId);
    if (pending.length === 0) return;

    const resumeStoryboard = async (task) => {
      setIsGenerating(true);
      setEpisodeGenerationError(false);
      try {
        const current = await apiGetTask(task.taskId);
        const finalTask = isStoryboardTaskInProgress(current)
          ? await pollTask(task.taskId)
          : current;
        const status = String(getStoryboardTaskStatus(finalTask) || '').toLowerCase();
        if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) {
          throw new Error(getStoryboardTaskError(finalTask, '分镜生成失败'));
        }

        invalidate(K.storyboards(projectId, epId));
        invalidate(K.storyboards(projectId));
        const latest = await apiGetStoryboards(projectId, {
          episode_id: epId,
          limit: STORYBOARD_PAGE_SIZE,
          offset: 0,
          include_gen_params: true,
        });
        const normalizedLatest = normalizeStoryboardList(latest, storyboardSubjects).slice(0, STORYBOARD_PAGE_SIZE);
        setHasMoreShots(Array.isArray(latest) && latest.length >= STORYBOARD_PAGE_SIZE);
        setShots(normalizedLatest);
        loadShotCandidates(normalizedLatest);
        generatedEpisodeIdsRef.current.add(epId);
      } catch (error) {
        console.error('[StoryboardPage] 恢复重新分镜任务失败:', task.taskId, error);
        setEpisodeGenerationError(true);
        showToast(getStoryboardTaskError(error, '分镜生成失败，请稍后重试'), 'error');
      } finally {
        removePendingTask(projectId, task.taskId);
        setIsGenerating(false);
      }
    };

    const resumeVideo = async (task) => {
      setGeneratingVideoShotIds(prev => new Set([...prev, task.shotId]));
      setGenVideoHistoryMap(prev => ({
        ...prev,
        [task.shotId]: [{ url: null, settled: false, id: `pending-resume-${task.taskId}` }],
      }));
      try {
        const t = await apiGetTask(task.taskId);
        if (isStoryboardTaskInProgress(t)) {
          const final = await pollTask(task.taskId, hasStoryboardVideoTaskResult);
          const url = extractStoryboardVideoUrl(final);
          if (url) {
            const nu = normalizeImageUrl(url);
            setShots(prev => prev.map(s => s.id === task.shotId && !s.storyboardVideo
              ? { ...s, storyboardVideo: { id: `vid-${task.shotId}`, url: nu, name: 'generated.mp4', type: 'video/mp4' } }
              : s));
            apiUpdateStoryboard(projectId, task.shotId, { video_url: nu }).catch(console.error);
            setGenVideoHistoryMap(prev => {
              const list = prev[task.shotId] ?? [];
              return { ...prev, [task.shotId]: [{ url: nu, settled: false, id: `vid-${task.shotId}-resumed` }, ...list.filter(v => !String(v.id).startsWith('pending-resume-'))] };
            });
          }
        } else if (getStoryboardTaskStatus(t) === 'completed' || hasStoryboardVideoTaskResult(t)) {
          const url = extractStoryboardVideoUrl(t);
          if (url) {
            const nu = normalizeImageUrl(url);
            setShots(prev => prev.map(s => s.id === task.shotId && !s.storyboardVideo
              ? { ...s, storyboardVideo: { id: `vid-${task.shotId}`, url: nu, name: 'generated.mp4', type: 'video/mp4' } }
              : s));
            apiUpdateStoryboard(projectId, task.shotId, { video_url: nu }).catch(console.error);
            setGenVideoHistoryMap(prev => {
              const list = prev[task.shotId] ?? [];
              return { ...prev, [task.shotId]: [{ url: nu, settled: false, id: `vid-${task.shotId}-resumed` }, ...list.filter(v => !String(v.id).startsWith('pending-resume-'))] };
            });
          }
        }
      } catch (err) {
        console.error('[StoryboardPage] 恢复视频任务失败:', task.taskId, err);
      } finally {
        removePendingTask(projectId, task.taskId);
        setGeneratingVideoShotIds(prev => { const n = new Set(prev); n.delete(task.shotId); return n; });
      }
    };

    const resumeImage = async (task) => {
      setGeneratingImageShotIds(prev => new Set([...prev, task.shotId]));
      setGenImageHistoryMap(prev => ({
        ...prev,
        [task.shotId]: [{ url: null, settled: false, id: `pending-resume-${task.taskId}` }],
      }));
      try {
        const t = await apiGetTask(task.taskId);
        if (isStoryboardTaskInProgress(t)) {
          const final = await pollTask(task.taskId, hasStoryboardImageTaskResult);
          if ((getStoryboardTaskStatus(final) === 'completed' || getStoryboardTaskStatus(final) === 'partial') || hasStoryboardImageTaskResult(final)) {
            const url = extractStoryboardImageUrl(final);
            if (url) {
              const nu = normalizeImageUrl(url);
              setShots(prev => prev.map(s => s.id === task.shotId && !s.storyboardImage
                ? { ...s, storyboardImage: { id: nu, url: nu, name: 'generated.jpg', type: 'image/jpeg' } }
                : s));
              setGenImageHistoryMap(prev => {
                const list = prev[task.shotId] ?? [];
                return { ...prev, [task.shotId]: [{ url: nu, settled: false, id: `img-${task.shotId}-resumed` }, ...list.filter(v => !String(v.id).startsWith('pending-resume-'))] };
              });
            }
          }
        } else if ((getStoryboardTaskStatus(t) === 'completed' || getStoryboardTaskStatus(t) === 'partial') || hasStoryboardImageTaskResult(t)) {
          const url = extractStoryboardImageUrl(t);
          if (url) {
            const nu = normalizeImageUrl(url);
            setShots(prev => prev.map(s => s.id === task.shotId && !s.storyboardImage
              ? { ...s, storyboardImage: { id: nu, url: nu, name: 'generated.jpg', type: 'image/jpeg' } }
              : s));
          setGenImageHistoryMap(prev => {
            const list = prev[task.shotId] ?? [];
            return { ...prev, [task.shotId]: [{ url: nu, settled: false, id: `img-${task.shotId}-resumed` }, ...list.filter(v => !String(v.id).startsWith('pending-resume-'))] };
          });
          }
        }
      } catch (err) {
        console.error('[StoryboardPage] 恢复图片任务失败:', task.taskId, err);
      } finally {
        removePendingTask(projectId, task.taskId);
        setGeneratingImageShotIds(prev => { const n = new Set(prev); n.delete(task.shotId); return n; });
      }
    };

    pending.forEach(task => {
      if (task.type === 'storyboard') resumeStoryboard(task);
      else if (task.type === 'video') resumeVideo(task);
      else if (task.type === 'image') resumeImage(task);
    });
  }, [projectId, episode, storyboardSubjects, loadShotCandidates]);


  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  // 轮询任务直到完成或超时
  // isSuccessPayload: 可选谓词，若返回 true 则即使 status 为 running 也停止轮询
  async function pollTask(taskId, isSuccessPayload) {
    const MAX_POLLS = 150;
    const INTERVAL = 3000;
    for (let i = 0; i < MAX_POLLS; i++) {
      // 提交生成任务后立即读取一次，避免任务已经创建但页面在首个 3 秒窗口内
      // 没有任何网络活动；后续请求再按固定间隔进行。
      if (i > 0) await new Promise(r => setTimeout(r, INTERVAL));
      const t = await apiGetTask(taskId);
      // 终态
      if (!isStoryboardTaskInProgress(t)) return t;
      // 后端修复后 running 态也可携带 results：有可播放视频就提前返回
      if (typeof isSuccessPayload === 'function' && isSuccessPayload(t)) return t;
    }
    throw new Error('任务超时，请重试');
  }

  async function startBatchGenImages(params) {
    if (generatingImages) return;
    setGeneratingImages(true);
    const episodeId = getEpisodeId(episode);
    const targetShots = params?.only_undrafted
      ? shots.filter((shot) => !finalizedMediaMap[shot.id] && !shot.storyboardImage && !shot.storyboardVideo)
      : shots;
    let successCount = 0;
    let failCount = 0;

    for (const shot of targetShots) {
      setGeneratingImageShotIds(prev => new Set([...prev, shot.id]));
      let taskId = null;
      try {
        const taskResp = await apiGenerateStoryboardImage(projectId, shot.id, {
          model: params.model,
          resolution: params.resolution,
          prompt: params.prompt,
          aspect_ratio: projectRatio,
          reference_images: toSafeStoryboardReferenceUrls(params.refImages),
        });
        taskId = getStoryboardTaskId(taskResp);
        if (!taskId) throw new Error('分镜图生成接口未返回任务 ID');
        addPendingTask(projectId, { taskId, shotId: shot.id, episodeId, type: 'image' });
        const task = await pollTask(taskId, hasStoryboardImageTaskResult);
        if ((getStoryboardTaskStatus(task) === 'completed' || getStoryboardTaskStatus(task) === 'partial') || hasStoryboardImageTaskResult(task)) {
          const imageUrl = extractStoryboardImageUrl(task);
          if (imageUrl) {
            const normalizedUrl = normalizeImageUrl(imageUrl);
            setShots((prev) => prev.map((s) => s.id === shot.id
              ? { ...s, storyboardImage: { id: normalizedUrl, url: normalizedUrl, name: 'generated.jpg', type: 'image/jpeg' } }
              : s
            ));
            await saveCandidateMedia(shot.id, {
              id: normalizedUrl,
              url: normalizedUrl,
              name: 'generated.jpg',
              type: 'image/jpeg',
              media_type: 'image',
              source: 'ai-generated',
              prompt: params.prompt,
              model: params.model,
              resolution: params.resolution,
              ratio: projectRatio,
              referenceImages: toSafeStoryboardReferenceUrls(params.refImages),
              genParams: {
                model: params.model,
                resolution: params.resolution,
                ratio: projectRatio,
                reference_images: toSafeStoryboardReferenceUrls(params.refImages),
              },
            });
            successCount++;
          } else {
            failCount++;
          }
        } else {
          failCount++;
        }
      } catch (err) {
        console.error('[StoryboardPage] 生成分镜图失败:', err);
        failCount++;
      } finally {
        if (taskId) removePendingTask(projectId, taskId);
        setGeneratingImageShotIds(prev => {
          const next = new Set(prev);
          next.delete(shot.id);
          return next;
        });
      }
    }
    setGeneratingImages(false);
    if (failCount > 0) {
      showToast(`分镜图生成完成，成功 ${successCount} 个，失败 ${failCount} 个`, 'warning');
    } else {
      showToast('分镜图生成完成');
    }
  }

  async function startBatchGenVideos(params) {
    if (generatingVideos) return;
    setGeneratingVideos(true);
    const episodeId = getEpisodeId(episode);
    const targetShots = params?.only_undrafted
      ? shots.filter((shot) => !finalizedMediaMap[shot.id] && !shot.storyboardImage && !shot.storyboardVideo)
      : shots;
    let successCount = 0;
    let failCount = 0;

    for (const shot of targetShots) {
      setGeneratingVideoShotIds(prev => new Set([...prev, shot.id]));
      let taskId = null;
      try {
        const durationValue = (() => {
          if (!params.duration) return undefined;
          const parsed = parseFloat(params.duration);
          return isNaN(parsed) ? undefined : parsed;
        })();
        const taskResp = await apiGenerateStoryboardVideo(projectId, shot.id, {
          model: params.model,
          resolution: params.resolution,
          duration: durationValue,
          sound_effect: params.sound,
          prompt: params.prompt,
          ratio: projectRatio,
          reference_images: toSafeStoryboardReferenceUrls(params.refImages),
        });
        taskId = getStoryboardTaskId(taskResp);
        if (!taskId) throw new Error('分镜视频生成接口未返回任务 ID');
        addPendingTask(projectId, { taskId, shotId: shot.id, episodeId, type: 'video' });
        const task = await pollTask(taskId, hasStoryboardVideoTaskResult);
        const videoUrl = extractStoryboardVideoUrl(task);
        if (videoUrl) {
          if (videoUrl) {
            const normalizedUrl = normalizeImageUrl(videoUrl);
            const updatedVideo = { id: `vid-${shot.id}`, url: normalizedUrl, name: 'generated.mp4', type: 'video/mp4' };
            setShots((prev) => prev.map((s) => s.id === shot.id
              ? { ...s, storyboardVideo: updatedVideo }
              : s
            ));
            // 持久化到后端，避免刷新后视频列消失
            apiUpdateStoryboard(projectId, shot.id, { video_url: normalizedUrl }).catch(console.error);
            await saveCandidateMedia(shot.id, {
              id: `vid-${shot.id}`,
              url: normalizedUrl,
              name: 'generated.mp4',
              type: 'video/mp4',
              media_type: 'video',
              source: 'ai-generated',
              prompt: params.prompt,
              model: params.model,
              resolution: params.resolution,
              duration: durationValue,
              ratio: projectRatio,
              referenceImages: toSafeStoryboardReferenceUrls(params.refImages),
              genParams: {
                model: params.model,
                resolution: params.resolution,
                duration: durationValue,
                sound_effect: params.sound,
                ratio: projectRatio,
                reference_images: toSafeStoryboardReferenceUrls(params.refImages),
              },
            });
            successCount++;
          } else {
            failCount++;
          }
        } else {
          failCount++;
        }
      } catch (err) {
        console.error('[StoryboardPage] 生成分镜视频失败:', err);
        failCount++;
      } finally {
        if (taskId) removePendingTask(projectId, taskId);
        setGeneratingVideoShotIds(prev => {
          const next = new Set(prev);
          next.delete(shot.id);
          return next;
        });
      }
    }
    setGeneratingVideos(false);
    if (failCount > 0) {
      showToast(`分镜视频生成完成，成功 ${successCount} 个，失败 ${failCount} 个`, 'warning');
    } else {
      showToast('分镜视频生成完成');
    }
  }

  /* ── 批量下载模式 ── */
  function enterDownloadMode() {
    setDownloadMode(true);
    setSelectedShotIds(new Set());
  }

  function exitDownloadMode() {
    setDownloadMode(false);
    setSelectedShotIds(new Set());
  }

  function toggleSelectAll() {
    setSelectedShotIds(prev => {
      if (prev.size === shots.length) return new Set();
      return new Set(shots.map(s => s.id));
    });
  }

  function toggleShotSelection(id) {
    setSelectedShotIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleDownload() {
    const ids = [...selectedShotIds];
    if (ids.length === 0) {
      showToast('暂无可下载的分镜素材', 'warning');
      return;
    }

    const selectedShots = shots.filter((shot) => selectedShotIds.has(shot.id));
    const hasImages = selectedShots.some((shot) => (
      Boolean(shot.storyboardImage)
      || candidateMediaMap[shot.id]?.some((media) => media.media_type === 'image')
      || finalizedMediaMap[shot.id]?.media_type === 'image'
    ));
    const hasVideos = selectedShots.some((shot) => (
      Boolean(shot.storyboardVideo)
      || candidateMediaMap[shot.id]?.some((media) => media.media_type === 'video')
      || finalizedMediaMap[shot.id]?.media_type === 'video'
    ));

    if (!hasImages && !hasVideos) {
      showToast('暂无可下载的分镜素材', 'warning');
      return;
    }

    const downloads = [];
    if (hasImages) {
      downloads.push({
        filename: 'storyboard-images.zip',
        promise: apiBatchDownloadStoryboardImages(projectId, ids),
        label: '图片',
      });
    }
    if (hasVideos) {
      downloads.push({
        filename: 'storyboard-videos.zip',
        promise: apiBatchDownloadStoryboardVideos(projectId, ids),
        label: '视频',
      });
    }

    const results = await Promise.allSettled(downloads.map((item) => item.promise));
    let successCount = 0;
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        downloadBlob(result.value, downloads[index].filename);
        successCount += 1;
      } else {
        console.error(`批量下载${downloads[index].label}失败:`, result.reason);
      }
    });

    if (successCount === downloads.length) {
      showToast('分镜素材下载成功', 'success');
    } else if (successCount > 0) {
      showToast('部分分镜素材下载成功', 'warning');
    } else {
      showToast('批量下载分镜素材失败', 'error');
    }
  }

  function handleStartEdit() {
    onUnlockStep?.('edit');
    showToast('已进入剪辑流程', 'success');
  }

  function openRegenerateModal() {
    if (isGenerating || homeIsGenerating) return;
    setRegenerateModalError('');
    setRegenerateModalKey((key) => key + 1);
    setRegenerateModalOpen(true);
  }

  function openTimelinePreview(media, shot) {
    if (!media?.url) return;
    const isVideo = media.media_type === 'video' || media.type?.startsWith('video');
    setTimelinePreviewMedia({
      media,
      shot,
      isVideo,
      finalized: media.is_finalized === true || finalizedMediaMap[shot?.id]?.id === media.id,
      url: normalizeImageUrl(media.url),
      candidates: candidateMediaMap[shot?.id] || [],
    });
  }

  async function handleTimelineFinalizeChange(media, nextValue) {
    if (!timelinePreviewMedia?.shot || !media) return;
    await handleFinalizeToggle(timelinePreviewMedia.shot, media, nextValue);
    setTimelinePreviewMedia((prev) => prev ? {
      ...prev,
      finalized: nextValue,
      media: prev.media?.id === media.id ? { ...prev.media, is_finalized: nextValue } : prev.media,
      candidates: (prev.candidates || []).map((item) => ({
        ...item,
        is_finalized: item.id === media.id ? nextValue : false,
      })),
    } : prev);
  }

  async function handleRegenerate({ instruction = '' } = {}) {
    if (isGenerating || homeIsGenerating) return false;
    const episodeId = getEpisodeId(episode);
    if (!episodeId) {
      const message = '当前分集信息不完整，无法重新分镜';
      setRegenerateModalError(message);
      showToast(message, 'error');
      return false;
    }

    // 当前按集生成接口尚未声明 instruction 字段，先保留表单值，避免发送未约定参数。
    void instruction;
    setRegenerateModalError('');

    // 只有重新分镜需要主动清空旧结果；首次进入时由任务状态决定是否展示加载态。
    setShots([]);
    setSelectedShotIds(new Set());
    setDownloadMode(false);
    setIsGenerating(true);

    let pendingTaskId = null;
    const generationPromise = apiGenerateStoryboardsFromEpisode(projectId, {
      episode_id: episodeId,
      model: null,
      overwrite_existing: true,
      confirm_overwrite: true,
    })
      .then((rawResponse) => {
        const taskResponse = unwrapStoryboardTaskResponse(rawResponse);
        if (Array.isArray(taskResponse)) {
          return { status: 'completed', storyboards: taskResponse };
        }

        const taskId = getStoryboardTaskId(taskResponse);
        if (!taskId) {
          const status = String(getStoryboardTaskStatus(taskResponse) || '').toLowerCase();
          if (['completed', 'success', 'succeeded', 'done'].includes(status)) {
            return taskResponse;
          }
          throw new Error('重新分镜接口未返回分镜结果或任务 ID');
        }
        // 重新分镜任务也要写入持久化记录。这样用户刷新页面或离开后返回时，
        // 页面可以识别仍在执行的任务，不会只剩一个已经发出的 POST 请求。
        pendingTaskId = taskId;
        addPendingTask(projectId, {
          taskId,
          shotId: null,
          episodeId,
          type: 'storyboard',
        });
        return pollTask(taskId);
      })
      .then((taskResult) => {
        if (pendingTaskId) removePendingTask(projectId, pendingTaskId);
        const status = String(getStoryboardTaskStatus(taskResult) || '').toLowerCase();
        if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) {
          throw new Error(getStoryboardTaskError(taskResult, '分镜生成失败'));
        }
        if (Array.isArray(taskResult?.storyboards) && hasBackendStoryboardIds(taskResult.storyboards)) return taskResult.storyboards;
        if (Array.isArray(taskResult?.results) && taskResult.results.some((item) => item?.episode_id || item?.shot_number) && hasBackendStoryboardIds(taskResult.results)) {
          return taskResult.results;
        }
        invalidate(K.storyboards(projectId, episodeId));
        invalidate(K.storyboards(projectId));
        return apiGetStoryboards(projectId, { episode_id: episodeId, limit: STORYBOARD_PAGE_SIZE, offset: 0, include_gen_params: true });
      })
      .then((latest) => {
        const normalizedLatest = normalizeStoryboardList(latest, storyboardSubjects).slice(0, STORYBOARD_PAGE_SIZE);
        setHasMoreShots(Array.isArray(latest) && latest.length >= STORYBOARD_PAGE_SIZE);
        setShots(normalizedLatest);
        loadShotCandidates(normalizedLatest);
        generatedEpisodeIdsRef.current.add(episodeId);
      })
      .catch((err) => {
        console.error('[StoryboardPage] 重新分镜失败:', err);
        if (pendingTaskId) removePendingTask(projectId, pendingTaskId);
        const message = err?.message || '重新分镜失败，请稍后重试';
        setRegenerateModalError(message);
        showToast(message, 'error');
        return false;
      })
      .finally(() => setIsGenerating(false));

    const result = await generationPromise;
    return result !== false;
  }

  async function handleStartEpisodeGeneration() {
    if (isGenerating || homeIsGenerating || isLoadingEpisode) return;
    const episodeId = getEpisodeId(episode);
    if (!episodeId) {
      showToast('当前分集信息不完整，无法开始智能分镜', 'error');
      return;
    }

    setEpisodeGenerationError(false);
    setIsGenerating(true);
    generatingEpisodeRef.current = episodeId;

    try {
      const rawTaskResponse = await apiGenerateStoryboardsFromEpisode(projectId, {
        episode_id: episodeId,
        model: null,
      });
      const taskResponse = unwrapStoryboardTaskResponse(rawTaskResponse);
      let taskResult = taskResponse;
      if (!Array.isArray(taskResponse)) {
        const taskId = getStoryboardTaskId(taskResponse);
        if (!taskId) {
          const status = String(getStoryboardTaskStatus(taskResponse) || '').toLowerCase();
          if (!['completed', 'success', 'succeeded', 'done'].includes(status)) {
            throw new Error('按集生成分镜未返回分镜结果或任务 ID');
          }
        } else {
          taskResult = await pollTask(taskId);
        }
      }
      if (['failed', 'error', 'cancelled', 'canceled'].includes(String(getStoryboardTaskStatus(taskResult) || '').toLowerCase())) {
        throw new Error(getStoryboardTaskError(taskResult, '分镜生成失败'));
      }

      const taskItems = Array.isArray(taskResult)
        ? taskResult
        : (Array.isArray(taskResult?.storyboards)
          ? taskResult.storyboards
          : (Array.isArray(taskResult?.results) && taskResult.results.some((item) => item?.episode_id || item?.shot_number)
            ? taskResult.results
            : null));
      const latest = hasBackendStoryboardIds(taskItems)
        ? taskItems
        : await apiGetStoryboards(projectId, { episode_id: episodeId, limit: STORYBOARD_PAGE_SIZE, offset: 0, include_gen_params: true });
      const normalizedLatest = normalizeStoryboardList(latest, storyboardSubjects).slice(0, STORYBOARD_PAGE_SIZE);
      setHasMoreShots(Array.isArray(latest) && latest.length >= STORYBOARD_PAGE_SIZE);
      setShots(normalizedLatest);
      loadShotCandidates(normalizedLatest);
      generatedEpisodeIdsRef.current.add(episodeId);
    } catch (error) {
      console.error('[StoryboardPage] 按集生成分镜失败:', error);
      setEpisodeGenerationError(true);
      showToast(error?.message || '分镜生成失败，请稍后重试', 'error');
    } finally {
      generatingEpisodeRef.current = null;
      setIsGenerating(false);
    }
  }

  useEffect(() => {
    if (shots.length > 0) onUnlockStep?.('storyboard');
  }, [shots.length, onUnlockStep]);

  function updateShot(id, next) {
    setShots((prev) => prev.map((s) => (s.id === id ? next : s)));
    apiUpdateStoryboard(projectId, id, toBackendStoryboard(next)).catch((err) => {
      console.error('[StoryboardPage] 更新分镜失败:', err);
    });
  }

  async function handleFinalizeToggle(shot, media, requestedFinalized) {
    const current = finalizedMediaMap[shot.id];
    const shouldFinalize = typeof requestedFinalized === 'boolean'
      ? requestedFinalized
      : current?.id !== media.id;
    const nextFinalized = shouldFinalize ? media : null;
    setFinalizedMediaMap((prev) => ({ ...prev, [shot.id]: nextFinalized }));
    setCandidateMediaMap((prev) => ({
      ...prev,
      [shot.id]: (prev[shot.id] || []).map((item) => ({ ...item, is_finalized: nextFinalized?.id === item.id })),
    }));
    try {
      if (media.id && !String(media.id).startsWith('blob:')) {
        await apiUpdateStoryboardMediaCandidate(projectId, shot.id, media.id, { is_finalized: !!nextFinalized });
      }
      if (nextFinalized) {
        const isVideo = nextFinalized.media_type === 'video';
        updateShot(shot.id, {
          ...shot,
          storyboardImage: isVideo ? null : { ...nextFinalized, type: 'image/jpeg' },
          storyboardVideo: isVideo ? { ...nextFinalized, type: 'video/mp4' } : null,
        });
      } else {
        updateShot(shot.id, {
          ...shot,
          storyboardImage: current?.media_type === 'image' ? null : shot.storyboardImage,
          storyboardVideo: current?.media_type === 'video' ? null : shot.storyboardVideo,
        });
      }
      // 以后端返回的状态为准，确保互斥定稿和兼容字段回写完成后页面一致。
      await refreshCandidateForShot(shot);
    } catch (error) {
      showToast(error.message || '保存定稿失败', 'error');
      setFinalizedMediaMap((prev) => ({ ...prev, [shot.id]: current || null }));
    }
  }

  function openCreationPanel(shot) {
    setActiveShotId(shot.id);
    const tab = creationPanel?.tab || 'video';
    setCreationPanel({ shot, tab });
    if (tab === 'image') {
      setVideoPanel(null);
      setImagePanel({ shot });
    } else {
      setImagePanel(null);
      setVideoPanel({ shot, nextShot: shots[shots.findIndex((item) => item.id === shot.id) + 1] ?? null });
    }
  }

  function handleCreationTabChange(tab) {
    if (!creationPanel) return;
    const shot = creationPanel.shot;
    setCreationPanel((prev) => ({ ...prev, tab }));
    if (tab === 'image') {
      setVideoPanel(null);
      setImagePanel({ shot });
    } else {
      setImagePanel(null);
      setVideoPanel({ shot, nextShot: shots[shots.findIndex((item) => item.id === shot.id) + 1] ?? null });
    }
  }

  const handleImageFormStateChange = useCallback((nextState) => {
    const shotId = imagePanel?.shot?.id;
    if (!shotId) return;
    imageFormStateRef.current = { ...imageFormStateRef.current, [shotId]: nextState };
    setImageFormStateMap(imageFormStateRef.current);
    setShots((prev) => prev.map((shot) => shot.id === shotId
      ? { ...shot, creationForm: { ...(shot.creationForm || {}), image: nextState } }
      : shot));
    scheduleCreationFormSave(shotId, nextState, videoFormStateRef.current[shotId]);
  }, [imagePanel?.shot?.id, scheduleCreationFormSave]);

  const handleVideoFormStateChange = useCallback((nextState) => {
    const shotId = videoPanel?.shot?.id;
    if (!shotId) return;
    videoFormStateRef.current = { ...videoFormStateRef.current, [shotId]: nextState };
    setVideoFormStateMap(videoFormStateRef.current);
    setShots((prev) => prev.map((shot) => shot.id === shotId
      ? { ...shot, creationForm: { ...(shot.creationForm || {}), video: nextState } }
      : shot));
    scheduleCreationFormSave(shotId, imageFormStateRef.current[shotId], nextState);
  }, [scheduleCreationFormSave, videoPanel?.shot?.id]);

  function selectActiveShot(shotId) {
    if (shotId === activeShotId) {
      setImagePanel(null);
      setVideoPanel(null);
      setCreationPanel(null);
      setActiveShotId(null);
      return;
    }
    setImagePanel(null);
    setVideoPanel(null);
    setCreationPanel(null);
    setActiveShotId(shotId);
  }

  // 媒体上传属于页面级 API 副作用，显式传给行组件，避免分镜行组件依赖页面闭包。
  function handleShotImageUpload(shot, media) {
    const source = media.file ? 'local-upload' : 'asset-library';
    updateShot(shot.id, { ...shot, storyboardImage: { ...media, source } });
    if (!media.file) return;

    apiUploadStoryboardImage(projectId, shot.id, media.file)
      .then((result) => {
        const url = normalizeImageUrl(result.url || result.image_url || result.imageUrl);
        if (url) {
          const next = { id: url, url, name: media.name, type: media.type, source };
          updateShot(shot.id, { ...shot, storyboardImage: next });
          return saveCandidateMedia(shot.id, { ...next, media_type: 'image', source });
        }
      })
      .catch((err) => console.error('[StoryboardPage] 图片上传失败:', err));
  }

  function handleShotVideoUpload(shot, media) {
    updateShot(shot.id, { ...shot, storyboardVideo: media });
    if (!media.file) return;

    apiUploadStoryboardVideo(projectId, shot.id, media.file)
      .then((result) => {
        const url = normalizeImageUrl(result.video_url || result.videoUrl || result.url);
        if (url) {
          const next = { id: url, url, name: media.name, type: media.type, source: 'local-upload' };
          updateShot(shot.id, { ...shot, storyboardVideo: next });
          return saveCandidateMedia(shot.id, { ...next, media_type: 'video', source: 'local-upload' });
        }
      })
      .catch((err) => console.error('[StoryboardPage] 视频上传失败:', err));
  }

  function addShotAfter(id) {
    const idx = shots.findIndex((s) => s.id === id);
    const newShot = makeStoryboardShot(idx + 2);

    apiCreateStoryboard(projectId, { ...toBackendStoryboard(newShot), episode_id: getEpisodeId(episode) })
      .then((created) => {
        const shotWithRealId = enrichMainRefs(normalizeStoryboard(created), storyboardSubjects);
        setShots((prev) => {
          const next = [...prev.slice(0, idx + 1), shotWithRealId, ...prev.slice(idx + 1)];
          const reordered = next.map((s, i) => ({ ...s, number: i + 1 }));
          const orderedIds = reordered.map(s => s.id);
          apiReorderStoryboards(projectId, orderedIds).catch(console.error);
          return reordered;
        });
      })
      .catch((err) => {
        console.error('[StoryboardPage] 创建分镜失败:', err);
      });
  }

  function copyShot(id) {
    const idx = shots.findIndex((s) => s.id === id);
    const original = shots[idx];
    const copy = { ...original, id: undefined };

    apiCreateStoryboard(projectId, { ...toBackendStoryboard(copy), episode_id: getEpisodeId(episode) })
      .then((created) => {
        // 合并原始富数据 + 后端生成的 ID
        const shotWithRealId = { ...copy, ...enrichMainRefs(normalizeStoryboard(created), storyboardSubjects) };
        setShots((prev) => {
          const next = [...prev.slice(0, idx + 1), shotWithRealId, ...prev.slice(idx + 1)];
          const reordered = next.map((s, i) => ({ ...s, number: i + 1 }));
          const orderedIds = reordered.map(s => s.id);
          apiReorderStoryboards(projectId, orderedIds).catch(console.error);
          return reordered;
        });
      })
      .catch((err) => {
        console.error('[StoryboardPage] 复制分镜失败:', err);
      });
  }

  function deleteShot(id) {
    apiDeleteStoryboard(projectId, id)
      .then(() => {
        setShots((prev) => {
          const next = prev.filter((s) => s.id !== id);
          const reordered = next.map((s, i) => ({ ...s, number: i + 1 }));

          // 使用原子操作更新所有分镜的顺序
          const orderedIds = reordered.map(s => s.id);
          apiReorderStoryboards(projectId, orderedIds).catch(console.error);

          return reordered;
        });
      })
      .catch((err) => {
        console.error('[StoryboardPage] 删除分镜失败:', err);
      });
  }

  function addNewShot() {
    const newNumber = shots.length + 1;
    const newShot = makeStoryboardShot(newNumber);

    apiCreateStoryboard(projectId, { ...toBackendStoryboard(newShot), episode_id: getEpisodeId(episode) })
      .then((created) => {
        const shotWithRealId = enrichMainRefs(normalizeStoryboard(created), storyboardSubjects);
        hasManuallyInteracted.current = true;
        setShots((prev) => [...prev, shotWithRealId].map((shot, index) => ({ ...shot, number: index + 1 })));
      })
      .catch((err) => {
        console.error('[StoryboardPage] 创建分镜失败:', err);
      });
  }

  function handleDrop(targetId) {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return; }
    setShots((prev) => {
      const dragIdx = prev.findIndex((s) => s.id === dragId);
      if (dragIdx === -1) return prev;
      const next = [...prev];
      const [dragged] = next.splice(dragIdx, 1);
      if (targetId === '__before_first') {
        next.unshift(dragged);
      } else if (targetId === '__after_last') {
        next.push(dragged);
      } else {
        const targetIdx = next.findIndex((s) => s.id === targetId);
        if (targetIdx === -1) return prev;
        next.splice(targetIdx, 0, dragged);
      }
      const reordered = next.map((s, i) => ({ ...s, number: i + 1 }));
      apiReorderStoryboards(projectId, reordered.map(s => s.id)).catch(console.error);
      return reordered;
    });
    setDragId(null);
    setOverId(null);
  }

  // 判断是否显示 loading / 错误态
  // homeIsGenerating 期间如果已有分镜数据，直接展示数据，不再显示全屏 loading
  const showGeneratingLoading = (isGenerating || homeIsGenerating) && shots.length === 0;
  const episodeDataReady = hasLoadedEpisodeData && loadedEpisodeDataKey === getEpisodeId(episode);
  const showGeneratingError = episodeDataReady && (!!generateError || episodeGenerationError) && shots.length === 0 && !hasManuallyInteracted.current;
  const showStoryboardLoadError = episodeDataReady && storyboardLoadError && !showGeneratingLoading && shots.length === 0 && !hasManuallyInteracted.current;
  const showEpisodeStart = episodeDataReady && !storyboardLoadError && !isLoadingEpisode && !showGeneratingLoading && shots.length === 0 && !hasManuallyInteracted.current;
  const displayLoadingText = statusMessage || loadingTexts[loadingTextIndex];
  const totalDuration = shots.reduce((sum, shot) => {
    const value = Number.parseFloat(shot.params?.duration ?? shot.duration ?? 0);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
  const isMediaLoading = (shot) => {
    if (!isBackendStoryboardId(shot?.backendId || shot?.id)) return false;
    return mediaLoadingMap[shot.id] === true
      || !Object.prototype.hasOwnProperty.call(candidateMediaMap, shot.id);
  };
  const resolvedMediaLoadingMap = Object.fromEntries(
    shots.map((shot) => [shot.id, isMediaLoading(shot)]),
  );

  const storyboardHeader = (
    <StoryboardHeader
      projectName={projectName}
      activeEpisodes={activeEpisodes}
      episode={episode}
      onEpisodeChange={setEpisode}
      homeIsGenerating={homeIsGenerating && shots.length > 0}
      shotsCount={shots.length}
      totalDuration={totalDuration}
      completedEpisodesCount={completedEpisodesCount}
      downloadMode={downloadMode}
      selectedCount={selectedShotIds.size}
      generationDisabled={generatingImages || generatingVideos}
      onOpenImageModal={() => setShowImageModal(true)}
      onOpenVideoModal={() => setShowVideoModal(true)}
      onEnterDownloadMode={enterDownloadMode}
      onSelectAll={toggleSelectAll}
      onDownload={handleDownload}
      onExitDownloadMode={exitDownloadMode}
      onStartEdit={handleStartEdit}
      onRegenerate={openRegenerateModal}
      showStoryboardSummary={shots.length > 0}
      showBatchToolbar={shots.length > 0}
    />
  );

  const handleEmptyEpisodeStart = showGeneratingError ? () => {
    setEpisodeGenerationError(false);
    setIsGenerating(true);
    const start = onRetryGenerateStoryboards || onGenerateStoryboards;
    Promise.resolve(start?.()).finally(() => setIsGenerating(false));
  } : handleStartEpisodeGeneration;

  if (showGeneratingLoading) {
    return (
      <div style={{
        position: 'absolute', inset: 0, marginBottom: '24px', marginRight: '32px',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '8px',
        backgroundColor: '#161616', borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <LoadingAnimation width={200} />
        <span style={{ fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif", fontSize: '14px', lineHeight: '20px', color: '#FFFFFF99', whiteSpace: 'nowrap' }}>
          {displayLoadingText}
        </span>
      </div>
    );
  }

  if (showStoryboardLoadError || showGeneratingError || showEpisodeStart) {
    return (
      <div style={{
        position: 'absolute', inset: 0, marginBottom: '24px', marginRight: '32px',
        display: 'flex', flexDirection: 'column',
        backgroundColor: 'var(--color-dark-bg)',
        overflow: 'hidden', boxSizing: 'border-box',
      }} ref={storyboardPageRef} onClick={(event) => {
        if (event.target.closest('[data-storyboard-shot-row="true"], [data-storyboard-finalized-card="true"], [data-storyboard-header="true"], button, input, textarea, select, [role="button"]')) return;
        setActiveShotId(null);
      }}>
        <StoryboardContentArea
          header={storyboardHeader}
          onContentBlankClick={() => setActiveShotId(null)}
          projectRatio={projectRatio}
          timeline={<StoryboardFinalizedTimeline projectRatio={projectRatio} shots={[]} finalizedMap={{}} />}
        >
          {showStoryboardLoadError ? (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }}>
              <div style={{ fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif", fontSize: '14px', lineHeight: '20px', color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap' }}>
                <span>抱歉，加载数据失败，请</span>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  style={{ margin: 0, padding: 0, border: 0, background: 'transparent', color: '#2DC3E1', font: 'inherit', cursor: 'pointer' }}
                >
                  刷新
                </button>
                <span>重试</span>
              </div>
            </div>
          ) : (
          <div style={{
            flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'transparent',
            backgroundImage: 'linear-gradient(rgb(6, 6, 6), rgb(6, 6, 6))',
          }}>
            <Button
              type="button"
              variant="accent"
              size="large"
              icon={<StartStoryboardIcon />}
              onClick={handleEmptyEpisodeStart}
            >
              开始智能分镜
            </Button>
          </div>
          )}
        </StoryboardContentArea>
      </div>
    );
  }

  return (
    <>
    <div style={{
      position: 'absolute',
      inset: 0,
      marginBottom: '24px',
      marginRight: '32px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      backgroundColor: 'var(--color-dark-bg)',
      backgroundImage: 'none',
      borderRadius: 0,
      border: 0,
      padding: 0,
      overflow: 'hidden',
      boxSizing: 'border-box',
    }} ref={storyboardPageRef} onClick={(event) => {
      if (event.target.closest('[data-storyboard-shot-row="true"], [data-storyboard-finalized-card="true"], [data-storyboard-header="true"], button, input, textarea, select, [role="button"]')) return;
      setActiveShotId(null);
    }}>
      <StoryboardContentArea
        header={storyboardHeader}
        onContentBlankClick={() => setActiveShotId(null)}
        projectRatio={projectRatio}
        timeline={<StoryboardFinalizedTimeline
          projectRatio={projectRatio}
          shots={shots}
          finalizedMap={finalizedMediaMap}
          mediaLoadingMap={resolvedMediaLoadingMap}
          selectedShotId={activeShotId}
          onSelectShot={selectActiveShot}
          onCreate={openCreationPanel}
          onPreview={(media, shot) => openTimelinePreview(media, shot)}
          onDownload={async (media, shot) => {
            try {
              if (media?.id && !String(media.id).startsWith('blob:')) {
                const blob = await apiDownloadStoryboardMediaCandidate(projectId, shot.id, media.id);
                downloadBlob(blob, media.name || `storyboard-${media.id}`);
                return;
              }
            } catch (error) {
              console.warn('[StoryboardPage] 候选媒体受控下载失败，回退直链:', error);
            }
            const link = document.createElement('a');
            link.href = normalizeImageUrl(media?.downloadUrl || media?.download_url || media?.url);
            link.download = media?.name || `storyboard-${media?.id || 'media'}`;
            link.click();
          }}
        />}
      >
      {isLoadingEpisode || (!episodeDataReady && shots.length === 0) ? (
        <div
          aria-label="正在加载分镜"
          role="status"
          style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060606' }}
        >
          <DotsLoading size={6} color="#2DC3E1" gap={4} />
        </div>
      ) : (
        <div
          ref={shotListRef}
          style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}
          onScroll={(event) => {
            const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
            if (scrollHeight - scrollTop - clientHeight <= 120) loadMoreShots();
          }}
          onDragEnd={() => { setDragId(null); setOverId(null); }}
        >
        {/* top sentinel — drop zone for placing before the first card */}
        {dragId && (
          <div
            style={{ height: '8px', flexShrink: 0, marginBottom: '-8px' }}
            onDragOver={(e) => { e.preventDefault(); setOverId('__before_first'); }}
            onDrop={(e) => { e.preventDefault(); handleDrop('__before_first'); }}
          />
        )}
        {shots.map((shot, idx) => (
          <ShotRow
            key={shot.id || `shot-${shot.number || idx + 1}-${idx}`}
            shot={shot}
            projectId={projectId}
            onChange={(next) => updateShot(shot.id, next)}
            onAdd={() => addShotAfter(shot.id)}
            onCopy={() => copyShot(shot.id)}
            onDelete={() => deleteShot(shot.id)}
            chars={chars}
            isDragging={dragId === shot.id}
            insertBefore={(overId === shot.id || (overId === '__before_first' && idx === 0)) && dragId !== shot.id}
            insertAfter={overId === '__after_last' && idx === shots.length - 1 && dragId !== shot.id}
            onDragStart={() => setDragId(shot.id)}
            onDragOver={() => { if (dragId && dragId !== shot.id) setOverId(shot.id); }}
            onDrop={() => handleDrop(shot.id)}
            onGenerateImage={() => {
              // 打开面板前，检查历史列表是否已初始化，若为空则用定稿结果初始化
              setGenImageHistoryMap((prev) => {
                const shotId = shot.id;
                if (!prev[shotId] || prev[shotId].length === 0) {
                  const initialized = { ...prev };
                  if (shot.storyboardImage?.url) {
                    initialized[shotId] = [{ url: shot.storyboardImage.url, settled: true, id: shot.storyboardImage.id }];
                  } else if (generatingImageShotIds.has(shotId)) {
                    initialized[shotId] = [{ url: null, settled: false, id: `pending-resume-${shotId}` }];
                  } else {
                    initialized[shotId] = [];
                  }
                  return initialized;
                }
                return prev;
              });
              setImagePanel({ shot });
            }}
            onGenerateVideo={() => {
              // 打开面板前，检查历史列表是否已初始化，若为空则用定稿结果初始化
              setGenVideoHistoryMap((prev) => {
                const shotId = shot.id;
                if (!prev[shotId] || prev[shotId].length === 0) {
                  const initialized = { ...prev };
                  if (shot.storyboardVideo?.url) {
                    initialized[shotId] = [{ url: shot.storyboardVideo.url, settled: true, id: shot.storyboardVideo.id }];
                  } else if (generatingVideoShotIds.has(shotId)) {
                    initialized[shotId] = [{ url: null, settled: false, id: `pending-resume-${shotId}` }];
                  } else {
                    initialized[shotId] = [];
                  }
                  return initialized;
                }
                return prev;
              });
              setVideoPanel({ shot, nextShot: shots[idx + 1] ?? null });
            }}
            onUploadImage={handleShotImageUpload}
            onUploadVideo={handleShotVideoUpload}
            globalVoiceParams={globalVoiceParams}
            onSaveGlobalVoice={(role, params) => setGlobalVoiceParams((prev) => ({ ...prev, [role]: params }))}
            generatingImage={generatingImageShotIds.has(shot.id)}
            generatingVideo={generatingVideoShotIds.has(shot.id)}
            genImageHistoryMap={genImageHistoryMap}
            genVideoHistoryMap={genVideoHistoryMap}
            candidates={candidateMediaMap[shot.id] || []}
            mediaLoading={isMediaLoading(shot)}
            onOpenCreation={() => openCreationPanel(shot)}
            onFinalizeToggle={(media) => handleFinalizeToggle(shot, media)}
            onSelectShot={() => selectActiveShot(shot.id)}
            isSelectMode={downloadMode}
            isSelected={selectedShotIds.has(shot.id)}
            isActive={activeShotId === shot.id}
            onSelect={() => selectActiveShot(shot.id)}
            onToggleSelect={() => toggleShotSelection(shot.id)}
          />
        ))}
        {isLoadingMoreShots && (
          <div style={{ flexShrink: 0, height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF99', fontSize: '12px' }}>
            正在加载更多分镜
          </div>
        )}
        {/* bottom sentinel — drop zone for placing after the last card */}
        {dragId && (
          <div
            style={{ height: '40px', flexShrink: 0 }}
            onDragOver={(e) => { e.preventDefault(); setOverId('__after_last'); }}
            onDrop={(e) => { e.preventDefault(); handleDrop('__after_last'); }}
          />
        )}

        {/* 新增行按钮 */}
        <div
          onClick={addNewShot}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '40px',
            minWidth: '1160px',
            marginBottom: '80px',
            borderRadius: '12px',
            border: '1px dashed rgba(255,255,255,0.12)',
            cursor: 'pointer',
            flexShrink: 0,
            gap: '6px',
            color: 'rgba(255,255,255,0.40)',
            fontSize: '14px',
            fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
            transition: 'border-color 150ms, color 150ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.70)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.40)';
          }}
        >
          <StoryboardIconPlus color="currentColor" />
          添加空白分镜
        </div>
        </div>
      )}
      </StoryboardContentArea>
    </div>
    {showImageModal && (
      <BatchImageModal
        shots={shots}
        shotCount={shots.length}
        finalizedMediaMap={finalizedMediaMap}
        onClose={() => setShowImageModal(false)}
        onConfirm={(params) => startBatchGenImages(params)}
        projectRatio={projectRatio}
      />
    )}
    {showVideoModal && (
      <BatchVideoModal
        shots={shots}
        finalizedMediaMap={finalizedMediaMap}
        onClose={() => setShowVideoModal(false)}
        onConfirm={(params) => startBatchGenVideos(params)}
        projectRatio={projectRatio}
      />
    )}
    <AIRegenerateStoryboardModal
      key={regenerateModalKey}
      open={regenerateModalOpen}
      error={regenerateModalError}
      onSubmit={handleRegenerate}
      onClose={() => {
        setRegenerateModalOpen(false);
        setRegenerateModalError('');
      }}
    />
    {timelinePreviewMedia ? (
      <StoryboardMediaDetailModal
        key={`${timelinePreviewMedia.shot?.id || 'shot'}-${timelinePreviewMedia.media?.id || timelinePreviewMedia.media?.url || 'media'}`}
        shot={timelinePreviewMedia.shot}
        media={timelinePreviewMedia.media}
        candidates={timelinePreviewMedia.candidates}
        onClose={() => setTimelinePreviewMedia(null)}
        onFinalizeChange={handleTimelineFinalizeChange}
        onDownload={async (media) => {
          try {
            if (media?.id && !String(media.id).startsWith('blob:')) {
              const blob = await apiDownloadStoryboardMediaCandidate(projectId, timelinePreviewMedia.shot.id, media.id);
              downloadBlob(blob, media.name || `storyboard-${media.id}`);
              return;
            }
          } catch (error) {
            console.warn('[StoryboardPage] 详情媒体受控下载失败，回退直链:', error);
          }
          const link = document.createElement('a');
          link.href = normalizeImageUrl(media?.downloadUrl || media?.download_url || media?.url);
          link.download = media?.name || `storyboard-${media?.id || 'media'}`;
          link.click();
        }}
      />
    ) : null}
    {creationPanel && (
      <StoryboardCreationPanel
        projectId={projectId}
        storyboardId={creationPanel.shot?.id}
        initialTab={creationPanel.tab}
        onTabChange={handleCreationTabChange}
        candidates={candidateMediaMap[creationPanel.shot?.id] || []}
        onCandidateMedia={(media) => saveCandidateMedia(creationPanel.shot?.id, media)}
        onFinalizeToggle={(media) => handleFinalizeToggle(creationPanel.shot, media)}
        onPreview={(media) => openTimelinePreview(media, creationPanel.shot)}
        onDownload={async (media) => {
          try {
            if (media?.id && !String(media.id).startsWith('blob:')) {
              const blob = await apiDownloadStoryboardMediaCandidate(projectId, creationPanel.shot.id, media.id);
              downloadBlob(blob, media.name || `storyboard-${media.id}`);
              return;
            }
          } catch (error) {
            console.warn('[StoryboardPage] 候选媒体受控下载失败，回退直链:', error);
          }
          const link = document.createElement('a');
          link.href = normalizeImageUrl(media?.downloadUrl || media?.download_url || media?.url);
          link.download = media?.name || `storyboard-${media?.id || 'media'}`;
          link.click();
        }}
        onClose={() => { setImagePanel(null); setVideoPanel(null); setCreationPanel(null); }}
      >
    {imagePanel && creationPanel.tab === 'image' && (
      <GenerateImagePanel
        shot={imagePanel.shot}
        chars={chars}
        projectId={projectId}
        scenes={scenes}
        props={props}
        projectRatio={projectRatio}
        buildStoryboardPrompt={buildStoryboardPrompt}
        ModalCloseBtn={ModalCloseBtn}
        PanelPromptInput={PanelPromptInput}
        embedded
        formState={imageFormStateMap[imagePanel.shot?.id]}
        onFormStateChange={handleImageFormStateChange}
        onCandidateMedia={(media) => saveCandidateMedia(imagePanel.shot?.id, media)}
        generatedImages={genImageHistoryMap[imagePanel.shot?.id] ?? []}
        onSetGeneratedImages={(updater) => {
          const shotId = imagePanel.shot?.id;
          setGenImageHistoryMap((prev) => ({
            ...prev,
            [shotId]: typeof updater === 'function' ? updater(prev[shotId] ?? []) : updater,
          }));
        }}
        onClose={() => { setImagePanel(null); setCreationPanel(null); }}
        onShowToast={showToast}
       onSettleImage={(imageUrl) => {
         const n = normalizeImageUrl(imageUrl);
         const shotId = imagePanel.shot?.id;
         const target = shots.find((s) => s.id === shotId);
         const form = imageFormStateMap[shotId] || {};
         const referenceImages = toSafeStoryboardReferenceUrls(form.refImages);
         setShots((prev) => prev.map((s) =>
           s.id === shotId
             ? { ...s, storyboardImage: { id: n, url: n, name: '分镜图', type: 'image/jpeg' } }
             : s
         ));
         saveCandidateMedia(shotId, {
           id: n,
           url: n,
           name: '分镜图',
           type: 'image/jpeg',
           media_type: 'image',
           source: 'ai-generated',
           prompt: form.prompt,
           model: form.model,
           resolution: form.resolution,
           ratio: projectRatio,
           referenceImages,
           genParams: {
             model: form.model,
             resolution: form.resolution,
             ratio: projectRatio,
             reference_images: referenceImages,
           },
         });
         if (target) {
           apiUpdateStoryboard(
             projectId,
             shotId,
             toBackendStoryboard({
               ...target,
               storyboardImage: { id: n, url: n, name: '分镜图', type: 'image/jpeg' },
             }),
           ).catch(console.error);
         }
       }}
      onGenerate={async (params) => {
        const shot = imagePanel.shot;
        let taskId = null;
        try {
          setGeneratingImageShotIds(prev => new Set([...prev, shot.id]));
          const taskResp = await apiGenerateStoryboardImage(projectId, shot.id, { model: params.model, resolution: params.resolution, prompt: params.prompt, aspect_ratio: projectRatio, reference_images: toSafeStoryboardReferenceUrls(params.refImages) });
          taskId = getStoryboardTaskId(taskResp);
          if (!taskId) throw new Error('分镜图生成接口未返回任务 ID');
          addPendingTask(projectId, { taskId, shotId: shot.id, episodeId: getEpisodeId(episode), type: 'image' });
          const task = await pollTask(taskId, hasStoryboardImageTaskResult);
          if ((getStoryboardTaskStatus(task) === 'completed' || getStoryboardTaskStatus(task) === 'partial') || hasStoryboardImageTaskResult(task)) {
             const imageUrl = extractStoryboardImageUrl(task);
             if (imageUrl) {
               const normalizedUrl = normalizeImageUrl(imageUrl);
               setShots((prev) => prev.map((s) => s.id === shot.id && !s.storyboardImage
                 ? { ...s, storyboardImage: { id: normalizedUrl, url: normalizedUrl, name: 'generated.jpg', type: 'image/jpeg' } }
                 : s
               ));
               await saveCandidateMedia(shot.id, { id: normalizedUrl, url: normalizedUrl, name: 'generated.jpg', type: 'image/jpeg', media_type: 'image', source: 'ai-generated', prompt: params.prompt, model: params.model, resolution: params.resolution, ratio: projectRatio, referenceImages: toSafeStoryboardReferenceUrls(params.refImages), genParams: { model: params.model, resolution: params.resolution, ratio: projectRatio, reference_images: toSafeStoryboardReferenceUrls(params.refImages) } });
               return { url: normalizedUrl };
             }
           }
           const errMsg = task.error_msg || task.errorMsg || '生成失败，请重试';
           throw new Error(errMsg);
         } catch (err) {
          console.error('[StoryboardPage] 生成分镜图失败:', err);
          throw err;
        } finally {
          if (taskId) removePendingTask(projectId, taskId);
          setGeneratingImageShotIds(prev => {
            const next = new Set(prev); next.delete(shot.id); return next;
          });
        }
      }}
      />
    )}
    {videoPanel && creationPanel.tab === 'video' && (
      <GenerateVideoPanel
        shot={videoPanel.shot}
        projectId={projectId}
        nextShot={videoPanel.nextShot}
        chars={chars}
        scenes={scenes}
        props={props}
        projectRatio={projectRatio}
        buildStoryboardPrompt={buildStoryboardPrompt}
        buildRefFromAsset={buildStoryboardRefFromAsset}
        ModalCloseBtn={ModalCloseBtn}
        PanelPromptInput={PanelPromptInput}
        embedded
        formState={videoFormStateMap[videoPanel.shot?.id]}
        onFormStateChange={handleVideoFormStateChange}
        onCandidateMedia={(media) => saveCandidateMedia(videoPanel.shot?.id, media)}
        generatedVideos={genVideoHistoryMap[videoPanel.shot?.id] ?? []}
        onSetGeneratedVideos={(updater) => {
          const shotId = videoPanel.shot?.id;
          setGenVideoHistoryMap((prev) => ({
            ...prev,
            [shotId]: typeof updater === 'function' ? updater(prev[shotId] ?? []) : updater,
          }));
        }}
        onClose={() => { setVideoPanel(null); setCreationPanel(null); }}
        onShowToast={showToast}
        onSettleVideo={(videoUrl) => {
          const n = normalizeImageUrl(videoUrl);
          const shotId = videoPanel.shot.id;
          const form = videoFormStateMap[shotId] || {};
          const referenceImages = form.refImages?.length
            ? toSafeStoryboardReferenceUrls(form.refImages)
            : undefined;
          const durationValue = form.duration == null || form.duration === ''
            ? undefined
            : Number.parseFloat(form.duration);
          setShots((prev) => {
            const updated = prev.map((s) => s.id === shotId
              ? { ...s, storyboardVideo: { id: n, url: n, name: 'generated.mp4', type: 'video/mp4' } }
              : s
            );
            return updated;
          });
          saveCandidateMedia(shotId, {
            id: n,
            url: n,
            name: 'generated.mp4',
            type: 'video/mp4',
            media_type: 'video',
            source: 'ai-generated',
            prompt: form.prompt,
            model: form.model,
            resolution: form.resolution,
            duration: Number.isNaN(durationValue) ? undefined : durationValue,
            ratio: projectRatio,
            referenceImages,
            genParams: {
              model: form.model,
              resolution: form.resolution,
              duration: Number.isNaN(durationValue) ? undefined : durationValue,
              sound_effect: form.sound,
              ratio: projectRatio,
              reference_images: referenceImages,
              first_frame_url: form.refFirstFrame?.url,
              last_frame_url: form.refLastFrame?.url,
              reference_video_url: form.refVideos?.[0]?.url,
              reference_audio_url: form.refAudios?.[0]?.url,
            },
          });
          // API 调用放在 setShots 外面，避免在 state updater 内产生副作用
          apiUpdateStoryboard(projectId, shotId, { video_url: n })
            .then((res) => console.log('[onSettleVideo] video_url 保存成功，后端返回:', JSON.stringify(res)))
            .catch((err) => console.error('[onSettleVideo] video_url 保存失败', err));
        }}
       onGenerate={async (params) => {
         const shot = videoPanel.shot;
         let taskId = null;
         try {
           setGeneratingVideoShotIds(prev => new Set([...prev, shot.id]));
           // 解析时长：将"Ns"格式转为数字
           const durationValue = (() => {
              if (!params.duration) return undefined;
              const parsed = parseFloat(params.duration);
              return isNaN(parsed) ? undefined : parsed;
            })();
            const taskResp = await apiGenerateStoryboardVideo(projectId, shot.id, {
                model: params.model,
                resolution: params.resolution,
                duration: durationValue,
                sound_effect: params.sound,
                prompt: params.prompt,
                ratio: projectRatio,
                reference_images: (params.reference_images || toSafeStoryboardReferenceUrls(params.refImages)),
                first_frame_url: toAbsoluteUrl(params.first_frame_url),
                last_frame_url: toAbsoluteUrl(params.last_frame_url),
                reference_video_url: toAbsoluteUrl(params.reference_video_url),
                reference_audio_url: toAbsoluteUrl(params.reference_audio_url),
              });
            taskId = getStoryboardTaskId(taskResp);
            if (!taskId) throw new Error('分镜视频生成接口未返回任务 ID');
            addPendingTask(projectId, { taskId, shotId: shot.id, episodeId: getEpisodeId(episode), type: 'video' });
            const task = await pollTask(taskId, hasStoryboardVideoTaskResult);
            const videoUrl = extractStoryboardVideoUrl(task);
            if (videoUrl) {
              const normalizedUrl = normalizeImageUrl(videoUrl);
              // 将参考素材信息一并存入 shot，供查看弹窗展示
              const refInfo = {
                referenceImages: params.reference_images?.length > 0 ? params.reference_images : undefined,
                firstFrameUrl: params.first_frame_url || undefined,
                lastFrameUrl: params.last_frame_url || undefined,
                referenceVideoUrl: params.reference_video_url || undefined,
                referenceAudioUrl: params.reference_audio_url || undefined,
              };
              setShots((prev) => {
                const updated = prev.map((s) => s.id === shot.id && !s.storyboardVideo
                  ? { ...s, storyboardVideo: { id: `vid-${shot.id}`, url: normalizedUrl, name: 'generated.mp4', type: 'video/mp4' }, ...refInfo }
                  : s
                );
                // 若该分镜尚无视频（首次生成），自动持久化到后端
                const wasEmpty = !prev.find(s => s.id === shot.id)?.storyboardVideo;
                if (wasEmpty) {
                  apiUpdateStoryboard(projectId, shot.id, { video_url: normalizedUrl }).catch(console.error);
                }
                return updated;
              });
              await saveCandidateMedia(shot.id, { id: `vid-${shot.id}`, url: normalizedUrl, name: 'generated.mp4', type: 'video/mp4', media_type: 'video', source: 'ai-generated', prompt: params.prompt, model: params.model, resolution: params.resolution, duration: durationValue, ratio: projectRatio, referenceImages: params.reference_images || toSafeStoryboardReferenceUrls(params.refImages), genParams: { model: params.model, resolution: params.resolution, duration: durationValue, sound_effect: params.sound, ratio: projectRatio, reference_images: params.reference_images || toSafeStoryboardReferenceUrls(params.refImages), first_frame_url: params.first_frame_url, last_frame_url: params.last_frame_url, reference_video_url: params.reference_video_url, reference_audio_url: params.reference_audio_url } });
              return { url: normalizedUrl };
            }
            // 终态但没有视频 — 发送 toast 提示失败
            const failStatuses = ['failed', 'cancelled', 'canceled', 'expired', 'error'];
            if (failStatuses.includes(getStoryboardTaskStatus(task)) || (!task.result && !task.results?.length)) {
              const errMsg = task.error_msg || task.errorMsg
              || (Array.isArray(task.results) && task.results[0]?.error)
              || (getStoryboardTaskStatus(task) ? `任务状态: ${getStoryboardTaskStatus(task)}` : '');
              throw Object.assign(new Error(errMsg || '视频生成失败'), { status: getStoryboardTaskStatus(task) });
            }
            const errMsg = task.error_msg || task.errorMsg || '生成失败，请重试';
           throw new Error(errMsg);
          } catch (err) {
           console.error('[StoryboardPage] 生成分镜视频失败:', err);
           throw err;
         } finally {
           if (taskId) removePendingTask(projectId, taskId);
           setGeneratingVideoShotIds(prev => {
             const next = new Set(prev); next.delete(shot.id); return next;
           });
         }
       }}
      />
    )}
      </StoryboardCreationPanel>
    )}
    <StoryboardToast toast={toast} />
  </>
  );
}
