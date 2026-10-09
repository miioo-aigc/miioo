import './ShimmerEffect.css';

/** Pure decorative overlay; its positioned parent owns loading semantics. */
export default function ShimmerEffect({ active = true, variant = 'surface' }) {
  if (!active) return null;
  return <div aria-hidden="true" className={`shimmer-effect shimmer-effect--${variant}`}><div className="shimmer-effect__light" /></div>;
}
