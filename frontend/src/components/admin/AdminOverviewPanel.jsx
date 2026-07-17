import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  apiGetAdminApiConfigBanner,
  apiGetAdminCardVisibility,
  apiGetAdminCommunityQrConfig,
  apiGetAdminModelVisibility,
  apiGetAdminUserAccounts,
} from '../../api/admin';
import { apiGetVoiceLibrary } from '../../api/voices';
import { ActionButton } from './adminShared';
import { FONT_MEDIUM, FONT_REGULAR, getErrorMessage } from './adminSharedUtils';

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-medium border border-stroke-normal bg-neutral-200 p-[16px]">
      <div className="text-font-size-12 text-text-hint" style={{ fontFamily: FONT_REGULAR }}>
        {label}
      </div>
      <div className="mt-[8px] text-[18px] leading-[22px] text-text-primary" style={{ fontFamily: FONT_MEDIUM }}>
        {value}
      </div>
    </div>
  );
}

export default function AdminOverviewPanel({
  currentUser,
  refreshSignal = 0,
  onNavigate,
  showToast,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({
    accountsTotal: 0,
    visibleCardCount: 0,
    cardTotal: 0,
    visibleModelCount: 0,
    modelTotal: 0,
    voiceTotal: 0,
    enabledVoiceCount: 0,
    bannerEnabled: false,
    qrEnabled: false,
  });

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      setError('');
      const [
        bannerData,
        qrData,
        cardItems,
        modelPayload,
        accountPayload,
        voicePayload,
      ] = await Promise.all([
        apiGetAdminApiConfigBanner({ force: true }),
        apiGetAdminCommunityQrConfig({ force: true }),
        apiGetAdminCardVisibility({ force: true }),
        apiGetAdminModelVisibility({ page: 1, pageSize: 1, force: true }),
        apiGetAdminUserAccounts({ page: 1, pageSize: 1, force: true }),
        apiGetVoiceLibrary({ provider: 'miioo', include_disabled: true, page: 1, pageSize: 1, skipCache: true }),
      ]);

      setSummary({
        accountsTotal: Number(accountPayload?.total || 0),
        visibleCardCount: Array.isArray(cardItems) ? cardItems.filter((item) => item.isVisible).length : 0,
        cardTotal: Array.isArray(cardItems) ? cardItems.length : 0,
        visibleModelCount: Number(modelPayload?.visibleTotal || 0),
        modelTotal: Number(modelPayload?.total || 0),
        voiceTotal: Number(voicePayload?.total || 0),
        enabledVoiceCount: Number(voicePayload?.enabledTotal || 0),
        bannerEnabled: Boolean(bannerData?.isEnabled),
        qrEnabled: Boolean(qrData?.isEnabled),
      });
    } catch (loadError) {
      const message = getErrorMessage(loadError, '管理员总览加载失败');
      setError(message);
      showToast?.(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    // refreshSignal 表示管理员外部数据刷新；此处必须重新请求概览数据。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSummary();
  }, [loadSummary, refreshSignal]);

  const cards = useMemo(() => ([
    { label: '管理员身份', value: currentUser?.is_admin ? '已验证' : '未授权' },
    { label: '账号总数', value: `${summary.accountsTotal}` },
    { label: '显示中的 API 卡片', value: `${summary.visibleCardCount}/${summary.cardTotal || 0}` },
    { label: '开放中的模型', value: `${summary.visibleModelCount}/${summary.modelTotal || 0}` },
    { label: 'miioo 音色总数', value: `${summary.voiceTotal}` },
    { label: '启用中的音色', value: `${summary.enabledVoiceCount}` },
    { label: 'API 推荐图区', value: summary.bannerEnabled ? '启用中' : '关闭中' },
    { label: '社群二维码', value: summary.qrEnabled ? '启用中' : '关闭中' },
  ]), [currentUser?.is_admin, summary]);

  return (
    <div className="flex flex-col gap-[20px]">
      <div className="rounded-medium border border-stroke-normal bg-neutral-300 p-[20px]">
        <div className="flex flex-wrap items-end justify-between gap-[12px]">
          <div>
            <div className="text-[18px] leading-[22px] text-text-primary" style={{ fontFamily: FONT_MEDIUM }}>
              总览
            </div>
            <div className="mt-[8px] text-font-size-14 text-text-secondary" style={{ fontFamily: FONT_REGULAR }}>
              汇总管理员控制台的关键运行状态，便于先判断入口是否正常、再进入对应子页处理细项。
            </div>
          </div>
          <ActionButton variant="secondary" onClick={loadSummary} disabled={loading}>
            {loading ? '刷新中...' : '刷新总览'}
          </ActionButton>
        </div>

        {error ? (
          <div className="mt-[16px] rounded-medium border border-red-alpha-40 bg-red-alpha-10 px-[16px] py-[12px] text-font-size-14 text-red-300" style={{ fontFamily: FONT_REGULAR }}>
            {error}
          </div>
        ) : null}

        <div className="mt-[16px] grid gap-[12px] md:grid-cols-2 xl:grid-cols-4">
          {cards.map((item) => (
            <SummaryCard key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      </div>

      <div className="rounded-medium border border-stroke-normal bg-neutral-300 p-[20px]">
        <div className="text-[18px] leading-[22px] text-text-primary" style={{ fontFamily: FONT_MEDIUM }}>
          快捷入口
        </div>
        <div className="mt-[8px] text-font-size-14 text-text-secondary" style={{ fontFamily: FONT_REGULAR }}>
          按模块独立处理配置，避免再由单个接口失败拖垮整页。
        </div>
        <div className="mt-[16px] grid gap-[12px] md:grid-cols-2">
          {[
            ['display', '展示配置', '维护 API 推荐图区、首页社群二维码和 API 卡片显示控制。'],
            ['models', '模型开放', '分页查看各 provider 模型开放状态，并逐项切换普通用户可见性。'],
            ['voices', '音色库', '分页管理 miioo 系统音色，继续支持搜索、试听和编辑。'],
            ['accounts', '账号管理', '沿用现有表格分页体验，独立处理账号资料和权限。'],
          ].map(([key, label, description]) => (
            <button
              key={key}
              type="button"
              onClick={() => onNavigate?.(key)}
              className="rounded-medium border border-stroke-normal bg-neutral-200 px-[16px] py-[14px] text-left transition-all hover:border-white-20"
            >
              <div className="text-font-size-14 text-text-primary" style={{ fontFamily: FONT_MEDIUM }}>
                {label}
              </div>
              <div className="mt-[6px] text-font-size-12 text-text-hint" style={{ fontFamily: FONT_REGULAR }}>
                {description}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
