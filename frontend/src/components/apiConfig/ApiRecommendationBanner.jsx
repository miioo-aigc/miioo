import { useEffect, useState } from 'react';
import { DotOrbit, GrainGradient } from '@paper-design/shaders-react';
import customerServiceQr from '../../assets/onelink-customer-service-qr.svg';
import './ApiRecommendationBanner.css';

const layerStyle = { position: 'absolute', inset: 0, width: '100%', height: '100%' };
const OFFICIAL_URL = 'https://www.onelinkai.cloud/';

/** Paper 推荐横幅：内容和二维码本地打包，不依赖运营 banner 接口。 */
export default function ApiRecommendationBanner() {
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return <section className="api-recommendation-banner" aria-label="OneLinkAI 推荐">
    <div className="api-recommendation-banner__background" aria-hidden="true">
      <GrainGradient speed={reducedMotion ? 0 : 1} scale={1} rotation={0} offsetX={1} offsetY={0}
        softness={1} intensity={0.09} noise={0} shape="wave" frame={7837754.347002896}
        colors={['#2218E0', '#2B17E6', '#668BE8', '#98E1FF']} colorBack="#00000000" style={layerStyle} />
      <DotOrbit scale={0.16} size={0.6} sizeRange={0.6} spreading={0.18} speed={reducedMotion ? 0 : 1}
        stepsPerColor={1} frame={7222974.438006232} colors={['#00C9FF']} colorBack="#00000000"
        style={{ ...layerStyle, mixBlendMode: 'saturation' }} />
      <div className="api-recommendation-banner__scrim" />
    </div>
    <div className="api-recommendation-banner__copy">
      <div className="api-recommendation-banner__title">推荐使用<a href={OFFICIAL_URL} target="_blank" rel="noopener noreferrer">OneLinkAI API<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: 4 }}>
        <path d="M6.33337 3.66663H12.3334V9.66663" strokeLinecap="round" strokeLinejoin="round" stroke="white" />
        <path d="M3.84802 12.1519L12.3333 3.66663" strokeLinecap="round" strokeLinejoin="round" stroke="white" />
      </svg></a></div>
      <div className="api-recommendation-banner__description">
        <div className="api-recommendation-banner__models">
          <span>集合</span>
          {['Seedance', 'Kling', 'HappyHorse'].map(model => <span key={model} className="api-recommendation-banner__tag api-recommendation-banner__model">{model}</span>)}
          <span>等多种热门模型，价格优惠，连接稳定。</span>
        </div>
        <div className="api-recommendation-banner__benefit">
          <span>添加客服，解锁新人</span><span className="api-recommendation-banner__tag">免费试用</span><span>福利。</span>
        </div>
      </div>
    </div>
    <img className="api-recommendation-banner__qr" src={customerServiceQr} alt="OneLinkAI 客服二维码" width="76" height="76" draggable="false" />
  </section>;
}
