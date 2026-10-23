/** 本地媒体入口：临时地址交由画布历史持有，退出画布时回收。 */
import { useRef, useState } from 'react';
import FileUploadButton from '../ui/FileUploadButton';
import { getCanvasMediaAccept, getCanvasMediaFileType } from './CanvasLocalMedia';

export default function CanvasLocalUpload({ nodeType, onAssetChange, hidden = false }) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');

  const handleChange = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    if (files.some((file) => !getCanvasMediaFileType(file, nodeType))) {
      setError(nodeType === 'audio' ? '请选择 MP3、WAV、M4A、AAC、OGG、FLAC、OPUS 或 AIFF 音频文件' : '请选择对应类型的非空文件');
      return;
    }
    const assets = files.map((file) => ({ file, name: file.name, asset_type: getCanvasMediaFileType(file, nodeType), url: URL.createObjectURL(file), source: 'local-upload', uploadStatus: 'uploading' }));
    if (!onAssetChange || await onAssetChange(assets) === false) assets.forEach((asset) => URL.revokeObjectURL(asset.url));
    setError('');
  };

  return <div hidden={hidden} className="canvas-node__local-upload">
    <FileUploadButton className="nodrag nopan" onClick={() => inputRef.current?.click()}>本地上传</FileUploadButton>
    <input ref={inputRef} type="file" multiple hidden accept={getCanvasMediaAccept(nodeType === 'video' ? 'all' : nodeType)} onChange={handleChange} />
    {error && <span role="alert" className="canvas-node__upload-error">{error}</span>}
  </div>;
}
