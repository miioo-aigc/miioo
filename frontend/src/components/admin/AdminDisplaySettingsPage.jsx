import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  apiDeleteAdminApiConfigBannerImage,
  apiGetAdminApiConfigBanner,
  apiGetAdminCardVisibility,
  apiGetAdminCommunityQrConfig,
  apiUpdateAdminApiConfigBanner,
  apiUpdateAdminCardVisibility,
  apiUpdateAdminCommunityQrConfig,
} from '../../api/admin';
import { ActionButton, TextInput, Toggle } from './adminShared';
import { FONT_MEDIUM, FONT_REGULAR, formatTime, getErrorMessage } from './adminSharedUtils';

const CARD_META = {
  onelink: { label: 'OneLinkAI', description: '控制 API 配置弹窗中的 OneLinkAI 卡片显示。' },
  minimax: { label: 'MiniMax', description: '控制 API 配置弹窗中的 MiniMax 卡片显示。' },
  aiping: { label: 'AI Ping', description: '控制 API 配置弹窗中的 AI Ping 卡片显示。' },
  volcengine: { label: '火山引擎', description: '控制 API 配置弹窗中的火山引擎卡片显示。' },
  vidu: { label: 'Vidu', description: '控制 API 配置弹窗中的 Vidu 卡片显示。' },
  fal: { label: 'Fal', description: '控制 API 配置弹窗中的 Fal 卡片显示。' },
};

const CARD_ORDER = ['onelink', 'minimax', 'aiping', 'volcengine', 'vidu', 'fal'];

function sortCardItems(items) {
  return [...items].sort((a, b) => {
    const aIndex = CARD_ORDER.indexOf(a.key);
    const bIndex = CARD_ORDER.indexOf(b.key);
    return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex)
      - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
  });
}

function FieldBlock({
  title,
  description,
  imageUrl,
  enabled,
  onImageUrlChange,
  onToggleChange,
  onSave,
  onReset,
  onDelete,
  saving,
  updatedAt,
}) {
  return (
    <div className="rounded-medium border border-stroke-normal bg-neutral-200 p-[20px]">
      <div className="flex items-start justify-between gap-[16px]">
        <div className="flex-1">
          <div className="text-[16px] leading-[20px] text-text-primary" style={{ fontFamily: FONT_MEDIUM }}>
            {title}
          </div>
          <div className="mt-[8px] text-font-size-14 text-text-secondary" style={{ fontFamily: FONT_REGULAR }}>
            {description}
          </div>
        </div>
        <div className="flex items-center gap-[12px]">
          <span className="text-font-size-14 text-text-secondary" style={{ fontFamily: FONT_REGULAR }}>
            {enabled ? '已启用' : '已关闭'}
          </span>
          <Toggle checked={enabled} onChange={onToggleChange} disabled={saving} />
        </div>
      </div>

      <div className="mt-[16px]">
        <TextInput
          value={imageUrl}
          onChange={onImageUrlChange}
          placeholder="请输入后端可访问的图片 URL"
          disabled={saving}
        />
      </div>

      <div className="mt-[12px] flex flex-wrap items-center gap-[8px] text-font-size-12 text-text-hint" style={{ fontFamily: FONT_REGULAR }}>
        <span>最近更新时间：{formatTime(updatedAt)}</span>
        {imageUrl ? <span className="text-text-success">当前已填写图片地址</span> : <span>当前为空</span>}
      </div>

      <div className="mt-[16px] flex flex-wrap gap-[8px]">
        <ActionButton onClick={onSave} disabled={saving}>
          {saving ? '保存中...' : '保存配置'}
        </ActionButton>
        <ActionButton variant="secondary" onClick={onReset} disabled={saving}>
          撤销修改
        </ActionButton>
        {onDelete ? (
          <ActionButton variant="danger" onClick={onDelete} disabled={saving}>
            清空图片
          </ActionButton>
        ) : null}
      </div>
    </div>
  );
}

