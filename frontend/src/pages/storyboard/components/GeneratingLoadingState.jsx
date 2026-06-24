import DotsLoading from '../../../components/DotsLoading';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

export default function GeneratingLoadingState({ loadingText }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, marginBottom: '24px', marginRight: '32px',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '16px',
      backgroundColor: '#161616', borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <DotsLoading size={4} color="#2DC3E1" gap={4} />
      <span style={{ fontFamily: FONT, fontSize: '12px', color: '#FFFFFF99' }}>
        {loadingText}
      </span>
    </div>
  );
}
