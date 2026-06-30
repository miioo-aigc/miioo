const BASE = import.meta.env.VITE_API_BASE_URL;

import { cached, invalidate } from '../utils/cache.js';
import { K, TTL, MEDIUM } from '../utils/cacheKeys.js';
import { normalizeImageUrl } from '../utils/imageUrl.js';
import { authFetch, authFetchForm } from './request.js';

const GENDER_ALIAS_MAP = new Map([
  ['male', '男'],
  ['man', '男'],
  ['boy', '男'],
  ['男', '男'],
  ['男声', '男'],
  ['female', '女'],
  ['woman', '女'],
  ['girl', '女'],
  ['女', '女'],
  ['女声', '女'],
]);

const AGE_ALIAS_MAP = new Map([
  ['child', '幼年'],
  ['kid', '幼年'],
  ['children', '幼年'],
  ['teen', '青少年'],
  ['teenager', '青少年'],
  ['adolescent', '青少年'],
  ['young', '青年'],
  ['youth', '青年'],
  ['young adult', '青年'],
  ['adult', '中年'],
  ['middle aged', '中年'],
  ['middle-aged', '中年'],
  ['middleage', '中年'],
  ['midlife', '中年'],
  ['old', '老年'],
  ['elder', '老年'],
  ['elderly', '老年'],
  ['senior', '老年'],
  ['幼年', '幼年'],
  ['青少年', '青少年'],
  ['青年', '青年'],
  ['中年', '中年'],
  ['老年', '老年'],
]);

const VOICE_ID_DISPLAY_ALIAS_MAP = new Map([
  ['zh-cn-xiaoxiaoneural', '晓晓'],
  ['zh-cn-yunxineural', '云希'],
  ['zh-cn-yunjianneural', '云健'],
  ['zh-cn-xiaoyineural', '晓伊'],
  ['zh-cn-yunyangneural', '云扬'],
  ['zh-cn-xiaochenneural', '晓辰'],
  ['zh-cn-xiaohanneural', '晓涵'],
  ['zh-cn-xiaomoneural', '晓墨'],
  ['zh-cn-xiaoshuangneural', '晓双'],
  ['zh-cn-yunfengneural', '云枫'],
  ['male-qn-qingse', '青涩青年音色'],
  ['male-qn-jingying', '精英青年音色'],
  ['male-qn-badao', '霸道青年音色'],
  ['male-qn-daxuesheng', '青年大学生音色'],
  ['female-shaonv', '少女音色'],
  ['female-yujie', '御姐音色'],
  ['female-chengshu', '成熟女性音色'],
  ['female-tianmei', '甜美女性音色'],
  ['male-qn-qingse-jingpin', '青涩青年音色-beta'],
  ['male-qn-jingying-jingpin', '精英青年音色-beta'],
  ['male-qn-badao-jingpin', '霸道青年音色-beta'],
  ['male-qn-daxuesheng-jingpin', '青年大学生音色-beta'],
  ['female-shaonv-jingpin', '少女音色-beta'],
  ['female-yujie-jingpin', '御姐音色-beta'],
  ['female-chengshu-jingpin', '成熟女性音色-beta'],
  ['female-tianmei-jingpin', '甜美女性音色-beta'],
  ['clever_boy', '聪明男童'],
  ['cute_boy', '可爱男童'],
  ['lovely_girl', '萌萌女童'],
  ['cartoon_pig', '卡通猪小琪'],
  ['bingjiao_didi', '病娇弟弟'],
  ['junlang_nanyou', '俊朗男友'],
  ['chunzhen_xuedi', '纯真学弟'],
  ['lengdan_xiongzhang', '冷淡学长'],
  ['badao_shaoye', '霸道少爷'],
  ['tianxin_xiaoling', '甜心小玲'],
  ['qiaopi_mengmei', '俏皮萌妹'],
  ['wumei_yujie', '妩媚御姐'],
  ['diadia_xuemei', '嗲嗲学妹'],
  ['danya_xuejie', '淡雅学姐'],
  ['chinese (mandarin)_reliable_executive', '沉稳高管'],
  ['chinese (mandarin)_news_anchor', '新闻女声'],
  ['chinese (mandarin)_mature_woman', '傲娇御姐'],
  ['chinese (mandarin)_unrestrained_young_man', '不羁青年'],
  ['arrogant_miss', '嚣张小姐'],
  ['robot_armor', '机械战甲'],
  ['chinese (mandarin)_kind-hearted_antie', '热心大婶'],
  ['chinese (mandarin)_hk_flight_attendant', '港普空姐'],
  ['chinese (mandarin)_humorous_elder', '搞笑大爷'],
  ['chinese (mandarin)_gentleman', '温润男声'],
  ['chinese (mandarin)_warm_bestie', '温暖闺蜜'],
  ['chinese (mandarin)_male_announcer', '播报男声'],
  ['chinese (mandarin)_sweet_lady', '甜美女声'],
  ['chinese (mandarin)_southern_young_man', '南方小哥'],
  ['chinese (mandarin)_wise_women', '阅历姐姐'],
  ['chinese (mandarin)_gentle_youth', '温润青年'],
  ['chinese (mandarin)_warm_girl', '温暖少女'],
  ['chinese (mandarin)_kind-hearted_elder', '花甲奶奶'],
  ['chinese (mandarin)_cute_spirit', '憨憨萌兽'],
  ['chinese (mandarin)_radio_host', '电台男主播'],
  ['chinese (mandarin)_lyrical_voice', '抒情男声'],
  ['chinese (mandarin)_straightforward_boy', '率真弟弟'],
  ['chinese (mandarin)_sincere_adult', '真诚青年'],
  ['chinese (mandarin)_gentle_senior', '温柔学姐'],
  ['chinese (mandarin)_stubborn_friend', '嘴硬竹马'],
  ['chinese (mandarin)_crisp_girl', '清脆少女'],
  ['chinese (mandarin)_pure-hearted_boy', '清澈邻家弟弟'],
  ['chinese (mandarin)_soft_girl', '柔和少女'],
  ['cantonese_professionalhost（f)', '专业女主持'],
  ['cantonese_gentlelady', '温柔女声'],
  ['cantonese_professionalhost（m)', '专业男主持'],
  ['cantonese_playfulman', '活泼男声'],
  ['cantonese_cutegirl', '可爱女孩'],
  ['cantonese_kindwoman', '善良女声'],
]);

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasChineseText(value) {
  return /[\u4e00-\u9fff]/.test(normalizeText(value));
}

