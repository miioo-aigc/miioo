import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useCreationStore = create(
  persist(
    (set) => ({
      generationsByTab: { image: [], video: [], dubbing: [] },
      favorites: new Set(),
      // Keys currently being toggled (optimistic update in-flight); syncFavorites skips these
      pendingFavoriteToggles: new Set(),
      // 每个 tab 的历史分页状态（不持久化，每次启动重新拉）
      historyMeta: {
        image:   { page: 0, hasMore: true, loading: false, initialized: false },
        video:   { page: 0, hasMore: true, loading: false, initialized: false },
        dubbing: { page: 0, hasMore: true, loading: false, initialized: false },
      },

      // 合并历史数据（按卡片后端ID去重，避免重复）
      // store 约定：数组越靠后 = 越新（display 时 reverse 展示最新在前）
      // 历史数据后端返回最新在前，插入时需反转后前置，保证 reverse 后新内容仍排第一
      mergeHistoryGenerations: (tab, newGenerations) =>
        set((state) => {
          const existing = state.generationsByTab[tab] ?? [];
          const existingCardIds = new Set(
            existing.flatMap((g) => g.cards.map((c) => c.id).filter(Boolean))
          );
          const toAdd = newGenerations.filter((g) =>
            g.cards.every((c) => !c.id || !existingCardIds.has(c.id))
          );
          if (toAdd.length === 0) return {};
          // 后端返回最新在前，反转后放到数组头部（老的在前），reverse 展示时新内容仍排第一
          return {
            generationsByTab: {
              ...state.generationsByTab,
              [tab]: [...toAdd.reverse(), ...existing],
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

      addGeneration: (tab, generation) =>
        set((state) => ({
          generationsByTab: {
            ...state.generationsByTab,
            [tab]: [...state.generationsByTab[tab], {
              ...generation,
              createdAt: generation.createdAt || new Date().toISOString(),
            }],
          },
        })),

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
      migrate: (persistedState, version) => {
        // 版本不一致时直接返回初始值（旧 generationsByTab 缓存全部丢弃）
        return { favorites: persistedState?.favorites ?? [] };
      },
    }
  )
);
