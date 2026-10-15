import { parse as parseSrt } from '@plussub/srt-vtt-parser';
import { parse as parseAss } from 'ass-compiler';

export const DEFAULT_SUBTITLE_STYLE = {
  fontFamily: 'sans-serif', fontSize: 48, color: '#ffffff', outlineColor: '#000000',
  outline: 0, textOpacity: 100, outlineOpacity: 100, background: '#000000', backgroundOpacity: 100, backgroundOn: false, align: 'center', x: 50, y: 90,
};

export function subtitleColorWithOpacity(color, opacity = 100) {
  const alpha = Math.round(Math.max(0, Math.min(100, opacity)) * 255 / 100).toString(16).padStart(2, '0');
  return `${color}${alpha}`;
}

function assColor(value, fallback) {
  const hex = String(value || '').replace(/^&H/i, '').replace(/&$/, '').padStart(8, '0');
  if (!/^[0-9a-f]{8}$/i.test(hex)) return fallback;
  return `#${hex.slice(6, 8)}${hex.slice(4, 6)}${hex.slice(2, 4)}`;
}

export function parseSubtitleFile(text, extension) {
  const warnings = new Set();
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  let cues;
  if (extension === 'srt') {
    const { entries } = parseSrt(normalized);
    const count = (normalized.match(/-->/g) || []).length;
    if (entries.length !== count) throw new Error('存在无法解析的字幕时间码，未导入任何字幕');
    cues = entries.map(({ from, to, text: content }) => ({ start: from / 1000, duration: (to - from) / 1000, text: content.replace(/<[^>]*>/g, ''), style: { ...DEFAULT_SUBTITLE_STYLE } }));
  } else if (extension === 'ass') {
    const parsed = parseAss(normalized);
    if (parsed.events.dialogue.length !== (normalized.match(/^Dialogue\s*:/gmi) || []).length) throw new Error('ASS 存在无法解析的对白，未导入任何字幕');
    const styles = new Map(parsed.styles.style.map((style) => [style.Name, style]));
    cues = parsed.events.dialogue.map((event) => {
      const style = styles.get(event.Style) || {};
      const alignment = Number(style.Alignment) || 2;
      const column = (alignment - 1) % 3;
      const row = Math.floor((alignment - 1) / 3);
      if (event.Text.parsed.some((part) => part.tags.length || part.drawing.length) || event.Effect) warnings.add('ASS 行内样式、动画、定位覆盖及绘图效果未还原，已使用基础样式');
      if (/&H(?!00)[0-9a-f]{8}/i.test([style.PrimaryColour, style.BackColour, style.OutlineColour].join(' '))) warnings.add('ASS 颜色透明度未还原');
      const font = style.Fontname || 'sans-serif';
      if (Number(style.Bold) || Number(style.Italic) || Number(style.Underline) || Number(style.StrikeOut) || Number(style.Angle) || Number(style.Shadow)) warnings.add('ASS 粗斜体、下划线、旋转及阴影未还原');
      let fontFamily = font;
      if (typeof document !== 'undefined' && !document.fonts.check(`16px "${font.replace(/["\\]/g, '')}"`)) {
        fontFamily = 'sans-serif';
        warnings.add(`字体「${font}」不可用，已回退默认字体`);
      }
      return {
        start: event.Start, duration: event.End - event.Start,
        text: event.Text.parsed.filter((part) => !part.drawing.length).map((part) => part.text).join('').replace(/\\[Nn]/g, '\n').replace(/\\h/g, ' '),
        style: { ...DEFAULT_SUBTITLE_STYLE, fontFamily,
          fontSize: Math.max(8, Math.min(200, (Number(style.Fontsize) || 48) * 1080 / (Number(parsed.info.PlayResY) || 1080))),
          color: assColor(style.PrimaryColour, '#ffffff'), outlineColor: assColor(style.OutlineColour, '#000000'),
          outline: Math.max(0, Math.min(10, Number(style.Outline) || 0)),
          background: assColor(style.BackColour, '#000000'), backgroundOn: Number(style.BorderStyle) === 3,
          align: ['left', 'center', 'right'][column] || 'center', x: [10, 50, 90][column] || 50, y: [90, 50, 10][row] || 90,
        },
      };
    });
  } else throw new Error('请选择 SRT 或 ASS 字幕文件');
  if (!cues?.length) throw new Error('文件中没有有效字幕');
  if (cues.length > 5000) throw new Error('单次最多导入 5000 条字幕');
  if (cues.some((cue) => !Number.isFinite(cue.start) || !Number.isFinite(cue.duration) || cue.start < 0 || cue.duration <= 0 || !cue.text.trim())) throw new Error('存在空字幕、非法时间码或不支持的纯绘图字幕，未导入任何字幕');
  return { cues: cues.sort((a, b) => a.start - b.start), warnings: [...warnings] };
}

export async function readSubtitleFile(file) {
  if (file.size > 5 * 1024 * 1024) throw new Error('字幕文件不能超过 5MB');
  const bytes = await file.arrayBuffer();
  let text;
  let fallback = false;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch {
    fallback = true;
    try { text = new TextDecoder('gb18030', { fatal: true }).decode(bytes); }
    catch { throw new Error('无法识别文件编码，请转换为 UTF-8 后重试'); }
  }
  const result = parseSubtitleFile(text, file.name.split('.').at(-1).toLowerCase());
  if (fallback) result.warnings.push('文件已按 GB18030 解码，请检查文字是否正确');
  return result;
}

export function allocateSubtitles(segments, cues, preferred = 'S1') {
  const ends = new Map();
  const occupied = segments.filter((seg) => seg.type === 'subtitle').map((seg) => {
    const track = seg.track || 'S1';
    const start = Number.isFinite(seg.start) ? seg.start : ends.get(track) || 0;
    ends.set(track, start + seg.duration);
    return { ...seg, track, start };
  });
  const tracks = [preferred || 'S1', ...Array.from({ length: 6 }, (_, index) => `S${index + 1}`)].filter((track, index, all) => all.indexOf(track) === index);
  return cues.map((cue) => {
    const track = tracks.find((lane) => !occupied.some((seg) => seg.track === lane && cue.start < seg.start + seg.duration && cue.start + cue.duration > seg.start));
    if (!track) throw new Error('字幕时间冲突，最多支持 6 条字幕轨道。本次未导入任何字幕');
    const next = { ...cue, track };
    occupied.push(next);
    return next;
  });
}