function buildVoiceInferenceText(voice) {
  const descriptions = Array.isArray(voice?.description)
    ? voice.description
    : [voice?.description];
  return [
    voice?.gender,
    voice?.age_group,
    voice?.language,
    voice?.name,
    voice?.voice_name,
    voice?.original_name,
    voice?.originalName,
    voice?.style,
    voice?.voice_id,
    voice?.voiceId,
    voice?.provider_voice_id,
    voice?.providerVoiceId,
    voice?.source_label,
    voice?.sourceLabel,
    ...descriptions,
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function normalizeVoiceGender(value) {
  const normalized = normalizeText(value).toLowerCase();
  return GENDER_ALIAS_MAP.get(normalized) || normalizeText(value) || null;
}

function normalizeVoiceAge(value) {
  const raw = normalizeText(value);
  const normalized = raw.toLowerCase();
  return AGE_ALIAS_MAP.get(normalized) || raw || null;
}

function inferVoiceGender(voice) {
  const hint = buildVoiceInferenceText(voice);
  if (!hint) return null;
  if (
    hint.includes('female')
    || hint.includes('woman')
    || hint.includes('girl')
    || hint.includes('女声')
    || hint.includes('女生')
    || hint.includes('女士')
    || hint.includes('小姐姐')
    || hint.includes('御姐')
    || hint.includes('女')
    || /^female[-_]/.test(hint)
  ) {
    return '女';
  }
  if (
    hint.includes('male')
    || hint.includes('man')
    || hint.includes('boy')
    || hint.includes('男声')
    || hint.includes('男生')
    || hint.includes('先生')
    || hint.includes('男')
    || /^male[-_]/.test(hint)
  ) {
    return '男';
  }
  return null;
}

function inferVoiceAge(voice) {
  const hint = buildVoiceInferenceText(voice);
  if (!hint) return null;
  if (
    hint.includes('child')
    || hint.includes('kid')
    || hint.includes('children')
    || hint.includes('幼年')
    || hint.includes('儿童')
    || hint.includes('童声')
  ) {
    return '幼年';
  }
  if (
    hint.includes('teen')
    || hint.includes('teenager')
    || hint.includes('adolescent')
    || hint.includes('青少年')
    || hint.includes('少女')
    || hint.includes('少年')
  ) {
    return '青少年';
  }
  if (
    hint.includes('young adult')
    || hint.includes('young')
    || hint.includes('youth')
    || hint.includes('青年')
    || hint.includes('-qn-')
    || hint.endsWith('-qn')
  ) {
    return '青年';
  }
  if (
    hint.includes('middle aged')
    || hint.includes('middle-aged')
    || hint.includes('middleage')
    || hint.includes('midlife')
    || hint.includes('adult')
    || hint.includes('中年')
    || hint.includes('阿姨')
    || hint.includes('大叔')
    || hint.includes('御姐')
  ) {
    return '中年';
  }
  if (
    hint.includes('elderly')
    || hint.includes('elder')
    || hint.includes('senior')
    || hint.includes('old')
    || hint.includes('老年')
    || hint.includes('奶奶')
    || hint.includes('爷爷')
    || hint.includes('老人')
    || hint.includes('老者')
  ) {
    return '老年';
  }
  return null;
}

function inferChineseFromVoice(voice) {
  const voiceId = normalizeText(voice?.voice_id).toLowerCase();
  const providerVoiceId = normalizeText(voice?.provider_voice_id).toLowerCase();
  return voiceId.startsWith('zh-')
    || voiceId.startsWith('zh_')
    || providerVoiceId.startsWith('zh-')
    || providerVoiceId.startsWith('zh_')
    || normalizeText(voice?.language_boost).toLowerCase().includes('chinese');
}

function normalizeVoiceLanguage(value, voice) {
  const raw = normalizeText(value);
  const normalized = raw.toLowerCase();
  const hint = buildVoiceInferenceText(voice);
  if (
    normalized.includes('中文')
    || normalized.includes('汉语')
    || normalized.includes('mandarin')
    || normalized.includes('cantonese')
    || normalized.includes('chinese')
  ) {
    return '中文';
  }
  if (inferChineseFromVoice(voice)) {
    return '中文';
  }
  if (
    hint.includes('中文')
    || hint.includes('汉语')
    || hint.includes('国语')
    || hint.includes('普通话')
    || hint.includes('mandarin')
    || hint.includes('chinese')
    || hint.includes('cantonese')
  ) {
    return '中文';
  }
  if (
    !raw
    && normalizeText(voice?.provider).toLowerCase() === 'minimax'
    && normalizeText(voice?.source_label || voice?.sourceLabel).includes('MiniMax')
  ) {
    return '中文';
  }
  return raw || null;
}

function isVoiceIdentifierLike(value) {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  if (/[\u4e00-\u9fff]/.test(normalized)) return false;
  return /^[a-z0-9._-]+$/i.test(normalized)
    || normalized.includes('Neural')
    || normalized.includes('bigtts');
}

function resolveVoiceAliasFromIds(voice) {
  const voiceIds = [
    normalizeText(voice?.voice_id),
    normalizeText(voice?.provider_voice_id),
    normalizeText(voice?.voiceId),
    normalizeText(voice?.providerVoiceId),
  ].filter(Boolean);
  for (const voiceId of voiceIds) {
    const exact = VOICE_ID_DISPLAY_ALIAS_MAP.get(voiceId.toLowerCase());
    if (exact) return exact;
  }
  return '';
}

function buildFriendlyVoiceFallbackName(voice) {
  const alias = resolveVoiceAliasFromIds(voice);
  if (alias) return alias;

  const style = normalizeText(voice?.style);
  const gender = normalizeVoiceGender(voice?.gender) || inferVoiceGender(voice);
  const ageGroup = normalizeVoiceAge(voice?.age_group) || inferVoiceAge(voice);
  const language = normalizeVoiceLanguage(voice?.language, voice);

  if (style && style !== '官方系统音色' && style !== '官方私有音色') {
    if (gender) return `${style}${gender}声`;
    return style;
  }
  if (ageGroup && gender) return `${ageGroup}${gender}声`;
  if (gender) return `${gender}声`;
  if (language === '中文') return '中文音色';
  return '音色';
}

export function getVoiceDisplayName(voice) {
  if (!voice || typeof voice !== 'object') return '未命名音色';

  const alias = resolveVoiceAliasFromIds(voice);

  const rawName = normalizeText(voice.name)
    || normalizeText(voice.voice_name)
    || normalizeText(voice.original_name)
    || normalizeText(voice.originalName);
  if (alias && !hasChineseText(rawName)) return alias;
  if (rawName && !isVoiceIdentifierLike(rawName)) return rawName;
  if (alias) return alias;

  return buildFriendlyVoiceFallbackName(voice);
}

function normalizeVoiceItem(voice) {
  if (!voice || typeof voice !== 'object') return voice;
  const gender = normalizeVoiceGender(voice.gender) || inferVoiceGender(voice);
  const ageGroup = normalizeVoiceAge(voice.age_group) || inferVoiceAge(voice);
  const previewUrl = normalizeImageUrl(
    voice.preview_url
    || voice.previewUrl
    || voice.source_audio_url
    || voice.sourceAudioUrl,
  );
  const sourceAudioUrl = normalizeImageUrl(voice.source_audio_url || voice.sourceAudioUrl);
  return {
    ...voice,
    id: voice.id ?? '',
    voice_id: voice.voice_id || voice.voiceId || '',
    provider_voice_id: voice.provider_voice_id || voice.providerVoiceId || null,
    name: normalizeText(voice.name) || normalizeText(voice.original_name) || normalizeText(voice.originalName) || '未命名音色',
    gender,
    age_group: ageGroup,
    language: normalizeVoiceLanguage(voice.language, voice),
    style: normalizeText(voice.style) || null,
    emotions: normalizeText(voice.emotions) || null,
    preview_url: previewUrl,
    previewUrl,
    source_audio_url: sourceAudioUrl,
    sourceAudioUrl,
    provider: normalizeText(voice.provider) || 'miioo',
    is_custom: Boolean(voice.is_custom ?? voice.isCustom),
    is_favorite: Boolean(voice.is_favorite ?? voice.isFavorite),
    source_label: normalizeText(voice.source_label || voice.sourceLabel) || null,
    supports_favorite: voice.supports_favorite ?? voice.supportsFavorite ?? true,
    supports_generate: voice.supports_generate ?? voice.supportsGenerate ?? true,
    is_enabled: voice.is_enabled ?? voice.isEnabled ?? true,
    sort_order: Number(voice.sort_order ?? voice.sortOrder ?? 0),
    display_name: getVoiceDisplayName({
      ...voice,
      gender,
      age_group: ageGroup,
      language: normalizeVoiceLanguage(voice.language, voice),
      style: normalizeText(voice.style) || null,
    }),
  };
}

function normalizeVoiceListResponse(payload) {
  const list = Array.isArray(payload) ? payload : payload?.list ?? payload?.items ?? payload?.voices ?? [];
  return list.map(normalizeVoiceItem);
}

function normalizeVoiceLibraryPageResponse(payload, paramsModel) {
  return {
    list: normalizeVoiceListResponse(payload),
    total: Number(payload?.total || 0),
    enabledTotal: Number(payload?.enabled_total || payload?.enabledTotal || 0),
    page: Number(payload?.page || paramsModel.page) || paramsModel.page,
    pageSize: Number(payload?.page_size || payload?.pageSize || paramsModel.pageSize) || paramsModel.pageSize,
    hasMore: Boolean(payload?.has_more ?? payload?.hasMore ?? false),
  };
}

function getErrorMessage(payload, fallback = '请求失败') {
  if (!payload) return fallback;
  if (typeof payload?.detail === 'string') return payload.detail;
  if (typeof payload?.message === 'string') return payload.message;
  if (typeof payload?.error === 'string') return payload.error;
  if (typeof payload?.detail?.message === 'string') return payload.detail.message;
  return fallback;
}

async function parseVoiceJsonResponse(res, fallback = '请求失败') {
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(getErrorMessage(payload, fallback));
  }
  return payload;
}

function appendOptionalFormField(formData, key, value) {
  if (value === undefined || value === null) return;
  if (typeof value === 'string') {
    formData.append(key, value);
    return;
  }
  formData.append(key, String(value));
}

export function matchesVoiceQueryFilters(voice, {
  gender,
  age_group,
  ageGroup,
  language,
} = {}) {
  const normalizedVoice = normalizeVoiceItem(voice);
  if (!normalizedVoice || typeof normalizedVoice !== 'object') return false;
  if (gender && gender !== '不限' && normalizedVoice.gender !== gender) return false;
  const normalizedAge = age_group || ageGroup;
  if (normalizedAge && normalizedAge !== '不限' && normalizedVoice.age_group !== normalizedAge) return false;
  if (language && language !== '不限' && normalizedVoice.language !== language) return false;
  return true;
}

export async function apiGetVoices({ tab, gender, age_group, emotion_type, language } = {}) {
  return cached(
    K.voices({ tab, gender, age_group, emotion_type, language }),
    async () => {
      const params = new URLSearchParams();
      if (tab) params.append('tab', tab);
      if (gender) params.append('gender', gender);
      if (age_group) params.append('age_group', age_group);
      if (emotion_type) params.append('emotion_type', emotion_type);
      if (language) params.append('language', language);
      const query = params.toString();
      const url = query ? `${BASE}/api/voices?${query}` : `${BASE}/api/voices`;
      const res = await authFetch(url, { headers: { 'Content-Type': 'application/json' } });
      const data = await res.json();
      return normalizeVoiceListResponse(data);
    },
    { medium: MEDIUM.STATIC, ttl: TTL.STATIC },
  );
}

export async function apiGetVoiceLibrary({
  provider = 'miioo',
  gender,
  age_group,
  ageGroup,
  language,
  emotion,
  keyword,
  is_enabled,
  isEnabled,
  include_disabled,
  page,
  pageSize,
  skipCache,
} = {}) {
  const enabledValue = typeof is_enabled === 'boolean'
    ? is_enabled
    : typeof isEnabled === 'boolean'
      ? isEnabled
      : undefined;
  const paramsModel = {
    provider,
    gender,
    age_group: age_group || ageGroup,
    language,
    emotion,
    keyword,
    is_enabled: enabledValue,
    include_disabled: include_disabled !== undefined ? Boolean(include_disabled) : undefined,
    page: page ? Number(page) : undefined,
    pageSize: pageSize ? Number(pageSize) : undefined,
  };
  const fetcher = async () => {
    const params = new URLSearchParams();
    if (provider) params.append('provider', provider);
    if (gender) params.append('gender', gender);
    if (age_group || ageGroup) params.append('age_group', age_group || ageGroup);
    if (language) params.append('language', language);
    if (emotion) params.append('emotion', emotion);
    if (keyword) params.append('keyword', keyword);
    if (enabledValue !== undefined) params.append('is_enabled', String(enabledValue));
    if (include_disabled !== undefined) params.append('include_disabled', String(Boolean(include_disabled)));
    if (page) params.append('page', String(Number(page)));
    if (pageSize) params.append('page_size', String(Number(pageSize)));
    const query = params.toString();
    const url = query ? `${BASE}/api/voices/library?${query}` : `${BASE}/api/voices/library`;
    const res = await authFetch(url, { headers: { 'Content-Type': 'application/json' } });
    const data = await res.json();
    if (page || pageSize) {
      return normalizeVoiceLibraryPageResponse(data, {
        page: Number(page) || 1,
        pageSize: Number(pageSize) || 20,
      });
    }
    return normalizeVoiceListResponse(data);
  };
  if (skipCache) return fetcher();
  return cached(
    K.voiceLibrary(paramsModel),
    fetcher,
    { medium: MEDIUM.STATIC, ttl: TTL.STATIC },
  );
}

export async function apiGetOfficialVoices({
  provider,
  language,
} = {}) {
  return cached(
    K.officialVoices({ provider, language }),
    async () => {
      const params = new URLSearchParams();
      if (provider) params.append('provider', provider);
      if (language) params.append('language', language);
      const query = params.toString();
      const url = query ? `${BASE}/api/voices/official?${query}` : `${BASE}/api/voices/official`;
      const res = await authFetch(url, { headers: { 'Content-Type': 'application/json' } });
      const data = await res.json();
      return normalizeVoiceListResponse(data);
    },
    { medium: MEDIUM.STATIC, ttl: TTL.STATIC },
  );
}

export async function apiGetCustomVoices() {
  return apiGetVoices({ tab: 'custom' });
}

export async function apiCreateCustomVoice({ file, name }) {
  const formData = new FormData();
  formData.append('file', file);
  if (name) formData.append('name', name);
  const res = await authFetchForm(`${BASE}/api/voices/custom`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail || err?.message || '创建音色失败');
  }
  const data = await res.json();
  invalidate('voices:');
  return normalizeVoiceItem(data);
}

