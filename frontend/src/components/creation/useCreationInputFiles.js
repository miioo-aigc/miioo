import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MAX_CREATION_FILES,
  MAX_CREATION_IMAGE_BYTES,
  appendFilesWithinLimit,
  getModelReferenceLimits,
  getReferenceLimitLabels,
  isFileOverLimit,
  isImageFile,
  isVideoFile,
  trimFilesToModelReferenceLimits,
} from './CreationFileUtils';

function makeFileUid() {
  return `file-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function releaseBlobUrls(file, releasedUrls = new Set()) {
  [file?._objectUrl, file?.previewUrl]
    .filter((url) => typeof url === 'string' && url.startsWith('blob:'))
    .forEach((url) => {
      if (releasedUrls.has(url)) return;
      URL.revokeObjectURL(url);
      releasedUrls.add(url);
    });
}

function enrichLocalFile(file) {
  if (isImageFile(file) && !file.previewUrl) {
    const previewUrl = URL.createObjectURL(file);
    Object.defineProperty(file, 'previewUrl', { value: previewUrl, writable: true });
  } else if (isVideoFile(file) && !file._objectUrl) {
    const objectUrl = URL.createObjectURL(file);
    Object.defineProperty(file, '_objectUrl', { value: objectUrl, writable: true });
  }
  return file;
}

/**
 * 创作输入区的素材状态边界。
 *
 * 负责文件列表、首尾帧、模型素材上限和本地 Blob URL 生命周期；
 * 不负责提示词 DOM、资产字段适配、生成请求或业务 Store。
 */
export function useCreationInputFiles({
  model,
  refMode,
  capabilitiesMap = {},
  onToast,
  onFileTooLarge,
}) {
  const [files, setFilesState] = useState([]);
  const [firstFrameFile, setFirstFrameFileState] = useState(null);
  const [lastFrameFile, setLastFrameFileState] = useState(null);

  const onToastRef = useRef(onToast);
  const pendingToastRef = useRef(null);
  const trimmedToastRef = useRef(null);
  const filesRef = useRef([]);
  const firstFrameFileRef = useRef(null);
  const lastFrameFileRef = useRef(null);

  useEffect(() => {
    onToastRef.current = onToast;
  }, [onToast]);

  const currentCap = useMemo(
    () => getModelReferenceLimits(capabilitiesMap, model) || {},
    [capabilitiesMap, model],
  );

  const normalizeFiles = useCallback((nextFiles) => nextFiles.map((file) => {
    const nextFile = typeof File !== 'undefined' && file instanceof File ? enrichLocalFile(file) : file;
    if (nextFile && !nextFile._uid) {
      // 不展开原生 File，否则会丢失 name/type 等原型字段，提交时会变成普通对象。
      Object.defineProperty(nextFile, '_uid', {
        value: makeFileUid(),
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
    return nextFile;
  }), []);

  const setFiles = useCallback((updater) => {
    const previousFiles = filesRef.current;
    const candidate = typeof updater === 'function' ? updater(previousFiles) : updater;
    if (!Array.isArray(candidate)) return;
    const nextFiles = normalizeFiles(candidate);
    const releasedUrls = new Set();
    const protectedFiles = new Set(
      [firstFrameFileRef.current, lastFrameFileRef.current].filter(Boolean),
    );
    previousFiles.forEach((file) => {
      if (!nextFiles.includes(file) && !protectedFiles.has(file)) {
        releaseBlobUrls(file, releasedUrls);
      }
    });
    // 草稿保存可能在 React 批处理渲染前触发，ref 必须先于 setState 写入最新文件。
    filesRef.current = nextFiles;
    setFilesState(nextFiles);
  }, [normalizeFiles]);

  const replaceFiles = useCallback((nextFiles) => {
    setFiles(nextFiles);
  }, [setFiles]);

  const clearFiles = useCallback(({ preserveFiles = [] } = {}) => {
    const preserved = new Set([
      ...preserveFiles,
      firstFrameFileRef.current,
      lastFrameFileRef.current,
    ].filter(Boolean));
    const releasedUrls = new Set();
    setFilesState((previousFiles) => {
      previousFiles.forEach((file) => {
        if (!preserved.has(file)) releaseBlobUrls(file, releasedUrls);
      });
      filesRef.current = [];
      return [];
    });
  }, []);

  const clearFrameFiles = useCallback(({ preserveFiles = [] } = {}) => {
    const preserved = new Set(preserveFiles);
    const releasedUrls = new Set();
    const frameFiles = [firstFrameFileRef.current, lastFrameFileRef.current]
      .filter(Boolean);
    frameFiles.forEach((file) => {
      if (!preserved.has(file) && !filesRef.current.includes(file)) {
        releaseBlobUrls(file, releasedUrls);
      }
    });
    // 先同步清空 ref，再提交状态。高频切换时，不能让旧的函数式更新回调
    // 在后续回填首尾帧之后才执行，从而把新图片再次清空。
    firstFrameFileRef.current = null;
    lastFrameFileRef.current = null;
    setFirstFrameFileState(null);
    setLastFrameFileState(null);
  }, []);

  const moveFrameFilesToFiles = useCallback(() => {
    const frameFiles = [firstFrameFileRef.current, lastFrameFileRef.current].filter(Boolean);
    if (frameFiles.length === 0) return true;

    const existingFiles = filesRef.current;
    const seen = new Set(existingFiles.map((file) => file?._uid || file?.assetId || file?.url || file?.previewUrl).filter(Boolean));
    const additions = frameFiles.filter((file) => {
      const identity = file?._uid || file?.assetId || file?.url || file?.previewUrl;
      if (!identity || seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
    // 首帧、尾帧排在普通素材列表最前，保证再次切回时恢复同一组图片和原始顺序。
    const mergedFiles = [...additions, ...existingFiles];
    const rejectedLabels = getReferenceLimitLabels(mergedFiles, currentCap, existingFiles);
    if (rejectedLabels.length > 0) {
      onToastRef.current?.('warning', `${rejectedLabels.join('、')}已达该模型的上限，无法切换参考模式`);
      return false;
    }
    if (mergedFiles.length > MAX_CREATION_FILES) {
      onToastRef.current?.('warning', `参考素材最多支持${MAX_CREATION_FILES}个，无法切换参考模式`);
      return false;
    }

    setFiles(mergedFiles);
    clearFrameFiles({ preserveFiles: mergedFiles });
    return true;
  }, [clearFrameFiles, currentCap, setFiles]);

  const releaseFiles = useCallback((filesToRelease = []) => {
    const releasedUrls = new Set();
    filesToRelease.filter(Boolean).forEach((file) => {
      [file._objectUrl, file.previewUrl]
        .filter((url) => typeof url === 'string' && url.startsWith('blob:'))
        .forEach((url) => {
          if (releasedUrls.has(url)) return;
          URL.revokeObjectURL(url);
          releasedUrls.add(url);
        });
    });
  }, []);

  const setFrameFile = useCallback((setter, ref, updater) => {
    const previousFile = ref.current;
    const candidate = typeof updater === 'function' ? updater(previousFile) : updater;
    const nextFile = candidate ? normalizeFiles([candidate])[0] : null;
    const otherFrameFile = ref === firstFrameFileRef
      ? lastFrameFileRef.current
      : firstFrameFileRef.current;
    if (previousFile && previousFile !== nextFile
      && !filesRef.current.includes(previousFile)
      && previousFile !== otherFrameFile
      && previousFile !== nextFile) {
      releaseBlobUrls(previousFile);
    }
    // 与普通参考图一致，先更新 ref 再触发渲染，确保立即切换 Tab 时首尾帧不会漏存。
    ref.current = nextFile;
    setter(nextFile);
  }, [normalizeFiles]);

  const setFirstFrameFile = useCallback((updater) => {
    setFrameFile(setFirstFrameFileState, firstFrameFileRef, updater);
  }, [setFrameFile]);

  const setLastFrameFile = useCallback((updater) => {
    setFrameFile(setLastFrameFileState, lastFrameFileRef, updater);
  }, [setFrameFile]);

  const moveFilesToFrameFiles = useCallback(() => {
    const imageFiles = filesRef.current.filter(isImageFile);
    if (imageFiles.length === 0) return true;

    const emptySlots = [];
    if (!firstFrameFileRef.current) emptySlots.push(setFirstFrameFile);
    if (!lastFrameFileRef.current) emptySlots.push(setLastFrameFile);
    const filesToMove = imageFiles.slice(0, emptySlots.length);
    filesToMove.forEach((file, index) => emptySlots[index](file));
    setFiles((previousFiles) => previousFiles.filter((file) => !filesToMove.includes(file)));
    return true;
  }, [setFiles, setFirstFrameFile, setLastFrameFile]);

  const swapFrameFiles = useCallback(() => {
    const first = firstFrameFileRef.current;
    const last = lastFrameFileRef.current;
    firstFrameFileRef.current = last;
    lastFrameFileRef.current = first;
    setFirstFrameFileState(last);
    setLastFrameFileState(first);
  }, []);

  // 草稿保存读取同步 ref，避免 React 状态批处理期间读取到上一帧的素材列表。
  const getCurrentFiles = useCallback(() => ({
    files: filesRef.current,
    firstFrameFile: firstFrameFileRef.current,
    lastFrameFile: lastFrameFileRef.current,
  }), []);

  const safeSetFiles = useCallback((updater) => {
    setFiles((previousFiles) => {
      const nextFiles = typeof updater === 'function' ? updater(previousFiles) : updater;
      if (!Array.isArray(nextFiles) || nextFiles.length <= previousFiles.length) return nextFiles;

      const rejectedLabels = getReferenceLimitLabels(nextFiles, currentCap, previousFiles);
      if (rejectedLabels.length > 0) {
        pendingToastRef.current = `warning:${rejectedLabels.join('、')}已达该模型的上限，无法继续添加`;
        return previousFiles;
      }
      return nextFiles;
    });
  }, [currentCap, setFiles]);

  const appendFiles = useCallback((additions) => {
    if (!Array.isArray(additions) || additions.length === 0) return;
    safeSetFiles((previousFiles) => appendFilesWithinLimit(previousFiles, additions, MAX_CREATION_FILES));
  }, [safeSetFiles]);

  const handleFileSelect = useCallback((newFiles = []) => {
    const selectedFiles = Array.from(newFiles);
    const oversized = selectedFiles.filter((file) => isImageFile(file) && isFileOverLimit(file, MAX_CREATION_IMAGE_BYTES));
    if (oversized.length > 0) {
      onFileTooLarge?.();
      return;
    }

    const enrichedFiles = selectedFiles.map(enrichLocalFile);
    appendFiles(enrichedFiles);
  }, [appendFiles, onFileTooLarge]);

  const removeFile = useCallback((index) => {
    setFiles((previousFiles) => previousFiles.filter((_, fileIndex) => fileIndex !== index));
  }, [setFiles]);

  useEffect(() => {
    const modelCap = getModelReferenceLimits(capabilitiesMap, model);
    if (!modelCap) return undefined;

    const timer = setTimeout(() => {
      setFiles((previousFiles) => {
        const nextFiles = trimFilesToModelReferenceLimits(previousFiles, modelCap);
        if (nextFiles.length !== previousFiles.length) {
          trimmedToastRef.current = '已切换模型，多余的参考素材已自动移除';
        }
        return nextFiles;
      });
    }, 0);

    return () => clearTimeout(timer);
  }, [capabilitiesMap, model, setFiles]);

  useEffect(() => {
    if (!pendingToastRef.current) return undefined;
    const message = pendingToastRef.current;
    pendingToastRef.current = null;
    const timer = setTimeout(() => {
      const [type, ...rest] = message.split(':');
      onToastRef.current?.(type, rest.join(':'));
    }, 0);
    return () => clearTimeout(timer);
  });

  useEffect(() => {
    if (!trimmedToastRef.current) return undefined;
    const message = trimmedToastRef.current;
    trimmedToastRef.current = null;
    const timer = setTimeout(() => onToastRef.current?.('info', message), 0);
    return () => clearTimeout(timer);
  });

  useEffect(() => {
    if (refMode === 'frame') return undefined;
    const timer = setTimeout(() => {
      clearFrameFiles();
    }, 0);
    return () => clearTimeout(timer);
  }, [clearFrameFiles, refMode]);

  useEffect(() => () => {
    const released = new Set();
    [...filesRef.current, firstFrameFileRef.current, lastFrameFileRef.current]
      .filter(Boolean)
      .forEach((file) => {
        if (file._objectUrl && !released.has(file._objectUrl)) {
          URL.revokeObjectURL(file._objectUrl);
          released.add(file._objectUrl);
        }
        if (file.previewUrl?.startsWith('blob:') && !released.has(file.previewUrl)) {
          URL.revokeObjectURL(file.previewUrl);
          released.add(file.previewUrl);
        }
      });
  }, []);

  return {
    files,
    setFiles,
    replaceFiles,
    firstFrameFile,
    setFirstFrameFile,
    lastFrameFile,
    setLastFrameFile,
    safeSetFiles,
    appendFiles,
    handleFileSelect,
    removeFile,
    clearFiles,
    clearFrameFiles,
    moveFrameFilesToFiles,
    moveFilesToFrameFiles,
    releaseFiles,
    swapFrameFiles,
    getCurrentFiles,
  };
}
