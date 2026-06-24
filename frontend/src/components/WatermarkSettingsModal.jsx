import { useState, useEffect } from 'react';
import Toggle from './Toggle';
import { apiGetWatermarkSettings, apiUpdateWatermarkSettings } from '../api/settings';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function CloseIcon({ hovered, pressed }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, opacity: pressed ? 0.6 : hovered ? 0.8 : 1, transition: 'opacity 120ms ease' }}
    >
      <path d="M2.667 2.667L13.333 13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.667 13.333L13.333 2.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function WatermarkSettingsModal({ onClose, showToast }) {
  const [imageWatermark, setImageWatermark] = useState(false);
  const [videoWatermark, setVideoWatermark] = useState(false);
  const [loading, setLoading] = useState(false);
  const [closeHovered, setCloseHovered] = useState(false);
  const [closePressed, setClosePressed] = useState(false);
  const [cancelHovered, setCancelHovered] = useState(false);
  const [cancelPressed, setCancelPressed] = useState(false);
  const [saveHovered, setSaveHovered] = useState(false);
  const [savePressed, setSavePressed] = useState(false);
  const [imageCardHovered, setImageCardHovered] = useState(false);
  const [videoCardHovered, setVideoCardHovered] = useState(false);

  useEffect(() => {
    apiGetWatermarkSettings().then((data) => {
      setImageWatermark(data.imageWatermark);
      setVideoWatermark(data.videoWatermark);
    });
  }, []);

  const handleImageWatermarkChange = (newValue) => {
    setImageWatermark(newValue);
    showToast(newValue ? '图片水印已开启' : '图片水印已关闭', 'success');
  };

  const handleVideoWatermarkChange = (newValue) => {
    setVideoWatermark(newValue);
    showToast(newValue ? '视频水印已开启' : '视频水印已关闭', 'success');
  };

  const handleSave = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await apiUpdateWatermarkSettings({ imageWatermark, videoWatermark });
      showToast('水印设置已保存', 'success');
      onClose();
    } catch {
      showToast('保存失败，请重试', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-surface-overlay backdrop-blur-[20px] z-50"
      onClick={onClose}
    >
      <div
        className="w-[400px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-[16px] justify-between w-[400px] py-[16px] bg-[#161616] rounded-t-[16px] rounded-b-none px-[24px]">
          <div className="flex-1 font-['AlibabaPuHuiTi_2_55_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] font-medium text-white text-[16px] leading-[20px]">
            水印设置
          </div>
          <button
            onClick={onClose}
            onMouseEnter={() => setCloseHovered(true)}
            onMouseLeave={() => {
              setCloseHovered(false);
              setClosePressed(false);
            }}
            onMouseDown={() => setClosePressed(true)}
            onMouseUp={() => setClosePressed(false)}
            className="cursor-pointer bg-transparent border-0 p-0"
          >
            <CloseIcon hovered={closeHovered} pressed={closePressed} />
          </button>
        </div>

        {/* Body */}
        <div className="items-start flex flex-col gap-[12px] py-[8px] w-[400px] bg-[#161616] px-[24px]">
          {/* 图片 AI 水印 */}
          <div
            className="items-start self-stretch flex justify-between rounded-[8px] py-[12px] px-[16px] gap-[8px] flex-col transition-colors duration-150"
            style={{
              backgroundColor: imageCardHovered ? '#1F1F1F' : '#1D1E1E',
            }}
            onMouseEnter={() => setImageCardHovered(true)}
            onMouseLeave={() => setImageCardHovered(false)}
          >
            <div className="flex items-center self-stretch justify-between gap-[12px]">
              <div className="flex-1 font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-white text-[14px] leading-[18px]">
                图片 AI 水印
              </div>
              <Toggle value={imageWatermark} onChange={handleImageWatermarkChange} />
            </div>
            <div className="self-stretch font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99] text-[12px] leading-[16px]">
              默认关闭；开启后，支持该能力的图片模型会生成带 AI 水印的资产。
            </div>
          </div>

          {/* 视频 AI 水印 */}
          <div
            className="items-start self-stretch flex justify-between rounded-[8px] py-[12px] px-[16px] gap-[8px] flex-col transition-colors duration-150"
            style={{
              backgroundColor: videoCardHovered ? '#1F1F1F' : '#1D1E1E',
            }}
            onMouseEnter={() => setVideoCardHovered(true)}
            onMouseLeave={() => setVideoCardHovered(false)}
          >
            <div className="flex items-center self-stretch justify-between gap-[12px]">
              <div className="flex-1 font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-white text-[14px] leading-[18px]">
                视频 AI 水印
              </div>
              <Toggle value={videoWatermark} onChange={handleVideoWatermarkChange} />
            </div>
            <div className="self-stretch font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99] text-[12px] leading-[16px]">
              默认关闭；开启后，支持该能力的视频模型会生成带 AI 水印的资产。
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-[16px] justify-between w-[400px] bg-[#161616] py-[16px] px-[24px] rounded-t-none rounded-b-[16px]">
          <div className="flex items-center gap-[16px] flex-1 justify-end">
            {/* 取消按钮 */}
            <button
              onClick={onClose}
              disabled={loading}
              onMouseEnter={() => setCancelHovered(true)}
              onMouseLeave={() => {
                setCancelHovered(false);
                setCancelPressed(false);
              }}
              onMouseDown={() => setCancelPressed(true)}
              onMouseUp={() => setCancelPressed(false)}
              className="flex items-center h-[36px] shrink-0 rounded-[8px] px-[16px] gap-[4px] [box-shadow:#00000066_3px_3px_8px] border border-solid border-[#FFFFFF0D] [outline:1px_solid_#00000080] cursor-pointer disabled:cursor-not-allowed"
              style={{
                backgroundColor: loading ? '#161616' : cancelPressed ? '#1A1A1A' : cancelHovered ? '#1C1C1C' : '#161616',
                transition: 'background-color 120ms ease',
              }}
            >
              <div className="inline-block w-max shrink-0 font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99] text-[14px] leading-[18px]">
                取消
              </div>
            </button>

            {/* 保存按钮 */}
            <button
              onClick={handleSave}
              disabled={loading}
              onMouseEnter={() => setSaveHovered(true)}
              onMouseLeave={() => {
                setSaveHovered(false);
                setSavePressed(false);
              }}
              onMouseDown={() => setSavePressed(true)}
              onMouseUp={() => setSavePressed(false)}
              className="flex flex-col h-[36px] shrink-0 rounded-[8px] [box-shadow:#00000066_3px_3px_8px] [outline:1px_solid_#00000080] p-px cursor-pointer disabled:cursor-not-allowed disabled:[background-image:none]"
              style={{
                backgroundImage: loading ? 'none' : 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)',
              }}
            >
              <div
                className="flex items-center grow shrink basis-[0%] rounded-[7px] px-[15px] gap-[4px] transition-colors duration-120"
                style={{
                  backgroundColor: loading ? '#161616' : savePressed ? '#1A1A1A' : saveHovered ? '#1C1C1C' : '#161616',
                }}
              >
                <div className="inline-block w-max shrink-0 font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-white text-[14px] leading-[18px]">
                  保存
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
