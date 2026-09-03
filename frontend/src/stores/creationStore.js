import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dedupeByMediaAliases, getCreationAssetMediaAliases } from '../utils/creationHistoryAdapter';

function getCardMediaAliases(card) {
  return getCreationAssetMediaAliases({
    url: card?.imageUrl || card?.videoUrl || card?.audioUrl,
    originalUrl: card?.originalUrl,
    thumbnailUrl: card?.thumbnailUrl,
  });
}

function getHistoryDeduplicationAliases(tab, card) {
  if (tab === 'video') {
    const id = card?.id;
    return id == null || id === '' ? [] : [`id:${String(id)}`];
  }
  return getCardMediaAliases(card);
}

function mergeGenerations(previous, current) {
  return {
    ...previous,
    prompt: previous.prompt || current.prompt || '',
    promptHTML: previous.promptHTML || current.promptHTML || '',
    model: previous.model || current.model || '',
    cards: previous.cards.map((card, index) => index === 0 ? {
      ...card,
      ...current.cards?.[0],
      id: card.id || current.cards?.[0]?.id,
      assetId: card.assetId || current.cards?.[0]?.assetId || null,
    } : card),
  };
}

export const useCreationStore = create(
  persist(
    (set) => ({
      generationsByTab: { image: [], video: [], dubbing: [], music: [] },
      favorites: new Set(),
      // Keys currently being toggled (optimistic update in-flight); syncFavorites skips these
      pendingFavoriteToggles: new Set(),
      // 每个 tab 的历史分页状态（不持久化，每次启动重新拉）
      historyMeta: {
        image:   { page: 0, hasMore: true, loading: false, initialized: false },
        video:   { page: 0, hasMore: true, loading: false, initialized: false },
        dubbing: { page: 0, hasMore: true, loading: false, initialized: false },
        // 音乐 Tab 暂无后端历史接口，预置为已初始化（hasMore=false），
        // 保证与配音等 Tab 的数据、分页和缓存完全隔离。
        music:   { page: 0, hasMore: false, loading: false, initialized: true },
      },

      // 合并历史数据（按卡片后端 ID 和媒体地址去重，避免本地结果与历史结果重复）
      // store 约定：数组越靠后 = 越新（display 时 reverse 展示最新在前）
      // 历史数据后端返回最新在前，插入时需反转后前置，保证 reverse 后新内容仍排第一
      mergeHistoryGenerations: (tab, newGenerations) =>
        set((state) => {
          const existing = state.generationsByTab[tab] ?? [];
          const next = dedupeByMediaAliases(existing, (generation) => getHistoryDeduplicationAliases(tab, generation.cards?.[0]), mergeGenerations);
          const locationsById = new Map();
          const locationsByMedia = new Map();
          next.forEach((generation, generationIndex) => {
            generation.cards.forEach((card, cardIndex) => {
              if (card.id) locationsById.set(String(card.id), { generationIndex, cardIndex });
              getHistoryDeduplicationAliases(tab, card).forEach((mediaKey) => locationsByMedia.set(mediaKey, { generationIndex, cardIndex }));
            });
          });

          const toAdd = [];
          newGenerations.forEach((generation) => {
            const unmatchedCards = [];
            generation.cards.forEach((card) => {
              const location = (card.id && locationsById.get(String(card.id))) || getHistoryDeduplicationAliases(tab, card)
                .map((mediaKey) => locationsByMedia.get(mediaKey)).find(Boolean);
              if (!location) {
                unmatchedCards.push(card);
                return;
              }

              const currentGeneration = next[location.generationIndex];
              const currentCard = currentGeneration.cards[location.cardIndex];
              next[location.generationIndex] = {
                ...currentGeneration,
                prompt: currentGeneration.prompt || generation.prompt || '',
                promptHTML: currentGeneration.promptHTML || generation.promptHTML || '',
                model: currentGeneration.model || generation.model || '',
                cards: currentGeneration.cards.map((item, index) => index === location.cardIndex
                  ? { ...item, ...card, id: card.id || item.id }
                  : item),
              };
              if (card.id) locationsById.set(String(card.id), location);
              getHistoryDeduplicationAliases(tab, currentCard).concat(getHistoryDeduplicationAliases(tab, card)).forEach((mediaKey) => locationsByMedia.set(mediaKey, location));
            });
            if (unmatchedCards.length > 0) toAdd.push({ ...generation, cards: unmatchedCards });
          });

          const merged = dedupeByMediaAliases([...toAdd.reverse(), ...next], (generation) => getHistoryDeduplicationAliases(tab, generation.cards?.[0]), mergeGenerations);
          if (merged.length === existing.length && merged.every((generation, index) => generation === existing[index])) return {};
          // 后端返回最新在前，反转后放到数组头部（老的在前），reverse 展示时新内容仍排第一
          return {
            generationsByTab: {
              ...state.generationsByTab,
              [tab]: merged,
            },
          };
        }),

      // 第 1 页以服务端返回的最新一页为主体覆盖当前 tab，但保留本地仍在执行的任务。
      // 仅用于第 1 页加载完成。因为前面 hydrateHistoryFromCache 已从旧缓存写入旧数据，
      // 若此处再走 mergeHistoryGenerations，新内容会被前置到旧列表之后，
      // 经 display 的 reverse 后落到末尾（第二行第一个），排序错乱。
      // 刷新恢复任务与历史请求并行，不能让历史响应覆盖恢复出的 loading 占位卡。
      // 约定入参 generations 已是 store 顺序（越靠后越新）：调用方传入 normalized.reverse()。
      setHistoryPage1: (tab, generations) =>
        set((state) => {
          const existing = state.generationsByTab[tab] ?? [];
          const pendingGenerations = existing.filter((generation) =>
            generation.cards?.some((card) => card.status === 'loading')
          );
          return {
            generationsByTab: {
              ...state.generationsByTab,
              [tab]: [...generations, ...pendingGenerations],
            },
          };
        }),

      updateHistoryMeta: (tab, patch) =>
        set((state) => ({
          historyMeta: {
            ...state.historyMeta,
            [tab]: { ...state.historyMeta[tab], ...patch },
          },
        })),

      // 清空当前 tab 的创作历史展示：仅重置前端列表与分页，真正的「隐藏」由后端持久化。
      // 调用后页面会重新以 exclude_hidden=true 拉取，已隐藏记录不再返回。
      clearHistoryTab: (tab) =>
        set((state) => ({
          generationsByTab: {
            ...state.generationsByTab,
            [tab]: [],
          },
          historyMeta: {
            ...state.historyMeta,
            [tab]: { page: 0, hasMore: true, loading: false, initialized: false },
          },
        })),

      addGeneration: (tab, generation) =>
        set((state) => {
          const item = { ...generation, createdAt: generation.createdAt || new Date().toISOString() };
          const generations = dedupeByMediaAliases(
            [...(state.generationsByTab[tab] ?? []), item],
            (entry) => getHistoryDeduplicationAliases(tab, entry.cards?.[0]),
            mergeGenerations,
          );
          return {
            generationsByTab: {
              ...state.generationsByTab,
              [tab]: generations,
            },
          };
        }),

      updateCardIds: (tab, genId, cardIds) =>
        set((state) => ({
          generationsByTab: {
            ...state.generationsByTab,
            [tab]: state.generationsByTab[tab].map((gen) => {
              if (gen.id !== genId) return gen;
              return {
                ...gen,
                cards: gen.cards.map((c, i) =>
                  cardIds[i] ? { ...c, id: cardIds[i] } : c
                ),
              };
            }),
          },
        })),

      deleteCard: (tab, genId, cardIdx) =>
        set((state) => ({
          generationsByTab: {
            ...state.generationsByTab,
            [tab]: state.generationsByTab[tab]
              .map((gen) =>
                gen.id !== genId
                  ? gen
                  : { ...gen, cards: gen.cards.filter((_, i) => i !== cardIdx) }
              )
              .filter((gen) => gen.cards.length > 0),
          },
        })),

      deleteGeneration: (tab, genId) =>
        set((state) => ({
          generationsByTab: {
            ...state.generationsByTab,
            [tab]: state.generationsByTab[tab].filter((gen) => gen.id !== genId),
          },
        })),

      deleteSelectedCards: (tab, selectedSet) =>
        set((state) => {
          const toDelete = {};
          selectedSet.forEach((key) => {
            const lastDash = key.lastIndexOf('-');
            const genId = key.slice(0, lastDash);
            const cardIdx = parseInt(key.slice(lastDash + 1));
            if (!toDelete[genId]) toDelete[genId] = new Set();
            toDelete[genId].add(cardIdx);
          });
          return {
            generationsByTab: {
              ...state.generationsByTab,
              [tab]: state.generationsByTab[tab]
                .map((gen) => {
                  if (!toDelete[gen.id]) return gen;
                  return {
                    ...gen,
                    cards: gen.cards.filter((_, i) => !toDelete[gen.id].has(i)),
                  };
                })
                .filter((gen) => gen.cards.length > 0),
            },
          };
        }),

      // Sync favorites from backend history. Skips keys that have a pending
      // in-flight toggle so optimistic updates are never overwritten mid-flight.
      syncFavorites: (items) =>
        set((state) => {
          const next = new Set(state.favorites);
          for (const item of items) {
            if (state.pendingFavoriteToggles.has(item.key)) continue;
            if (item.isFavorite === true) next.add(item.key);
            else if (item.isFavorite === false) next.delete(item.key);
          }
          return { favorites: next };
        }),

      toggleFavorite: (cardKey) =>
        set((state) => {
          const next = new Set(state.favorites);
          if (next.has(cardKey)) next.delete(cardKey);
          else next.add(cardKey);
          const pending = new Set(state.pendingFavoriteToggles);
          pending.add(cardKey);
          return { favorites: next, pendingFavoriteToggles: pending };
        }),

      // Call after API succeeds — removes key from pending set
      confirmFavoriteToggle: (cardKey) =>
        set((state) => {
          const pending = new Set(state.pendingFavoriteToggles);
          pending.delete(cardKey);
          return { pendingFavoriteToggles: pending };
        }),

      // Call after API fails — reverts the toggle and removes from pending set
      rollbackFavoriteToggle: (cardKey) =>
        set((state) => {
          const next = new Set(state.favorites);
          if (next.has(cardKey)) next.delete(cardKey);
          else next.add(cardKey);
          const pending = new Set(state.pendingFavoriteToggles);
          pending.delete(cardKey);
          return { favorites: next, pendingFavoriteToggles: pending };
        }),
    }),
    {
      name: 'creation-store',
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const parsed = JSON.parse(str);
          return {
            ...parsed,
            state: {
              ...parsed.state,
              favorites: new Set(parsed.state?.favorites || []),
              pendingFavoriteToggles: new Set(),
            },
          };
        },
        setItem: (name, value) => {
          const toStore = {
            ...value,
            state: {
              ...value.state,
              favorites: [...value.state.favorites],
            },
          };
          localStorage.setItem(name, JSON.stringify(toStore));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
      partialize: (state) => ({
        // generationsByTab 不再持久化：现在由后端历史接口提供数据，localStorage 缓存会导致重复展示
        favorites: state.favorites,
      }),
      version: 2, // 升版本清除旧 localStorage 缓存（旧版持久化了 generationsByTab 导致数据叠加）
      migrate: (persistedState) => {
        // 版本不一致时直接返回初始值（旧 generationsByTab 缓存全部丢弃）
        return { favorites: persistedState?.favorites ?? [] };
      },
    }
  )
);
