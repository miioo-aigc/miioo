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
    setFilesState((previousFiles) => {
      const candidate = typeof updater === 'function' ? updater(previousFiles) : updater;
      if (!Array.isArray(candidate)) return previousFiles;
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
      filesRef.current = nextFiles;
      return nextFiles;
    });
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
    const clearFrame = (setter, ref, otherRef) => {
      setter((previousFile) => {
        if (previousFile && !preserved.has(previousFile)
          && !filesRef.current.includes(previousFile)
          && previousFile !== otherRef.current) {
          releaseBlobUrls(previousFile, releasedUrls);
        }
        ref.current = null;
        return null;
      });
    };
    clearFrame(setFirstFrameFileState, firstFrameFileRef, lastFrameFileRef);
    clearFrame(setLastFrameFileState, lastFrameFileRef, firstFrameFileRef);
  }, []);

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
    setter((previousFile) => {
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
      ref.current = nextFile;
      return nextFile;
    });
  }, [normalizeFiles]);

  const setFirstFrameFile = useCallback((updater) => {
    setFrameFile(setFirstFrameFileState, firstFrameFileRef, updater);
  }, [setFrameFile]);

  const setLastFrameFile = useCallback((updater) => {
    setFrameFile(setLastFrameFileState, lastFrameFileRef, updater);
  }, [setFrameFile]);

  const swapFrameFiles = useCallback(() => {
    const first = firstFrameFileRef.current;
    const last = lastFrameFileRef.current;
    firstFrameFileRef.current = last;
    lastFrameFileRef.current = first;
    setFirstFrameFileState(last);
    setLastFrameFileState(first);
  }, []);

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
    releaseFiles,
    swapFrameFiles,
  };
}
