/**
 * @file buildStoryboardPrompt.js
 * @structure-index
 *
 * 将分镜字段组合为生成面板初始提示词的纯函数。
 */

export default function buildStoryboardPrompt(shot) {
  const lines = [];
  const paramParts = [
    shot?.params?.framing,
    shot?.params?.cameraMotion,
    shot?.params?.angle,
    shot?.params?.composition,
    shot?.params?.duration,
  ].filter(Boolean);
  if (paramParts.length) lines.push(paramParts.join('，'));

  const atmosphereParts = [shot?.lightShadow, shot?.ambientSound].filter(Boolean);
  if (atmosphereParts.length) lines.push(atmosphereParts.join('，'));

  if (shot?.description) lines.push(shot.description);

  if (shot?.narration?.segments?.length > 0) {
    lines.push(shot.narration.segments.map((segment) => `${segment.role}：${segment.lines}`).join('，'));
  }

  return lines.join('\n');
}
