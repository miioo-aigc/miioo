import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  apiCreateVoiceLibraryItem,
  apiDeleteVoiceLibraryItem,
  apiGetVoiceLibrary,
  apiUpdateVoiceLibraryItem,
  getVoiceDisplayName,
} from '../../api/voices';
import {
  getActiveVoicePreviewKey,
  stopVoicePreview,
  subscribeVoicePreview,
  toggleVoicePreview,
} from '../../utils/voicePreviewPlayer';
import AdminVoiceLibraryFilters from './AdminVoiceLibraryFilters';
import AdminVoiceLibraryTable from './AdminVoiceLibraryTable';
import {
  ActionButton,
  FieldLabel,
  SelectInput,
  TextArea,
  TextInput,
  Toggle,
} from './adminShared';
import { FONT_MEDIUM, FONT_REGULAR, getErrorMessage } from './adminSharedUtils';

const GENDER_OPTIONS = [
  { value: '', label: '未设置' },
  { value: '男', label: '男' },
  { value: '女', label: '女' },
  { value: 'male', label: 'male' },
  { value: 'female', label: 'female' },
];
const AGE_GROUP_OPTIONS = [
  { value: '', label: '未设置' },
  { value: '幼年', label: '幼年' },
  { value: '青少年', label: '青少年' },
  { value: '青年', label: '青年' },
  { value: '中年', label: '中年' },
  { value: '老年', label: '老年' },
  { value: 'youth', label: 'youth' },
  { value: 'adult', label: 'adult' },
];
const LANGUAGE_OPTIONS = [
  { value: '', label: '未设置' },
  { value: '中文', label: '中文' },
  { value: 'zh', label: 'zh' },
  { value: 'English', label: 'English' },
];

function createEmptyVoiceForm() {
  return {
    id: '',
    name: '',
    gender: '',
    ageGroup: '',
    language: '',
    style: '',
    emotions: '',
    sortOrder: '0',
    isEnabled: true,
    previewFile: null,
    previewFileName: '',
    existingPreviewUrl: '',
  };
}

function buildVoiceFormState(voice) {
  return {
    id: voice?.id || '',
    name: voice?.name || '',
    gender: voice?.gender || '',
    ageGroup: voice?.age_group || '',
    language: voice?.language || '',
    style: voice?.style || '',
    emotions: voice?.emotions || '',
    sortOrder: String(voice?.sort_order ?? 0),
    isEnabled: Boolean(voice?.is_enabled ?? true),
    previewFile: null,
    previewFileName: '',
    existingPreviewUrl: voice?.preview_url || voice?.source_audio_url || '',
  };
}

function getVoicePreviewUrl(voice) {
  return voice?.preview_url || voice?.source_audio_url || '';
}

function getVoicePreviewKey(voice) {
  const previewUrl = getVoicePreviewUrl(voice);
  return previewUrl ? `${voice?.id || 'voice'}:${previewUrl}` : '';
}

function resolveVoiceName(voice) {
  return voice?.display_name || getVoiceDisplayName(voice) || voice?.name || '未命名音色';
}

