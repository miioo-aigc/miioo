export function mediaSpeed(segment) {
  const speed = Number(segment?.speed);
  return Number.isFinite(speed) && speed > 0 ? speed : 1;
}
export function mediaTime(window, cursor) {
  return Math.max(0, (Number(window.seg.offset) || 0) + (cursor - window.start) * mediaSpeed(window.seg));
}
export function timelineTime(window, time) {
  return window.start + (time - (Number(window.seg.offset) || 0)) / mediaSpeed(window.seg);
}

// A single coordinator owns commands; animation frames read, rather than seek, the master.
export class PreviewMediaClock {
  entries = new Map();
  master = null;
  lastCorrection = 0;

  register(key, element, window, audible, playing, cursor, onError) {
    const entry = { element, window, audible, playing, pending: false, failed: false, onError };
    this.entries.set(key, entry);
    if (!window?.seg.sourceUrl) { element.pause(); return () => this.remove(key, entry); }
    const changed = element.getAttribute('src') !== window.seg.sourceUrl;
    if (changed) { element.pause(); element.src = window.seg.sourceUrl; }
    element.playbackRate = mediaSpeed(window.seg);
    const position = () => {
      if (element.readyState < 1) return;
      const target = mediaTime(window, cursor());
      if (Math.abs(element.currentTime - target) > 0.02) element.currentTime = target;
    };
    const start = () => { if (playing) this.start(entry); };
    const loaded = () => { position(); start(); };
    const error = () => { entry.failed = true; element.pause(); onError?.(); };
    element.addEventListener('loadedmetadata', loaded);
    element.addEventListener('canplay', start);
    element.addEventListener('error', error);
    if (!changed) position();
    if (element.error) error();
    if (playing) { if (!changed) start(); } else element.pause();
    return () => {
      element.removeEventListener('loadedmetadata', loaded);
      element.removeEventListener('canplay', start);
      element.removeEventListener('error', error);
      this.remove(key, entry);
    };
  }

  remove(key, entry) {
    entry.playing = false;
    entry.element.pause();
    if (this.entries.get(key) === entry) this.entries.delete(key);
  }

  start(entry) {
    if (!entry.playing || entry.pending || entry.failed || entry.held || !entry.element.paused
      || entry.element.readyState < 2) return;
    entry.pending = true;
    entry.element.play().catch((error) => {
      if (error.name !== 'AbortError' && entry.playing) {
        entry.failed = true;
        entry.onError?.();
      }
    }).finally(() => { entry.pending = false; });
  }

  tick(cursor, dt, now, boundary) {
    const active = [...this.entries.values()].filter((entry) => entry.playing
      && entry.window?.seg.sourceUrl && cursor >= entry.window.start && cursor < entry.window.end);
    const master = active.find((entry) => entry.audible && entry.window.seg.type === 'audio')
      || active.find((entry) => entry.window.seg.type === 'video');
    if (!master) return Math.min(cursor + dt, boundary);
    if (this.master !== master) { this.master = master; this.lastCorrection = now; }
    master.held = false;
    const media = master.element;
    if (media.ended) return Math.min(master.window.end, boundary);
    if (media.seeking || media.readyState < 3 || media.paused || master.failed) {
      active.forEach((entry) => { if (entry !== master) { entry.held = true; entry.element.pause(); } });
      master.held = false;
      this.start(master);
      return cursor;
    }
    const next = timelineTime(master.window, media.currentTime);
    if (!Number.isFinite(next)) return cursor;
    // Exceptional jumps are corrected at most once a second, never on a buffer stall.
    if (next < cursor - 0.1 || next > cursor + Math.max(0.5, dt * 2)) {
      if (now - this.lastCorrection >= 1000) {
        media.currentTime = mediaTime(master.window, cursor);
        this.lastCorrection = now;
      }
      return cursor;
    }
    const target = Math.min(Math.max(cursor, next), boundary);
    const correct = now - this.lastCorrection >= 1000;
    active.forEach((entry) => {
      if (entry === master) return;
      entry.held = false;
      const follower = entry.element;
      if (correct && follower.readyState >= 2 && !follower.seeking
        && Math.abs(timelineTime(entry.window, follower.currentTime) - target) > 0.3) {
        follower.currentTime = mediaTime(entry.window, target);
      }
      this.start(entry);
    });
    if (correct) this.lastCorrection = now;
    return target;
  }
}
