import formatMentionLabel from './formatMentionLabel';

/**
 * 根据纯文本 prompt 和参考图列表构造 promptHTML（包含 @ 标签 span）
 * 用于历史数据加载、重新编辑等没有 promptHTML 可用的场景
 * @param {string} prompt - 纯文本提示词（不含 @ 标签）
 * @param {Array<{name: string}>} refImages - 参考图数组，至少包含 name 属性
 * @returns {string} 含 @ 标签 span 的 HTML 字符串，prompt 或 refImages 为空时返回空串
 */
function makeTagSpan(name) {
  const label = formatMentionLabel(name);
  return `<span data-file-ref="${name}" contenteditable="false" style="display:inline-flex;align-items:center;background:rgba(45,195,225,0.10);color:#2DC3E1;border-radius:6px;padding:0 4px;font-size:inherit;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.08);user-select:none;white-space:nowrap;">${label}</span>`;
}

export default function buildPromptHTML(prompt, refImages = []) {
  if (!prompt || !refImages.length) return '';

  let result = prompt;
  let replaced = false;

  for (const img of refImages) {
    const name = img.name || 'ref.png';
    // 只对「prompt 里含有文件名明文」的旧数据做原地替换
    // 新数据的 prompt 已剥离文件名，无法确定芯片位置，跳过（让调用方显示纯文本）
    if (result.includes(name)) {
      result = result.replace(name, makeTagSpan(name));
      replaced = true;
    }
  }

  // 没有任何替换（新数据）→ 返回空串，让 ImageDetailModal 回退到纯文本显示
  return replaced ? result : '';
}
