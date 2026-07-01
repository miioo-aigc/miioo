export const DEFAULT_NARRATION_EMOTIONS = ['中性', '愤怒', '开心', '悲伤', '恐惧', '冷漠', '惊讶', '温柔'];

function cleanText(value) {
  return String(value ?? '').trim();
}

function parseVoiceoverLine(line) {
  const cleaned = cleanText(line);
  if (!cleaned) return null;
  for (const separator of ['：', ':']) {
    const idx = cleaned.indexOf(separator);
    if (idx > 0) {
      return {
        role: cleaned.slice(0, idx).trim(),
        lines: cleaned.slice(idx + separator.length).trim(),
      };
    }
  }
  return { role: '', lines: cleaned };
}

export function parseVoiceoverToSegments(voiceover) {
  const normalized = cleanText(voiceover);
  if (!normalized) return [];
  return normalized
    .split('\n')
    .map(parseVoiceoverLine)
    .filter(Boolean);
}

export function normalizeNarrationSegment(segment, globalVoiceParams = {}) {
  if (!segment || typeof segment !== 'object') return null;
  const role = cleanText(segment.role);
  const lines = cleanText(segment.lines ?? segment.value);
  if (!lines) return null;

  const globalForRole = role ? (globalVoiceParams[role] ?? {}) : {};
  return {
    role,
    lines,
    speed: segment.speed ?? globalForRole.speed ?? 1.0,
    volume: segment.volume ?? globalForRole.volume ?? 70,
    emotion: cleanText(segment.emotion || globalForRole.emotion) || '中性',
    subject_id: cleanText(segment.subject_id) || undefined,
    voice_id: cleanText(segment.voice_id) || undefined,
    usesGlobal: segment.usesGlobal === true || segment._usesGlobal === true,
  };
}

export function normalizeNarrationFromStoryboard(be, globalVoiceParams = {}) {
  const genParams = be?.gen_params && typeof be.gen_params === 'object' ? be.gen_params : {};
  const rawSegments = Array.isArray(genParams.narration_segments) ? genParams.narration_segments : null;

  if (rawSegments?.length) {
    return {
      segments: rawSegments
        .map((segment) => normalizeNarrationSegment({
          role: segment.role,
          lines: segment.value ?? segment.lines,
          speed: segment.speed,
          volume: segment.volume,
          emotion: segment.emotion,
          subject_id: segment.subject_id,
          voice_id: segment.voice_id,
          usesGlobal: segment.usesGlobal,
          _usesGlobal: segment._usesGlobal,
        }, globalVoiceParams))
        .filter(Boolean),
      globalVoiceParams: genParams.global_voice_params && typeof genParams.global_voice_params === 'object'
        ? genParams.global_voice_params
        : globalVoiceParams,
    };
  }

  if (be?.narration?.segments?.length) {
    return {
      segments: be.narration.segments
        .map((segment) => normalizeNarrationSegment(segment, globalVoiceParams))
        .filter(Boolean),
      globalVoiceParams,
    };
  }

  const parsed = parseVoiceoverToSegments(be?.voiceover);
  return {
    segments: parsed.map((segment) => normalizeNarrationSegment(segment, globalVoiceParams)).filter(Boolean),
    globalVoiceParams,
  };
}

export function segmentsToVoiceover(segments) {
  if (!Array.isArray(segments) || segments.length === 0) return undefined;
  const lines = segments
    .map((segment) => {
      const role = cleanText(segment.role);
      const linesText = cleanText(segment.lines);
      if (!linesText) return null;
      return role ? `${role}：${linesText}` : linesText;
    })
    .filter(Boolean);
  return lines.length ? lines.join('\n') : undefined;
}

export function buildNarrationGenParams(shot, globalVoiceParams = {}) {
  const segments = Array.isArray(shot?.narration?.segments) ? shot.narration.segments : [];
  const normalizedSegments = segments
    .map((segment) => normalizeNarrationSegment(segment, globalVoiceParams))
    .filter(Boolean);

  const narrationSegments = normalizedSegments.map((segment) => ({
    role: segment.role,
    value: segment.lines,
    speed: segment.speed,
    volume: segment.volume,
    emotion: segment.emotion,
    subject_id: segment.subject_id,
    voice_id: segment.voice_id,
    ...(segment.usesGlobal ? { usesGlobal: true } : {}),
  }));

  const genParams = {};
  if (narrationSegments.length > 0) {
    genParams.narration_segments = narrationSegments;
  }
  if (globalVoiceParams && Object.keys(globalVoiceParams).length > 0) {
    genParams.global_voice_params = globalVoiceParams;
  }
  return genParams;
}

export function resolveVoiceNameForRole(role, chars = [], voiceList = []) {
  const normalizedRole = cleanText(role);
  if (!normalizedRole) return null;
  const subject = chars.find((item) => item?.name === normalizedRole || item?.role === normalizedRole);
  const voiceId = cleanText(subject?.voice_id ?? subject?.voiceId);
  if (!voiceId) return null;
  const voice = voiceList.find((item) => item?.voice_id === voiceId || item?.id === voiceId);
  return cleanText(voice?.name) || voiceId;
}

export function clampDurationLabel(value, min = 4, max = 15) {
  const match = String(value ?? '').match(/(\d+(?:\.\d+)?)/);
  const numeric = match ? Number(match[1]) : min;
  const clamped = Math.max(min, Math.min(max, numeric));
  return Number.isInteger(clamped) ? `${clamped}s` : `${clamped.toFixed(1)}s`;
}
