import GhostButton from '../../components/GhostButton';
import { FONT } from '../../utils/fonts';

export default function BatchActionBtn({ children, onClick }) {
  return (
    <GhostButton onClick={onClick}>
      <span style={{ fontFamily: FONT, fontSize: '14px', color: 'rgba(255,255,255,0.8)', whiteSpace: 'nowrap' }}>
        {children}
      </span>
    </GhostButton>
  );
}
