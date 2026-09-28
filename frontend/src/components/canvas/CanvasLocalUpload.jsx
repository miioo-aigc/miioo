/** 本地媒体入口：只生成临时预览，不上传；地址由组件生命周期回收。 */
import { useEffect, useRef, useState } from 'react';
import FileUploadButton from '../ui/FileUploadButton';
import { getCanvasMediaAccept, getCanvasMediaFileType } from './CanvasLocalMedia';

export default function CanvasLocalUpload({ nodeType, onAssetChange, hidden = false }) {
  const inputRef = useRef(null);
  const previewRef = useRef(null);
  const [error, setError] = useState('');
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  const handleChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const type = getCanvasMediaFileType(file, nodeType);
    if (!type) {
      setError(nodeType === 'audio' ? '请选择 MP3、WAV、M4A、AAC、OGG、FLAC、OPUS 或 AIFF 音频文件' : '请选择对应类型的非空文件');
      return;
    }
    const url = URL.createObjectURL(file);
    const previous = previewRef.current;
    previewRef.current = url;
    onAssetChange?.({ name: file.name, asset_type: type, url, source: 'local-preview' });
    if (previous) URL.revokeObjectURL(previous);
    setError('');
  };

  return <div hidden={hidden} className="canvas-node__local-upload">
    <FileUploadButton className="nodrag nopan" onClick={() => inputRef.current?.click()}>本地上传</FileUploadButton>
    <input ref={inputRef} type="file" hidden accept={getCanvasMediaAccept(nodeType === 'video' ? 'all' : nodeType)} onChange={handleChange} />
    {error && <span role="alert" className="canvas-node__upload-error">{error}</span>}
  </div>;
}
