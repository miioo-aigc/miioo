let activeAudio = null;
let activePreviewKey = "";
const listeners = new Set();

function emitActivePreviewKey() {
  listeners.forEach((listener) => {
    try {
      listener(activePreviewKey);
    } catch (error) {
      console.error("voice preview listener failed:", error);
    }
  });
}

function clearActivePreview(audioInstance) {
  if (audioInstance && activeAudio !== audioInstance) return;

  if (activeAudio) {
    activeAudio.pause();
    activeAudio.onended = null;
    activeAudio.onerror = null;
    activeAudio.removeAttribute("src");
    activeAudio.load();
  }

  activeAudio = null;
  activePreviewKey = "";
  emitActivePreviewKey();
}

export function getActiveVoicePreviewKey() {
  return activePreviewKey;
}

export function subscribeVoicePreview(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function stopVoicePreview(targetKey) {
  if (targetKey && activePreviewKey !== targetKey) return false;
  if (!activeAudio) return false;

  const audioToStop = activeAudio;
  clearActivePreview(audioToStop);
  return true;
}

export async function toggleVoicePreview({ key, url }) {
  if (!key || !url) return false;

  if (activePreviewKey === key) {
    stopVoicePreview(key);
    return false;
  }

  stopVoicePreview();

  const audio = new Audio(url);
  activeAudio = audio;
  activePreviewKey = key;
  emitActivePreviewKey();

  const handleFinish = () => clearActivePreview(audio);
  audio.onended = handleFinish;
  audio.onerror = handleFinish;

  try {
    await audio.play();
    return true;
  } catch (error) {
    clearActivePreview(audio);
    throw error;
  }
}
