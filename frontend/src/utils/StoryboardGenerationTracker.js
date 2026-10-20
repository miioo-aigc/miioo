// Each task owns one token; finishing it must not clear another task's indicator.
export function createStoryboardGenerationTracker(setters) {
  const tasks = { image: new Map(), video: new Map() };
  return (type, shotId, token = Symbol()) => {
    const shots = tasks[type];
    const tokens = shots.get(shotId) ?? new Set();
    tokens.add(token);
    shots.set(shotId, tokens);
    setters[type]((prev) => new Set([...prev, shotId]));
    let finished = false;
    return () => {
      if (finished) return;
      finished = true;
      tokens.delete(token);
      if (tokens.size > 0) return;
      shots.delete(shotId);
      setters[type]((prev) => {
        const next = new Set(prev);
        next.delete(shotId);
        return next;
      });
    };
  };
}
