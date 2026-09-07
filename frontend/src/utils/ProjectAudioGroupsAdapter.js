/**
 * 项目音频按分集和分镜分组。
 * 这里接收已经经过资产接口归一化的卡片，保留卡片顺序，只负责展示分区排序。
 */

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function episodeNumberFromLabel(label) {
  const match = String(label || '').match(/第(\d+|[零一二三四五六七八九十百千]+)集/);
  if (!match) return null;
  if (/^\d+$/.test(match[1])) return Number(match[1]);
  const digits = { 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (match[1] === '十') return 10;
  if (match[1].startsWith('十')) return 10 + (digits[match[1][1]] || 0);
  if (match[1].endsWith('十')) return (digits[match[1][0]] || 0) * 10;
  if (match[1].includes('十')) {
    const [tens, ones] = match[1].split('十');
    return (digits[tens] || 0) * 10 + (digits[ones] || 0);
  }
  return digits[match[1]] ?? null;
}

function getGroupKey(asset) {
  const episodeNumber = toNumber(asset.episode_number ?? asset.episodeNumber)
    ?? episodeNumberFromLabel(asset.episodeLabel ?? asset.episode_label);
  const shotNumber = toNumber(asset.shot_number ?? asset.shotNumber);
  if (episodeNumber == null || shotNumber == null) return null;
  return `${episodeNumber}:${shotNumber}`;
}

function getGroupLabel(asset, episodeNumber, shotNumber) {
  const episodeLabel = asset.episodeLabel || asset.episode_label || (episodeNumber != null ? `第${episodeNumber}集` : '未归组');
  return `${episodeLabel} - 分镜${String(shotNumber).padStart(2, '0')}`;
}

export function groupProjectAudioAssets(assets = []) {
  const groups = new Map();
  const ungrouped = [];

  assets.forEach((asset) => {
    const key = getGroupKey(asset);
    if (!key) {
      ungrouped.push(asset);
      return;
    }
    if (!groups.has(key)) {
      const episodeNumber = toNumber(asset.episode_number ?? asset.episodeNumber)
        ?? episodeNumberFromLabel(asset.episodeLabel ?? asset.episode_label);
      const shotNumber = toNumber(asset.shot_number ?? asset.shotNumber);
      groups.set(key, {
        key: `episode-${episodeNumber}-shot-${shotNumber}`,
        label: getGroupLabel(asset, episodeNumber, shotNumber),
        episodeNumber,
        shotNumber,
        assets: [],
      });
    }
    groups.get(key).assets.push(asset);
  });

  const sorted = [...groups.values()].sort((a, b) => (
    a.episodeNumber - b.episodeNumber || a.shotNumber - b.shotNumber
  ));
  if (ungrouped.length > 0) {
    sorted.push({ key: 'ungrouped', label: '未归组', episodeNumber: null, shotNumber: null, assets: ungrouped });
  }
  return sorted;
}

