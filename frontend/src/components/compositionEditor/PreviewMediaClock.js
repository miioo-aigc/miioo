import { adoptAudioCursor, audioTargetTime, audioTimelineTime, speedOf } from './PreviewAudioClock.js';

export const mediaSpeed = speedOf;
export function mediaTime(window, cursor) {
  return audioTargetTime({ seg: window.seg, windowStart: window.start, cursor });
}
export function timelineTime(window, time) {
  return audioTimelineTime({ seg: window.seg, windowStart: window.start, mediaTime: time });
}

// A single coordinator owns commands; animation frames read, rather than seek, the master.
export class PreviewMediaClock {
  entries = new Map();
  master = null;
  lastMediaTime = null;
  lastCorrection = -Infinity;
  blocked = false;
  externalBlocked = false;
  required = [];

  require(keys) { this.required = keys; }

  setBlocked(value) {
    this.externalBlocked = value;
    if (value) {
      this.blocked = true;
      this.entries.forEach((entry) => entry.element.pause());
    }
  }

  register(key, element, window, audible, playing, cursor, onError) {
    const entry = { element, window, audible, playing, pending: false, failed: false, cold: true, onError };
    this.entries.set(key, entry);
    if (!window?.seg.sourceUrl) { element.pause(); return () => this.remove(key, entry); }
    const changed = element.getAttribute('src') !== window.seg.sourceUrl;
    if (changed) { element.pause(); element.src = window.seg.sourceUrl; }
    entry.cold = changed || element.paused;
    element.playbackRate = mediaSpeed(window.seg);
    const position = () => {
      if (element.readyState < 1) return;
      const target = mediaTime(window, cursor());
      if (Math.abs(element.currentTime - target) > (playing ? 0.3 : 0.05)) element.currentTime = target;
    };
    const start = () => { if (playing) this.start(entry); };
    const loaded = () => { position(); start(); };
    const canPlay = () => {
      if (playing && !this.blocked && element.paused) { position(); start(); }
    };
    let recovering = false;
    const waiting = () => { recovering = true; };
    const didPlay = () => {
      if (recovering) { recovering = false; position(); }
      entry.cold = false;
    };
    const error = () => { entry.failed = true; element.pause(); onError?.(); };
    element.addEventListener('loadedmetadata', loaded);
    element.addEventListener('canplay', canPlay);
    element.addEventListener('error', error);
    element.addEventListener('playing', didPlay);
    element.addEventListener('waiting', waiting);
    if (!changed) position();
    if (element.error) error();
    if (playing) { if (!changed) start(); } else element.pause();
    return () => {
      element.removeEventListener('loadedmetadata', loaded);
      element.removeEventListener('canplay', canPlay);
      element.removeEventListener('error', error);
      element.removeEventListener('playing', didPlay);
      element.removeEventListener('waiting', waiting);
      this.remove(key, entry);
    };
  }

  remove(key, entry) {
    entry.playing = false;
    entry.element.pause();
    if (this.entries.get(key) === entry) this.entries.delete(key);
  }

  start(entry) {
    if (this.blocked || !entry.playing || entry.pending || entry.failed || entry.element.ended || !entry.element.paused
      || entry.element.readyState < 3) return;
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
    // 自然结束是完成状态，不是缓冲；不能再次 play，否则浏览器从头重播。
    const unfinished = active.filter((entry) => !entry.element.ended);
    const master = unfinished.find((entry) => entry.audible && entry.window.seg.type === 'audio')
      || unfinished.find((entry) => entry.window.seg.type === 'video');
    const wallNext = Math.min(cursor + Math.max(0, dt), boundary);
    if (this.master !== master) {
      this.master = master;
      this.lastMediaTime = null;
      this.lastCorrection = -Infinity;
    }
    if (this.externalBlocked || this.required.some((key) => !this.entries.get(key)?.window?.seg.sourceUrl)) {
      active.forEach((entry) => entry.element.pause());
      this.blocked = true;
      this.lastMediaTime = null;
      return cursor;
    }
    const allReady = active.every((entry) => !entry.failed && (entry.element.ended || (!entry.element.seeking && entry.element.readyState >= 3)));
    if (!allReady) {
      this.blocked = true;
      active.forEach((entry) => entry.element.pause());
      this.lastMediaTime = null;
      return cursor;
    }
    if (this.blocked) {
      this.blocked = false;
      unfinished.forEach((entry) => {
        const target = mediaTime(entry.window, cursor);
        if (entry.element.readyState >= 1 && Math.abs(entry.element.currentTime - target) > 0.05) entry.element.currentTime = target;
        this.start(entry);
      });
    }
    active.forEach((entry) => this.start(entry));
    if (!master) return wallNext;
    const media = master.element;
    const healthy = !master.cold && !master.failed && !media.seeking
      && !media.paused && !media.ended && media.readyState >= 3
      && media.getAttribute('src') === master.window.seg.sourceUrl;
    // 主媒体等待时钟冻结；所有活跃媒体均可解码后才恢复。
    if (!healthy) {
      this.lastMediaTime = null;
      return cursor;
    }
    const result = adoptAudioCursor({
      prevCursor: cursor, prevMediaTime: this.lastMediaTime, mediaTime: media.currentTime,
      seg: master.window.seg, windowStart: master.window.start, dt,
    });
    this.lastMediaTime = media.currentTime;
    // seeking 门控未完成的定位；异常媒体持续返回旧时间时最多每秒纠偏一次。
    if (result.resyncTo != null && now - this.lastCorrection >= 1000) {
      media.currentTime = result.resyncTo;
      this.lastMediaTime = null;
      this.lastCorrection = now;
    }
    return Math.min(result.next, boundary);
  }
}