function CardVisibilityItem({ item, saving, onToggle }) {
  const meta = CARD_META[item.key] || {
    label: item.key,
    description: '控制该服务商卡片是否对普通用户显示。',
  };

  return (
    <div className="rounded-medium border border-stroke-normal bg-neutral-200 p-[16px]">
      <div className="flex items-start justify-between gap-[12px]">
        <div className="min-w-0 flex-1">
          <div className="text-font-size-14 text-text-primary" style={{ fontFamily: FONT_MEDIUM }}>
            {meta.label}
          </div>
          <div className="mt-[6px] text-font-size-12 text-text-hint" style={{ fontFamily: FONT_REGULAR }}>
            {meta.description}
          </div>
          <div className="mt-[8px] text-font-size-12 text-text-hint" style={{ fontFamily: FONT_REGULAR }}>
            最近更新：{formatTime(item.updatedAt)}
          </div>
        </div>
        <Toggle checked={item.isVisible} disabled={saving} onChange={(nextVisible) => onToggle(item, nextVisible)} />
      </div>
    </div>
  );
}

export default function AdminDisplaySettingsPage({
  currentUser,
  refreshSignal = 0,
  showToast,
}) {
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [bannerDraft, setBannerDraft] = useState({ imageUrl: '', isEnabled: false, updatedAt: null });
  const [bannerSnapshot, setBannerSnapshot] = useState({ imageUrl: '', isEnabled: false, updatedAt: null });
  const [qrDraft, setQrDraft] = useState({ imageUrl: '', isEnabled: false, updatedAt: null });
  const [qrSnapshot, setQrSnapshot] = useState({ imageUrl: '', isEnabled: false, updatedAt: null });
  const [cardItems, setCardItems] = useState([]);
  const [savingKey, setSavingKey] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      setPageError('');
      const [bannerData, qrData, visibilityItems] = await Promise.all([
        apiGetAdminApiConfigBanner({ force: true }),
        apiGetAdminCommunityQrConfig({ force: true }),
        apiGetAdminCardVisibility({ force: true }),
      ]);
      const nextBanner = {
        imageUrl: bannerData.imageUrl || '',
        isEnabled: Boolean(bannerData.isEnabled),
        updatedAt: bannerData.updatedAt || null,
      };
      const nextQr = {
        imageUrl: qrData.imageUrl || '',
        isEnabled: Boolean(qrData.isEnabled),
        updatedAt: qrData.updatedAt || null,
      };
      setBannerDraft(nextBanner);
      setBannerSnapshot(nextBanner);
      setQrDraft(nextQr);
      setQrSnapshot(nextQr);
      setCardItems(sortCardItems(Array.isArray(visibilityItems) ? visibilityItems : []));
    } catch (error) {
      const message = getErrorMessage(error, '展示配置加载失败');
      setPageError(message);
      showToast?.(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    // refreshSignal 表示管理员外部数据刷新；此处必须重新请求配置。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData, refreshSignal]);

  const visibleCardCount = useMemo(
    () => cardItems.filter((item) => item.isVisible).length,
    [cardItems],
  );

  const handleSaveBanner = async () => {
    setSavingKey('banner');
    try {
      const payload = await apiUpdateAdminApiConfigBanner({
        image_url: bannerDraft.imageUrl.trim(),
        is_enabled: bannerDraft.isEnabled,
      });
      const nextState = {
        imageUrl: payload.imageUrl || '',
        isEnabled: Boolean(payload.isEnabled),
        updatedAt: payload.updatedAt || null,
      };
      setBannerDraft(nextState);
      setBannerSnapshot(nextState);
      showToast?.('API 推荐图区已保存', 'success');
    } catch (error) {
      showToast?.(getErrorMessage(error, 'API 推荐图区保存失败'), 'error');
    } finally {
      setSavingKey('');
    }
  };

  const handleDeleteBannerImage = async () => {
    setSavingKey('banner-delete');
    try {
      const payload = await apiDeleteAdminApiConfigBannerImage();
      const nextState = {
        imageUrl: payload.imageUrl || '',
        isEnabled: Boolean(payload.isEnabled),
        updatedAt: payload.updatedAt || null,
      };
      setBannerDraft(nextState);
      setBannerSnapshot(nextState);
      showToast?.('API 推荐图区图片已清空', 'success');
    } catch (error) {
      showToast?.(getErrorMessage(error, 'API 推荐图区清空失败'), 'error');
    } finally {
      setSavingKey('');
    }
  };

  const handleSaveQrConfig = async () => {
    setSavingKey('qr');
    try {
      const payload = await apiUpdateAdminCommunityQrConfig({
        image_url: qrDraft.imageUrl.trim(),
        is_enabled: qrDraft.isEnabled,
      });
      const nextState = {
        imageUrl: payload.imageUrl || '',
        isEnabled: Boolean(payload.isEnabled),
        updatedAt: payload.updatedAt || null,
      };
      setQrDraft(nextState);
      setQrSnapshot(nextState);
      showToast?.('社群二维码配置已保存', 'success');
    } catch (error) {
      showToast?.(getErrorMessage(error, '社群二维码配置保存失败'), 'error');
    } finally {
      setSavingKey('');
    }
  };

  const handleToggleCardVisibility = async (item, nextVisible) => {
    const previousItems = cardItems;
    setCardItems((current) => current.map((entry) => (
      entry.key === item.key ? { ...entry, isVisible: nextVisible } : entry
    )));
    setSavingKey(`card:${item.key}`);
    try {
      const updated = await apiUpdateAdminCardVisibility(item.key, { is_visible: nextVisible });
      setCardItems((current) => sortCardItems(current.map((entry) => (
        entry.key === item.key
          ? {
            ...entry,
            isVisible: updated?.isVisible ?? nextVisible,
            updatedAt: updated?.updatedAt ?? entry.updatedAt,
          }
          : entry
      ))));
      showToast?.(`${CARD_META[item.key]?.label || item.key} 卡片已${nextVisible ? '显示' : '隐藏'}`, 'success');
    } catch (error) {
      setCardItems(previousItems);
      showToast?.(getErrorMessage(error, '卡片显示配置更新失败'), 'error');
    } finally {
      setSavingKey('');
    }
  };

  return (
    <div className="flex flex-col gap-[20px]">
      {pageError ? (
        <div className="rounded-medium border border-red-alpha-40 bg-red-alpha-10 px-[16px] py-[12px] text-font-size-14 text-red-300" style={{ fontFamily: FONT_REGULAR }}>
          {pageError}
        </div>
      ) : null}

      <div className="grid gap-[20px] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <FieldBlock
          title="API 配置推荐图区"
          description="对应 API 配置弹窗顶部推荐主图，管理员可切换启用状态、替换图片地址，或直接清空当前主图。"
          imageUrl={bannerDraft.imageUrl}
          enabled={bannerDraft.isEnabled}
          updatedAt={bannerDraft.updatedAt}
          onImageUrlChange={(value) => setBannerDraft((current) => ({ ...current, imageUrl: value }))}
          onToggleChange={(checked) => setBannerDraft((current) => ({ ...current, isEnabled: checked }))}
          onSave={handleSaveBanner}
          onReset={() => setBannerDraft(bannerSnapshot)}
          onDelete={handleDeleteBannerImage}
          saving={loading || savingKey === 'banner' || savingKey === 'banner-delete'}
        />

        <FieldBlock
          title="首页社群二维码"
          description="对应首页左下角“应用”入口弹出的社群二维码。这里只更新后端配置，不改原有首页结构和交互。"
          imageUrl={qrDraft.imageUrl}
          enabled={qrDraft.isEnabled}
          updatedAt={qrDraft.updatedAt}
          onImageUrlChange={(value) => setQrDraft((current) => ({ ...current, imageUrl: value }))}
          onToggleChange={(checked) => setQrDraft((current) => ({ ...current, isEnabled: checked }))}
          onSave={handleSaveQrConfig}
          onReset={() => setQrDraft(qrSnapshot)}
          saving={loading || savingKey === 'qr'}
        />
      </div>

      <div className="rounded-medium border border-stroke-normal bg-neutral-300 p-[20px]">
        <div className="flex flex-wrap items-end justify-between gap-[12px]">
          <div>
            <div className="text-[18px] leading-[22px] text-text-primary" style={{ fontFamily: FONT_MEDIUM }}>
              API 配置卡片显示控制
            </div>
            <div className="mt-[8px] text-font-size-14 text-text-secondary" style={{ fontFamily: FONT_REGULAR }}>
              这组开关只影响 API 配置弹窗里服务商卡片是否展示，不会改动 provider 本身是否启用。
            </div>
          </div>
          <div className="text-font-size-12 text-text-hint" style={{ fontFamily: FONT_REGULAR }}>
            当前管理员：{currentUser?.nickname || currentUser?.phone || '管理员账号'}，当前显示 {visibleCardCount}/{cardItems.length || 0}
          </div>
        </div>

        <div className="mt-[16px] grid gap-[12px] lg:grid-cols-2">
          {cardItems.map((item) => (
            <CardVisibilityItem
              key={item.key}
              item={item}
              saving={loading || savingKey === `card:${item.key}`}
              onToggle={handleToggleCardVisibility}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
