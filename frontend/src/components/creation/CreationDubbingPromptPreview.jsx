/**
 * @file CreationDubbingPromptPreview.jsx
 * @description 只读还原高级配音提示词中的情绪、停顿与语气词标记。
 */

import { Fragment } from 'react';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

const EMOTIONS = {
  calm: { label: '中性', tone: 'positive' },
  fearful: { label: '害怕', tone: 'negative' },
  happy: { label: '开心', tone: 'positive' },
  sad: { label: '难过', tone: 'negative' },
  fluent: { label: '生动', tone: 'positive' },
  angry: { label: '生气', tone: 'negative' },
  surprised: { label: '惊讶', tone: 'positive' },
  disgusted: { label: '厌恶', tone: 'negative' },
};

const INTERJECTION_LABELS = {
  laughs: '笑声',
  chuckle: '轻笑',
  coughs: '咳嗽',
  'clear-throat': '清嗓子',
  groans: '呻吟',
  breath: '正常换气',
  pant: '喘气',
  inhale: '吸气',
  exhale: '呼气',
  gasps: '倒吸气',
  sniffs: '吸鼻子',
  sighs: '叹气',
  snorts: '喷鼻息',
  humming: '哼唱',
  burps: '打嗝',
  'lip-smacking': '咂嘴',
  hissing: '嘶嘶声',
  emm: '呃',
  sneezes: '唌',
};

const BASE_TEXT_STYLE = {
  color: '#FFFFFFCC',
  fontFamily: FONT,
  fontSize: '12px',
  lineHeight: 1.7,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

function getEmotionStyles(tone) {
  return tone === 'negative'
    ? { label: 'var(--color-red-500)', highlight: 'var(--color-red-alpha-20)' }
    : { label: 'var(--color-green-500)', highlight: 'var(--color-green-alpha-20)' };
}

function hasAdvancedPromptToken(prompt) {
  if (!prompt) return false;
  return /<#\d+(?:\.\d+)?#>|\(([a-z-]+)\)|\{(calm|fearful|happy|sad|fluent|angry|surprised|disgusted)\}/i.test(prompt);
}

function findEmotionEnd(prompt, key, startIndex) {
  const openTag = `{${key}}`;
  const closeTag = `{/${key}}`;
  let depth = 1;
  let cursor = startIndex;

  while (cursor < prompt.length) {
    const nextOpen = prompt.indexOf(openTag, cursor);
    const nextClose = prompt.indexOf(closeTag, cursor);
    if (nextClose === -1) return -1;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      cursor = nextOpen + openTag.length;
      continue;
    }
    depth -= 1;
    if (depth === 0) return nextClose;
    cursor = nextClose + closeTag.length;
  }

  return -1;
}

function renderPromptTokens(prompt, keyPrefix = 'prompt') {
  const nodes = [];
  let cursor = 0;
  let nodeIndex = 0;

  const appendText = (text) => {
    if (!text) return;
    nodes.push(<Fragment key={`${keyPrefix}-text-${nodeIndex++}`}>{text}</Fragment>);
  };

  while (cursor < prompt.length) {
    const rest = prompt.slice(cursor);
    const emotionMatch = rest.match(/^\{([a-z-]+)\}/i);
    if (emotionMatch && EMOTIONS[emotionMatch[1]]) {
      const emotionKey = emotionMatch[1];
      const openingTag = emotionMatch[0];
      const contentStart = cursor + openingTag.length;
      const closingIndex = findEmotionEnd(prompt, emotionKey, contentStart);
      if (closingIndex !== -1) {
        const emotion = EMOTIONS[emotionKey];
        const colors = getEmotionStyles(emotion.tone);
        const content = prompt.slice(contentStart, closingIndex);
        nodes.push(
          <span key={`${keyPrefix}-emotion-${nodeIndex++}`} style={{ display: 'inline', lineHeight: 'inherit', background: colors.highlight, borderRadius: '0 6px 6px 0', color: '#FFFFFF' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', height: '20px', marginRight: '4px', padding: '0 6px', borderRadius: '6px 0 0 6px', background: colors.label, color: '#FFFFFF', fontFamily: FONT, fontSize: '14px', lineHeight: '16px', verticalAlign: 'middle', userSelect: 'none' }}>{emotion.label}</span>
            {renderPromptTokens(content, `${keyPrefix}-emotion-${nodeIndex}`)}
          </span>,
        );
        cursor = closingIndex + `{/${emotionKey}}`.length;
        continue;
      }
    }

    const pauseMatch = rest.match(/^<#(\d+(?:\.\d+)?)#>/);
    if (pauseMatch) {
      nodes.push(<span key={`${keyPrefix}-pause-${nodeIndex++}`} style={{ display: 'inline-flex', alignItems: 'center', height: '20px', margin: '0 2px', padding: '1px 8px', borderRadius: '6px', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)', background: 'rgba(45,195,225,0.10)', color: '#2DC3E1', fontFamily: FONT, fontSize: '14px', lineHeight: '18px', verticalAlign: 'middle', userSelect: 'none', whiteSpace: 'nowrap' }}>{pauseMatch[1]}s</span>);
      cursor += pauseMatch[0].length;
      continue;
    }

    const interjectionMatch = rest.match(/^\(([a-z-]+)\)/i);
    if (interjectionMatch && INTERJECTION_LABELS[interjectionMatch[1]]) {
      nodes.push(<span key={`${keyPrefix}-interjection-${nodeIndex++}`} style={{ display: 'inline-flex', alignItems: 'center', height: '20px', margin: '0 2px', padding: '1px 8px', borderRadius: '6px', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)', background: 'rgba(232,161,255,0.10)', color: '#E8A1FF', fontFamily: FONT, fontSize: '14px', lineHeight: '18px', verticalAlign: 'middle', userSelect: 'none', whiteSpace: 'nowrap' }}>{INTERJECTION_LABELS[interjectionMatch[1]]}</span>);
      cursor += interjectionMatch[0].length;
      continue;
    }

    const nextMarker = prompt.slice(cursor + 1).search(/[<{(]/);
    const textEnd = nextMarker === -1 ? prompt.length : cursor + nextMarker + 1;
    appendText(prompt.slice(cursor, textEnd));
    cursor = textEnd;
  }

  return nodes;
}

export default function CreationDubbingPromptPreview({ prompt = '', advancedEnabled = false }) {
  if (!prompt) return <div style={BASE_TEXT_STYLE}>暂无</div>;

  const shouldParse = advancedEnabled || hasAdvancedPromptToken(prompt);

  return (
    <div style={BASE_TEXT_STYLE}>
      {shouldParse ? renderPromptTokens(prompt) : prompt}
    </div>
  );
}
