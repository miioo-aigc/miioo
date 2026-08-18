import { useLayoutEffect, useRef, useState } from 'react';

const EXPAND_TRANSITION = 'width 500ms cubic-bezier(0.22, 1, 0.36, 1), height 500ms cubic-bezier(0.22, 1, 0.36, 1)';

export default function CreationInputDock({ expanded, collapsedWidth, children, zIndex }) {
  const contentRef = useRef(null);
  const [collapsedHeight, setCollapsedHeight] = useState(null);

  useLayoutEffect(() => {
    if (expanded || !contentRef.current) return undefined;

    const updateCollapsedHeight = () => {
      const nextHeight = contentRef.current?.getBoundingClientRect().height;
      if (nextHeight) setCollapsedHeight(nextHeight);
    };

    updateCollapsedHeight();
    const observer = new ResizeObserver(updateCollapsedHeight);
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [expanded]);

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: '16px',
        translate: '-50% 0',
        width: expanded ? 'calc(100% - 32px)' : collapsedWidth,
        height: expanded ? 'calc(100% - 32px)' : (collapsedHeight ? `${collapsedHeight}px` : 'auto'),
        transition: collapsedHeight ? EXPAND_TRANSITION : 'none',
        willChange: expanded ? 'width, height' : 'auto',
        zIndex,
      }}
    >
      <div ref={contentRef} style={{ width: '100%', height: expanded ? '100%' : 'auto' }}>
        {children}
      </div>
    </div>
  );
}
