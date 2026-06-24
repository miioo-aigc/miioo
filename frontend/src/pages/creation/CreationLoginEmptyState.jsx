import { memo } from 'react';
import { FONT } from '../../utils/fonts';

function CreationLoginEmptyState({ onLoginClick }) {
  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'stretch',
        gap: '12px',
      }}
    >
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="cli-bg" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" stopOpacity="0.12" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id="cli-stroke" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" stopOpacity="0.24" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="cli-icon" x1="18" y1="20" x2="46" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#B7C0CC" />
          </linearGradient>
        </defs>
        <rect x="4" y="4" width="56" height="56" rx="28" fill="url(#cli-bg)" />
        <rect x="4.5" y="4.5" width="55" height="55" rx="27.5" stroke="url(#cli-stroke)" />
        <path d="M32 22C28.686 22 26 24.686 26 28C26 31.314 28.686 34 32 34C35.314 34 38 31.314 38 28C38 24.686 35.314 22 32 22Z" stroke="url(#cli-icon)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M22 42C22 38.134 26.477 35 32 35C37.523 35 42 38.134 42 42" stroke="url(#cli-icon)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <div
        style={{
          fontFamily: FONT,
          fontSize: '14px',
          lineHeight: '20px',
          color: 'rgba(255,255,255,0.4)',
          textAlign: 'center',
        }}
      >
        请先{' '}
        <button
          type="button"
          onClick={onLoginClick}
          style={{
            padding: 0,
            margin: 0,
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
            fontFamily: FONT,
            fontSize: '14px',
            lineHeight: '20px',
            color: '#2DC3E1',
          }}
        >
          登录
        </button>
      </div>
    </div>
  );
}

export default memo(CreationLoginEmptyState);
