export function renumberStoryboardShots(shots) {
  return shots.map((shot, index) => ({ ...shot, number: index + 1 }));
}

export function insertStoryboardShot(shots, index, shot) {
  return renumberStoryboardShots([
    ...shots.slice(0, index),
    shot,
    ...shots.slice(index),
  ]);
}

export function removeStoryboardShot(shots, id) {
  return renumberStoryboardShots(shots.filter((shot) => shot.id !== id));
}

export function moveStoryboardShot(shots, dragId, targetId) {
  if (!dragId || dragId === targetId) return shots;
  const dragIndex = shots.findIndex((shot) => shot.id === dragId);
  if (dragIndex === -1) return shots;

  const next = [...shots];
  const [dragged] = next.splice(dragIndex, 1);
  if (targetId === '__before_first') {
    next.unshift(dragged);
  } else if (targetId === '__after_last') {
    next.push(dragged);
  } else {
    const targetIndex = next.findIndex((shot) => shot.id === targetId);
    if (targetIndex === -1) return shots;
    next.splice(targetIndex, 0, dragged);
  }
  return renumberStoryboardShots(next);
}
