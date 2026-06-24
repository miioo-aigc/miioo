// ── DOM helpers for atomic mention editing ──────────────────────────────────

export const MENTION_TYPE_COLOR = { character: '#E2E24B', scene: '#71C4FF', prop: '#C084FC' };

export function buildMentionPattern(allSubjects) {
  const names = allSubjects.map((s) => s.name).filter(Boolean);
  if (names.length === 0) return null;
  return new RegExp(
    `@(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'g'
  );
}

export function parseSegments(text, allSubjects) {
  const pattern = buildMentionPattern(allSubjects);
  const segments = [];
  let last = 0;

  if (!pattern) {
    if (text) segments.push({ kind: 'text', text });
    return segments;
  }

  let m;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) segments.push({ kind: 'text', text: text.slice(last, m.index) });
    const name = m[0].slice(1);
    const subject = allSubjects.find((s) => s.name === name);
    segments.push({ kind: 'mention', name, type: subject?._type ?? 'image' });
    last = m.index + m[0].length;
  }

  if (last < text.length) segments.push({ kind: 'text', text: text.slice(last) });
  return segments;
}

export function serializeEditor(el) {
  let out = '';
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.dataset?.mention) {
        out += `@${node.dataset.mention}`;
      } else if (node.tagName === 'BR') {
        out += '\n';
      } else {
        out += node.textContent;
      }
    }
  }
  return out;
}

export function rebuildEditorDOM(el, text, allSubjects, typeOverrides = {}) {
  const segs = parseSegments(text, allSubjects);
  el.innerHTML = '';
  for (const seg of segs) {
    if (seg.kind === 'text') {
      if (seg.text) el.appendChild(document.createTextNode(seg.text));
    } else {
      const type = typeOverrides[seg.name] ?? seg.type;
      const color = MENTION_TYPE_COLOR[type] ?? '#E2E24B';
      const span = document.createElement('span');
      span.dataset.mention = seg.name;
      span.dataset.mentionType = type;
      span.contentEditable = 'false';
      span.textContent = `@${seg.name}`;
      span.style.cssText = [
        'display:inline-flex', 'align-items:center', 'padding:0 4px',
        'border-radius:4px', 'font-size:14px', 'line-height:21px',
        `background:${color}26`, `color:${color}`,
        `box-shadow:inset 0 0 0 1px ${color}33`,
        'vertical-align:middle', 'user-select:none', 'cursor:default',
      ].join(';');
      el.appendChild(span);
    }
  }
  if (!el.lastChild || el.lastChild.nodeType !== Node.TEXT_NODE) {
    el.appendChild(document.createTextNode(''));
  }
}

export function getCaretOffset(el) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  let offset = 0;
  for (const node of el.childNodes) {
    if (node === range.startContainer || node.contains?.(range.startContainer)) {
      if (node.nodeType === Node.TEXT_NODE) offset += range.startOffset;
      else if (node.dataset?.mention) {
        offset += node.dataset.mention.length + 1;
      }
      break;
    }
    if (node.nodeType === Node.TEXT_NODE) offset += node.textContent.length;
    else if (node.dataset?.mention) {
      offset += node.dataset.mention.length + 1;
    }
    else offset += node.textContent.length;
  }
  return offset;
}

export function setCaretOffset(el, targetOffset) {
  let remaining = targetOffset;
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent.length;
      if (remaining <= len) {
        const range = document.createRange();
        range.setStart(node, remaining);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      remaining -= len;
    } else if (node.dataset?.mention) {
      const len = node.dataset.mention.length + 1;
      if (remaining < len) {
        const range = document.createRange();
        range.setStartAfter(node);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      remaining -= len;
    } else {
      const len = node.textContent.length;
      if (remaining <= len) {
        const range = document.createRange();
        range.setStart(node, 0);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      remaining -= len;
    }
  }
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}