function VoiceLibraryEditorModal({
  open,
  mode,
  form,
  saving,
  onClose,
  onChange,
  onFileChange,
  onSubmit,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black-60 px-[20px]">
      <div className="w-full max-w-[760px] rounded-medium border border-stroke-normal bg-neutral-300 p-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-[16px]">
          <div>
            <div className="text-[20px] leading-[24px] text-text-primary" style={{ fontFamily: FONT_MEDIUM }}>
              {mode === 'create' ? '新增 miioo 音色' : '编辑 miioo 音色'}
            </div>
            <div className="mt-[8px] text-font-size-14 text-text-secondary" style={{ fontFamily: FONT_REGULAR }}>
              这里只维护 `miioo` 系统音色库。删除仍按后端语义处理为软停用，不会物理删除历史记录。
            </div>
          </div>
          <ActionButton variant="secondary" onClick={onClose} disabled={saving}>
            关闭
          </ActionButton>
        </div>

        <div className="mt-[20px] grid gap-[16px] md:grid-cols-2">
          <div>
            <FieldLabel>音色名称</FieldLabel>
            <TextInput
              value={form.name}
              onChange={(value) => onChange('name', value)}
              placeholder="请输入音色名称"
              disabled={saving}
            />
          </div>
          <div>
            <FieldLabel>排序值</FieldLabel>
            <TextInput
              type="number"
              min="0"
              value={form.sortOrder}
              onChange={(value) => onChange('sortOrder', value)}
              placeholder="默认 0"
              disabled={saving}
            />
          </div>
          <div>
            <FieldLabel>性别</FieldLabel>
            <SelectInput value={form.gender} options={GENDER_OPTIONS} onChange={(value) => onChange('gender', value)} disabled={saving} />
          </div>
          <div>
            <FieldLabel>年龄段</FieldLabel>
            <SelectInput value={form.ageGroup} options={AGE_GROUP_OPTIONS} onChange={(value) => onChange('ageGroup', value)} disabled={saving} />
          </div>
          <div>
            <FieldLabel>语言</FieldLabel>
            <SelectInput value={form.language} options={LANGUAGE_OPTIONS} onChange={(value) => onChange('language', value)} disabled={saving} />
          </div>
          <div className="flex items-center justify-between rounded-medium border border-stroke-normal bg-neutral-200 px-[14px] py-[12px]">
            <div>
              <div className="text-font-size-14 text-text-primary" style={{ fontFamily: FONT_MEDIUM }}>
                启用状态
              </div>
              <div className="mt-[6px] text-font-size-12 text-text-hint" style={{ fontFamily: FONT_REGULAR }}>
                关闭后该音色不会再出现在普通用户默认音色库里。
              </div>
            </div>
            <Toggle checked={form.isEnabled} onChange={(checked) => onChange('isEnabled', checked)} disabled={saving} />
          </div>
          <div className="md:col-span-2">
            <FieldLabel>风格标签</FieldLabel>
            <TextInput
              value={form.style}
              onChange={(value) => onChange('style', value)}
              placeholder="例如：温暖旁白、少女感、稳重男声"
              disabled={saving}
            />
          </div>
          <div className="md:col-span-2">
            <FieldLabel>情绪标签</FieldLabel>
            <TextArea
              value={form.emotions}
              onChange={(value) => onChange('emotions', value)}
              placeholder="可填写逗号分隔的情绪标签，例如：温暖,平静,坚定"
            />
          </div>
          <div className="md:col-span-2">
            <FieldLabel>试听音频</FieldLabel>
            <div className="rounded-medium border border-stroke-normal bg-neutral-200 p-[14px]">
              <input
                type="file"
                accept=".mp3,.wav,.m4a,audio/*"
                onChange={onFileChange}
                disabled={saving}
                className="block w-full text-font-size-13 text-text-secondary file:mr-[12px] file:rounded-medium file:border-0 file:bg-blue-300 file:px-[14px] file:py-[10px] file:text-font-size-14 file:text-neutral-500 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ fontFamily: FONT_REGULAR }}
              />
              <div className="mt-[10px] flex flex-wrap gap-[8px] text-font-size-12 text-text-hint" style={{ fontFamily: FONT_REGULAR }}>
                {form.previewFileName ? <span>待上传：{form.previewFileName}</span> : null}
                {form.existingPreviewUrl ? <span>当前已有试听文件</span> : <span>当前未上传试听文件</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-[24px] flex justify-end gap-[8px]">
          <ActionButton variant="secondary" onClick={onClose} disabled={saving}>
            取消
          </ActionButton>
          <ActionButton onClick={onSubmit} disabled={saving}>
            {saving ? '保存中...' : mode === 'create' ? '创建音色' : '保存修改'}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

export default function AdminVoiceLibraryPage({
  refreshSignal = 0,
  showToast,
}) {
  const [pageData, setPageData] = useState({
    list: [],
    total: 0,
    page: 1,
    pageSize: 12,
    hasMore: false,
    enabledTotal: 0,
  });
  const [query, setQuery] = useState({
    page: 1,
    keyword: '',
    statusFilter: 'all',
  });
  const [draftKeyword, setDraftKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [pageError, setPageError] = useState('');
  const [voiceEditorOpen, setVoiceEditorOpen] = useState(false);
  const [voiceEditorMode, setVoiceEditorMode] = useState('create');
  const [voiceForm, setVoiceForm] = useState(createEmptyVoiceForm());
  const [playingPreviewKey, setPlayingPreviewKey] = useState(() => getActiveVoicePreviewKey());

  useEffect(() => {
    const unsubscribe = subscribeVoicePreview(setPlayingPreviewKey);
    return () => {
      unsubscribe();
      stopVoicePreview();
    };
  }, []);

  const loadPage = useCallback(async ({
    page,
    keyword,
    statusFilter,
    silent = false,
  } = {}) => {
    const nextPage = Number(page || query.page || 1);
    const nextKeyword = typeof keyword === 'string' ? keyword.trim() : query.keyword;
    const nextStatusFilter = typeof statusFilter === 'string' ? statusFilter : query.statusFilter;
    if (!silent) setLoading(true);
    try {
      setPageError('');
      const payload = await apiGetVoiceLibrary({
        provider: 'miioo',
        include_disabled: true,
        keyword: nextKeyword || undefined,
        isEnabled: nextStatusFilter === 'enabled'
          ? true
          : nextStatusFilter === 'disabled'
            ? false
            : undefined,
        page: nextPage,
        pageSize: 12,
      });

      setQuery({
        page: payload.page,
        keyword: nextKeyword,
        statusFilter: nextStatusFilter,
      });
      setDraftKeyword(nextKeyword);
      setPageData(payload);
      return payload;
    } catch (error) {
      const message = getErrorMessage(error, 'miioo 音色库加载失败');
      setPageError(message);
      showToast?.(message, 'error');
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, [query.keyword, query.page, query.statusFilter, showToast]);

  useEffect(() => {
    // 页面首次加载或外部刷新时必须同步音色库数据。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPage({ silent: false });
  }, [loadPage, refreshSignal]);

  const headerSummary = useMemo(
    () => `共 ${pageData.total} 条，启用中 ${pageData.enabledTotal} 条`,
    [pageData.enabledTotal, pageData.total],
  );

  const handleOpenCreateVoice = () => {
    setVoiceEditorMode('create');
    setVoiceForm(createEmptyVoiceForm());
    setVoiceEditorOpen(true);
  };

  const handleOpenEditVoice = (voice) => {
    setVoiceEditorMode('edit');
    setVoiceForm(buildVoiceFormState(voice));
    setVoiceEditorOpen(true);
  };

  const handleToggleVoicePreview = async (voice) => {
    const previewUrl = getVoicePreviewUrl(voice);
    const previewKey = getVoicePreviewKey(voice);
    if (!previewUrl || !previewKey) {
      showToast?.('当前音色还没有可试听的音频文件', 'error');
      return;
    }
    try {
      await toggleVoicePreview({ key: previewKey, url: previewUrl });
    } catch (error) {
      showToast?.(getErrorMessage(error, '试听失败，请稍后重试'), 'error');
    }
  };

  const handleSubmitVoiceForm = async () => {
    const trimmedName = voiceForm.name.trim();
    if (!trimmedName) {
      showToast?.('音色名称不能为空', 'error');
      return;
    }

    const payload = {
      name: trimmedName,
      gender: voiceForm.gender || undefined,
      age_group: voiceForm.ageGroup || undefined,
      language: voiceForm.language || undefined,
      style: voiceForm.style.trim() || undefined,
      emotions: voiceForm.emotions.trim() || undefined,
      sort_order: voiceForm.sortOrder.trim() || '0',
      is_enabled: voiceForm.isEnabled,
      preview_file: voiceForm.previewFile || undefined,
    };
    const currentSaveKey = voiceEditorMode === 'create' ? 'voice-create' : `voice-update:${voiceForm.id}`;
    setSavingKey(currentSaveKey);
    try {
      if (voiceEditorMode === 'create') {
        await apiCreateVoiceLibraryItem(payload);
        showToast?.('miioo 音色已创建', 'success');
      } else {
        await apiUpdateVoiceLibraryItem(voiceForm.id, payload);
        showToast?.('miioo 音色已更新', 'success');
      }
      setVoiceEditorOpen(false);
      setVoiceForm(createEmptyVoiceForm());
      await loadPage({
        page: 1,
        keyword: query.keyword,
        statusFilter: query.statusFilter,
      });
    } catch (error) {
      showToast?.(getErrorMessage(error, voiceEditorMode === 'create' ? '创建音色失败' : '更新音色失败'), 'error');
    } finally {
      setSavingKey('');
    }
  };

  const handleDisableVoice = async (voice) => {
    setSavingKey(`voice-delete:${voice.id}`);
    try {
      await apiDeleteVoiceLibraryItem(voice.id);
      showToast?.(`${resolveVoiceName(voice)} 已停用`, 'success');
      const nextPage = pageData.list.length === 1 && pageData.page > 1 ? pageData.page - 1 : pageData.page;
      await loadPage({
        page: nextPage,
        keyword: query.keyword,
        statusFilter: query.statusFilter,
      });
    } catch (error) {
      showToast?.(getErrorMessage(error, '停用音色失败'), 'error');
    } finally {
      setSavingKey('');
    }
  };

  const voiceSaveKey = voiceEditorMode === 'create' ? 'voice-create' : `voice-update:${voiceForm.id}`;
  const voiceEditorSaving = savingKey === voiceSaveKey;

  return (
    <div className="rounded-medium border border-stroke-normal bg-neutral-300 p-[20px]">
      <div className="flex flex-wrap items-end justify-between gap-[12px]">
        <div>
          <div className="text-[18px] leading-[22px] text-text-primary" style={{ fontFamily: FONT_MEDIUM }}>
            音色库
          </div>
          <div className="mt-[8px] text-font-size-14 text-text-secondary" style={{ fontFamily: FONT_REGULAR }}>
            分页维护前端默认使用的 `miioo` 系统音色库。删除操作继续按后端既有语义处理为软停用，便于保留历史记录并支持后续重新启用。
          </div>
        </div>
        <div className="text-font-size-12 text-text-hint" style={{ fontFamily: FONT_REGULAR }}>
          {headerSummary}
        </div>
      </div>

      <div className="mt-[16px]">
        <AdminVoiceLibraryFilters
          keyword={draftKeyword}
          onKeywordChange={setDraftKeyword}
          statusFilter={query.statusFilter}
          onStatusFilterChange={(value) => setQuery((current) => ({ ...current, statusFilter: value }))}
          onSearch={() => loadPage({ page: 1, keyword: draftKeyword, statusFilter: query.statusFilter })}
          onReset={() => {
            setDraftKeyword('');
            setQuery((current) => ({ ...current, statusFilter: 'all' }));
            loadPage({ page: 1, keyword: '', statusFilter: 'all' });
          }}
          onCreate={handleOpenCreateVoice}
          loading={loading}
          creatingDisabled={Boolean(savingKey)}
        />
      </div>

      {pageError ? (
        <div className="mt-[16px] rounded-medium border border-red-alpha-40 bg-red-alpha-10 px-[16px] py-[12px] text-font-size-14 text-red-300" style={{ fontFamily: FONT_REGULAR }}>
          {pageError}
        </div>
      ) : null}

      <div className="mt-[16px]">
        <AdminVoiceLibraryTable
          items={pageData.list}
          total={pageData.total}
          page={pageData.page}
          pageSize={pageData.pageSize}
          hasMore={pageData.hasMore}
          loading={loading}
          playingKey={playingPreviewKey}
          deletingKey={savingKey.startsWith('voice-delete:') ? savingKey.replace('voice-delete:', '') : ''}
          getItemPlayingKey={getVoicePreviewKey}
          resolveVoiceName={resolveVoiceName}
          getPreviewUrl={getVoicePreviewUrl}
          onTogglePlay={handleToggleVoicePreview}
          onEdit={handleOpenEditVoice}
          onDisable={handleDisableVoice}
          onPrev={() => loadPage({
            page: Math.max(1, pageData.page - 1),
            keyword: query.keyword,
            statusFilter: query.statusFilter,
          })}
          onNext={() => loadPage({
            page: pageData.page + 1,
            keyword: query.keyword,
            statusFilter: query.statusFilter,
          })}
        />
      </div>

      <VoiceLibraryEditorModal
        open={voiceEditorOpen}
        mode={voiceEditorMode}
        form={voiceForm}
        saving={voiceEditorSaving}
        onClose={() => {
          if (voiceEditorSaving) return;
          setVoiceEditorOpen(false);
          setVoiceForm(createEmptyVoiceForm());
        }}
        onChange={(key, value) => setVoiceForm((current) => ({ ...current, [key]: value }))}
        onFileChange={(event) => {
          const file = event.target.files?.[0] || null;
          setVoiceForm((current) => ({
            ...current,
            previewFile: file,
            previewFileName: file?.name || '',
          }));
        }}
        onSubmit={handleSubmitVoiceForm}
      />
    </div>
  );
}
