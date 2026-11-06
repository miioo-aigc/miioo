/** 本地媒体入口：临时地址交由画布历史持有，退出画布时回收。 */
import { useEffect, useRef, useState } from 'react';
import FileUploadButton from '../ui/FileUploadButton';
import { getCanvasMediaAccept, getCanvasMediaFileType } from './CanvasLocalMedia';

export default function CanvasLocalUpload({ nodeType, onAssetChange, hidden = false, disabled = false, trigger = true, multiple = true, purpose, inputElementRef }) {
  const inputRef = useRef(null);
  const latest = useRef({ disabled, nodeType, onAssetChange, purpose, multiple });
  useEffect(() => { latest.current = { disabled, nodeType, onAssetChange, purpose, multiple }; });
  const [error, setError] = useState('');

  const handleChange = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    const current = latest.current;
    const fileTypes = files.map((file) => getCanvasMediaFileType(file, current.nodeType));
    if (current.disabled || (!current.multiple && files.length > 1)
      || fileTypes.some((type) => !type || (current.purpose === 'replace' && type !== current.nodeType))) {
      setError(current.nodeType === 'audio' ? '请选择 MP3、WAV、M4A、AAC、OGG、FLAC、OPUS 或 AIFF 音频文件' : '请选择对应类型的非空文件');
      return;
    }
    const assets = files.map((file, index) => ({ file, name: file.name, asset_type: fileTypes[index], url: URL.createObjectURL(file), source: 'local-upload', uploadStatus: 'uploading' }));
    let accepted = false;
    try {
      accepted = Boolean(current.onAssetChange && await current.onAssetChange(assets, current.purpose) !== false);
    } finally {
      if (!accepted || current.purpose === 'replace') assets.forEach((asset) => URL.revokeObjectURL(asset.url));
    }
    setError('');
  };

  return <div hidden={hidden} className="canvas-node__local-upload">
    {trigger && <FileUploadButton className="nodrag nopan" disabled={disabled} onClick={() => inputRef.current?.click()}>本地上传</FileUploadButton>}
    <input ref={element => { inputRef.current = element; if (inputElementRef) inputElementRef.current = element; }} type="file" multiple={multiple} hidden accept={getCanvasMediaAccept(nodeType === 'video' && purpose !== 'replace' ? 'all' : nodeType)} onChange={handleChange} />
    {error && <span role="alert" className="canvas-node__upload-error">{error}</span>}
  </div>;
}
