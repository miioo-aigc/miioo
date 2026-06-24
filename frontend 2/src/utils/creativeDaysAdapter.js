/**
 * 将 creationStore 的 generationsByTab 数据转换为按日期分组的格式
 * 供 CreativeAssetsPanel 和 AssetPickerModal 使用
 */

/**
 * 将 ISO 时间字符串转换为日期标签
 * @param {string} isoString - ISO 时间字符串
 * @returns {string} 日期标签："今天"、"昨天" 或 "YYYY-MM-DD"
 */
function formatDateLabel(isoString) {
  const date = new Date(isoString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  if (target.getTime() === today.getTime()) {
    return '今天';
  } else if (target.getTime() === yesterday.getTime()) {
    return '昨天';
  } else {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * 将 generations 数组转换为按日期分组的格式
 * @param {Array} generations - generation 数组
 * @returns {Array} 按日期分组的数组 [{ date: '今天', cards: [...] }, ...]
 */
export function generationsToDays(generations) {
  if (!generations || generations.length === 0) {
    return [];
  }

  // 按日期分组
  const groupedByDate = {};

  generations.forEach((gen) => {
    const dateLabel = formatDateLabel(gen.createdAt || new Date().toISOString());

    if (!groupedByDate[dateLabel]) {
      groupedByDate[dateLabel] = [];
    }

    // 将每个 generation 的 cards 展开，使用 composite ID，同时带上 generation 级别字段
    gen.cards.forEach((card, cardIdx) => {
      const compositeId = `${gen.id}-${cardIdx}`;
      groupedByDate[dateLabel].push({
        ...card,
        id: compositeId,
        backendId: card.id ?? null,   // preserve real backend ID for API calls
        genId: gen.id,
        cardIdx,
        name: card.name || `生成_${gen.id.slice(0, 8)}`,
        url: card.imageUrl || card.poster || null,
        prompt: gen.prompt,
        model: gen.model,
        ratio: gen.ratio,
        resolution: gen.resolution,
        duration: gen.duration || card.duration || null,
        refMode: gen.refMode,
        firstFrame: gen.firstFrame,
        lastFrame: gen.lastFrame,
        sound: gen.sound,
        refImages: gen.refImages,
        createdAt: gen.createdAt,
        genType: gen.genType,
      });
    });
  });

  // 转换为数组格式，按日期排序（今天 > 昨天 > 其他日期倒序）
  const days = Object.entries(groupedByDate).map(([date, cards]) => ({
    date,
    // 组内按 createdAt 倒序，最新创建的在最前面
    cards: cards.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  }));

  // 排序逻辑
  days.sort((a, b) => {
    if (a.date === '今天') return -1;
    if (b.date === '今天') return 1;
    if (a.date === '昨天') return -1;
    if (b.date === '昨天') return 1;
    // 其他日期按时间倒序
    return b.date.localeCompare(a.date);
  });

  return days;
}

/**
 * 将 generations 数组转换为扁平化的资产列表（供 AssetPickerModal 使用）
 * @param {Array} generations - generation 数组
 * @param {Set} favorites - 收藏的 cardKey 集合
 * @returns {Array} 扁平化的资产数组
 */
export function generationsToFlatList(generations, favorites) {
  if (!generations || generations.length === 0) {
    return [];
  }

  const list = [];

  generations.forEach((gen) => {
    gen.cards.forEach((card, cardIdx) => {
      const compositeId = `${gen.id}-${cardIdx}`;
      list.push({
        ...card,
        id: compositeId,
        backendId: card.id ?? null,   // preserve real backend ID for API calls
        genId: gen.id,
        cardIdx,
        name: card.name || `生成_${gen.id.slice(0, 8)}`,
        url: card.imageUrl || card.poster || null,
        prompt: gen.prompt,
        model: gen.model,
        ratio: gen.ratio,
        resolution: gen.resolution,
        duration: gen.duration || card.duration || null,
        refMode: gen.refMode,
        firstFrame: gen.firstFrame,
        lastFrame: gen.lastFrame,
        sound: gen.sound,
        refImages: gen.refImages,
        createdAt: gen.createdAt,
        genType: gen.genType,
        starred: favorites.has(compositeId),
        bgColor: '#1F2324',
      });
    });
  });

  // 最新创建的在最前面
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return list;
}