export async function apiCreateVoiceLibraryItem({
  name,
  gender,
  age_group,
  ageGroup,
  language,
  style,
  emotions,
  sort_order,
  sortOrder,
  is_enabled,
  isEnabled,
  preview_file,
  previewFile,
  provider = 'miioo',
} = {}) {
  const formData = new FormData();
  formData.append('name', String(name || '').trim());
  appendOptionalFormField(formData, 'gender', gender);
  appendOptionalFormField(formData, 'age_group', age_group || ageGroup);
  appendOptionalFormField(formData, 'language', language);
  appendOptionalFormField(formData, 'style', style);
  appendOptionalFormField(formData, 'emotions', emotions);
  appendOptionalFormField(formData, 'provider', provider);
  appendOptionalFormField(formData, 'sort_order', sort_order ?? sortOrder ?? 0);
  appendOptionalFormField(formData, 'is_enabled', is_enabled ?? isEnabled ?? true);
  if (preview_file || previewFile) {
    formData.append('preview_file', preview_file || previewFile);
  }
  const res = await authFetchForm(`${BASE}/api/voices/library`, {
    method: 'POST',
    body: formData,
  });
  const payload = normalizeVoiceItem(await parseVoiceJsonResponse(res, '创建 miioo 音色失败'));
  invalidate(K.voiceLibraryPrefix());
  return payload;
}

