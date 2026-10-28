export function selectionIds(state) {
  return state.selectedIds.length ? state.selectedIds : state.selectedId ? [state.selectedId] : [];
}

export function intersectsSelection(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export function commonClipActions(state, windows) {
  const ids = selectionIds(state);
  const selected = ids.map((id) => state.segments.find((seg) => seg.id === id));
  if (!selected.length || selected.some((seg) => !seg || seg.type === 'subtitle')) return [];
  const actions = [];
  const inside = selected.every((seg) => {
    const window = windows.find((item) => item.seg.id === seg.id);
    return window && state.cursor > window.start && state.cursor < window.end;
  });
  if (inside) actions.push('split', 'trimLeft', 'trimRight');
  if (selected.every((seg) => seg.type === 'video' && !state.hasDetachedAudio(seg.id))) actions.push('detach');
  if (selected.every((seg) => ['video', 'audio'].includes(seg.type))) actions.push('speed');
  if (selected.every((seg) => seg.type === 'audio')) actions.push('volume');
  actions.push('delete');
  return actions;
}
