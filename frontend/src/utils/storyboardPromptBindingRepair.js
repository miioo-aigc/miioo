/**
 * @file storyboardPromptBindingRepair.js
 *
 * 分镜视频提示词主体绑定工具。
 * 只负责根据当前提示词和主体参考数据计算绑定结果，不执行请求或 React 状态写回。
 */

function backendSubjectType(type) {
  if (type === 'char' || type === 'character') return 'character';
  if (type === 'scene') return 'scene';
  if (type === 'prop' || type === 'object') return 'prop';
  return type || 'character';
}

function subjectTypeForConsistency(label) {
  if (label === '角色') return 'character';
  if (label === '场景') return 'scene';
  if (label === '道具') return 'prop';
  return null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getConsistencyMentions(prompt) {
  const mentions = [];
  const pattern = /^(角色|场景|道具)一致性\s*[:：]\s*([^\n]+)/gm;
  let match;
  while ((match = pattern.exec(prompt || '')) !== null) {
    const name = match[2].split(/[，,。；;：:]/, 1)[0].trim();
    if (name) mentions.push({ name, type: subjectTypeForConsistency(match[1]) });
  }
  return mentions;
}

function getSubjectId(subject) {
  return subject?.subjectId || subject?.subject_id || subject?.id;
}

function addMention(mentions, seen, subject) {
  const subjectId = getSubjectId(subject);
  if (!subjectId || seen.has(String(subjectId))) return;
  seen.add(String(subjectId));
  mentions.push({
    subject_id: subjectId,
    subject_type: backendSubjectType(subject.type || subject.subjectType || subject.subject_type),
    name: subject.name,
    display: `@${subject.name}`,
    display_text: `@${subject.name}`,
  });
}

/**
 * 根据当前提示词生成去重后的 video_prompt_mentions。
 * 普通描述只识别已有 @ 标签；无 @ 标签时，仅从角色/场景/道具一致性字段做唯一模糊匹配。
 */
export function buildVideoPromptMentions(prompt, subjects) {
  const items = Array.isArray(subjects) ? subjects : [];
  const byName = new Map();
  items.forEach((subject) => {
    const name = String(subject?.name || '').trim();
    if (!name) return;
    const list = byName.get(name) || [];
    list.push(subject);
    byName.set(name, list);
  });

  const names = [...byName.keys()].sort((a, b) => b.length - a.length);
  if (!prompt || names.length === 0) return [];
  const pattern = new RegExp(`@(${names.map(escapeRegExp).join('|')})(?![\\u4e00-\\u9fffA-Za-z0-9_])`, 'g');
  const mentions = [];
  const seen = new Set();
  let match;
  while ((match = pattern.exec(prompt)) !== null) {
    const candidates = byName.get(match[1]) || [];
    if (candidates.length === 1) addMention(mentions, seen, candidates[0]);
  }

  // 后端生成的提示词可能没有插入 @ 标签，只在一致性字段中做受控的唯一模糊匹配。
  getConsistencyMentions(prompt).forEach(({ name, type }) => {
    const candidates = items.filter((subject) => {
      const subjectName = String(subject?.name || '').trim();
      if (!subjectName || !name) return false;
      const subjectType = backendSubjectType(subject.type || subject.subjectType || subject.subject_type);
      return (!type || subjectType === type)
        && (subjectName === name || subjectName.includes(name) || name.includes(subjectName));
    });
    if (candidates.length === 1) addMention(mentions, seen, candidates[0]);
  });
  return mentions;
}

function getPromptFromShot(shot) {
  return shot?.creationForm?.video?.prompt
    || shot?.creationForm?.video?.video_prompt
    || shot?.video_prompt
    || shot?.videoPrompt
    || shot?.video_prompt_generation
    || '';
}

function getExistingMentions(shot) {
  const mentions = shot?.creationForm?.video?.video_prompt_mentions;
  if (Array.isArray(mentions)) return mentions;
  if (Array.isArray(shot?.video_prompt_mentions)) return shot.video_prompt_mentions;
  return [];
}

/**
 * 仅修复当前没有任何绑定的镜头。已有绑定（包括历史重复数据）交由当前编辑器保存流程处理，
 * 页面加载阶段不重新猜测，避免改变用户已经明确建立的关系。
 */
export function repairStoryboardPromptBindings(shot, subjects) {
  if (!shot || getExistingMentions(shot).length > 0) return null;
  const prompt = getPromptFromShot(shot);
  const mentions = buildVideoPromptMentions(prompt, subjects);
  if (mentions.length === 0) return null;
  return { prompt, mentions };
}

export function getStoryboardVideoPrompt(shot) {
  return getPromptFromShot(shot);
}