export async function apiUpdateVoiceLibraryItem(
  voiceId,
  {
    name,
    gender,
    age_group,
    ageGroup,
    language,
    style,
    emotions,
    sort_order,
    sortOrder,
    is_enabled,
    isEnabled,
    preview_file,
    previewFile,
    provider,
  } = {},
) {
  const formData = new FormData();
  appendOptionalFormField(formData, 'name', typeof name === 'string' ? name.trim() : name);
  appendOptionalFormField(formData, 'gender', gender);
  appendOptionalFormField(formData, 'age_group', age_group || ageGroup);
  appendOptionalFormField(formData, 'language', language);
  appendOptionalFormField(formData, 'style', style);
  appendOptionalFormField(formData, 'emotions', emotions);
  appendOptionalFormField(formData, 'provider', provider);
  appendOptionalFormField(formData, 'sort_order', sort_order ?? sortOrder);
  appendOptionalFormField(formData, 'is_enabled', is_enabled ?? isEnabled);
  if (preview_file || previewFile) {
    formData.append('preview_file', preview_file || previewFile);
  }
  const res = await authFetchForm(`${BASE}/api/voices/library/${voiceId}`, {
    method: 'PATCH',
    body: formData,
  });
  const payload = normalizeVoiceItem(await parseVoiceJsonResponse(res, '更新 miioo 音色失败'));
  invalidate(K.voiceLibraryPrefix());
  return payload;
}

export async function apiDeleteVoiceLibraryItem(voiceId) {
  const res = await authFetch(`${BASE}/api/voices/library/${voiceId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  const payload = normalizeVoiceItem(await parseVoiceJsonResponse(res, '停用 miioo 音色失败'));
  invalidate(K.voiceLibraryPrefix());
  return payload;
}
