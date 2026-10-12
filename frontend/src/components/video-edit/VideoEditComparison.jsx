import { useState } from 'react';
import LoadingAnimation from '../LoadingAnimation';
import DotsLoading from '../DotsLoading';
import Button from '../ui/Button';
import '../image-edit/ImageEditComparison.css';
import './VideoEditComparison.css';

function ResultVideo({ url }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return <>
    {!failed && <video key={attempt} src={url} controls muted playsInline preload="auto" aria-label="生成结果视频"
      onLoadedData={() => setLoaded(true)} onError={() => setFailed(true)} />}
    {!failed && !loaded && <div className="edit-comparison-message video-result-loading" role="status" aria-label="视频加载中"><DotsLoading /></div>}
    {failed && <div className="edit-comparison-message" role="alert">视频加载失败<Button size="small" onClick={() => { setFailed(false); setLoaded(false); setAttempt((value) => value + 1); }}>重新加载</Button></div>}
  </>;
}

export default function VideoEditComparison({ children, submission, onRetry }) {
  const { active, busy, result, error, pending } = submission;
  return <div className={`edit-comparison video-edit-comparison${active ? ' is-active' : ''}`}>
    <div className="edit-comparison-source">
      {children}
      {active && <span className="edit-comparison-label">原视频</span>}
    </div>
    <div className="edit-comparison-result" inert={!active} aria-hidden={!active}>
      {result?.video_url && !busy && !error && <ResultVideo key={result.video_url} url={result.video_url} />}
      <span className="edit-comparison-label">生成结果</span>
      {busy && <div className="edit-comparison-message is-overlay" role="status" aria-label="生成处理中"><LoadingAnimation width={88} /></div>}
      {!busy && error && <div className="edit-comparison-message is-overlay" role="alert"><span>{error}</span>
        {pending?.accepted && <Button size="small" onClick={onRetry}>继续读取结果</Button>}
      </div>}
    </div>
  </div>;
}
