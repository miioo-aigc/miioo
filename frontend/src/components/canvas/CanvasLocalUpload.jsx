/** 本地媒体入口：临时地址交由画布历史持有，退出画布时回收。 */
import { useRef, useState } from 'react';
import FileUploadButton from '../ui/FileUploadButton';
import { getCanvasMediaAccept, getCanvasMediaFileType } from './CanvasLocalMedia';

export default function CanvasLocalUpload({ nodeType, onAssetChange, hidden = false }) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');

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
    onAssetChange?.({ name: file.name, asset_type: type, url, source: 'local-preview' });
    setError('');
  };

  return <div hidden={hidden} className="canvas-node__local-upload">
    <FileUploadButton className="nodrag nopan" onClick={() => inputRef.current?.click()}>本地上传</FileUploadButton>
    <input ref={inputRef} type="file" hidden accept={getCanvasMediaAccept(nodeType === 'video' ? 'all' : nodeType)} onChange={handleChange} />
    {error && <span role="alert" className="canvas-node__upload-error">{error}</span>}
  </div>;
}
