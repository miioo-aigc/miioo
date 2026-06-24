/**
 * [设计稿参考] API配置弹窗 - 状态一（初始/未配置）
 * 来源: https://app.paper.design/file/01KQYRKV5GAPKWF7X9K33912CS/1-0/35V-1
 * 导出时间: 2026-05-11
 *
 * 使用说明：
 * - 此文件仅作为设计稿参考，不直接上线
 * - 开发完成后可删除
 * - 对应状态：OneLinkAI 未配置，显示"开始配置API"按钮
 */
export default function () {
  return (
    <div className="[font-synthesis:none] flex flex-col items-start w-200 h-150 antialiased text-xs/4 p-0">
      <div className="flex items-center gap-4 justify-between py-4 self-stretch bg-[#161616] rounded-t-2xl rounded-b-none px-6">
        <div className="flex-1 font-['AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] font-medium text-white text-base/5">
          API配置
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
          <path d="M2.667 2.667L13.333 13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2.667 13.333L13.333 2.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="flex flex-col items-start gap-4 py-2 self-stretch flex-1 bg-[#161616] px-6">
        <div className="flex items-start gap-3 px-4 py-3 self-stretch rounded-lg [box-shadow:#FFFFFF14_0px_0px_0px_1px_inset] bg-[#1D1E1E]" style={{ backgroundImage: 'linear-gradient(in oklab 180deg, oklab(75.5% -0.102 -0.072 / 10%) 0%, oklab(23.4% -0.001 -.0004) 100%)' }}>
          <div className="flex flex-col items-start gap-2 flex-1 p-0">
            <div className="self-stretch font-['AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] font-medium text-white text-base/5">
              推荐使用OneLinkAI API
            </div>
            <div className="flex flex-col items-start gap-0.5 self-stretch p-0">
              <div className="flex items-center gap-0.5 self-stretch p-0">
                <div className="text-[14px] leading-[150%] font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99]">
                  OneLinkAI平台支持
                </div>
                <div className="flex flex-col items-start gap-0 px-1 py-0 rounded-sm [box-shadow:#FFFFFF14_0px_0px_0px_1px_inset] bg-[#2DC3E11A]">
                  <div className="w-fit font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#2DC3E1] text-sm/4.5">
                    Seedance2.0
                  </div>
                </div>
                <div className="flex flex-col items-start gap-0 px-1 py-0 rounded-sm [box-shadow:#FFFFFF14_0px_0px_0px_1px_inset] bg-[#2DC3E11A]">
                  <div className="w-fit font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#2DC3E1] text-sm/4.5">
                    Kling
                  </div>
                </div>
                <div className="flex flex-col items-start gap-0 px-1 py-0 rounded-sm [box-shadow:#FFFFFF14_0px_0px_0px_1px_inset] bg-[#2DC3E11A]">
                  <div className="w-fit font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#2DC3E1] text-sm/4.5">
                    Vidu
                  </div>
                </div>
                <div className="text-[14px] leading-[150%] font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99]">
                  等多种模型，价格优惠，连接稳定。
                </div>
              </div>
              <div className="flex items-center gap-0.5 self-stretch p-0">
                <div className="text-[14px] leading-[150%] font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99]">
                  新用户注册赠送
                </div>
                <div className="flex flex-col items-start gap-0 px-1 py-0 rounded-md [box-shadow:#FFFFFF14_0px_0px_0px_1px_inset] bg-[#2DC3E11A]">
                  <div className="w-fit font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#2DC3E1] text-sm/4.5">
                    50元
                  </div>
                </div>
                <div className="text-[14px] leading-[150%] font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99]">
                  算力金。
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-end gap-2 self-stretch">
            <div className="flex items-center h-8 rounded-lg px-4 gap-1 [box-shadow:#00000066_3px_3px_8px] bg-[#161616] border border-solid border-[#FFFFFF0D] [outline:1px_solid_#00000080]">
              <div className="inline-block w-max shrink-0 font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99] text-sm/4.5">
                教程
              </div>
            </div>
            <div className="flex items-center h-8 rounded-lg px-4 gap-1 bg-[#2DC3E1] bg-origin-border border border-solid border-[#FFFFFF33] [outline:1px_solid_#00000080]" style={{ backgroundImage: 'linear-gradient(in oklab 107.50999999999999deg, oklab(84.6% -0.114 0.031 / 30%) 8.14%, oklab(84.6% -0.114 0.031 / 0%) 54.48%)' }}>
              <div className="inline-block text-center font-['AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] font-medium text-[#090909] text-sm/4.5">
                获取
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 self-stretch p-0">
          <div className="self-stretch font-['AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] font-medium text-white text-sm/4.5">
            API服务商
          </div>
          <div className="flex items-start gap-4 self-stretch p-0">
            <div className="flex flex-col items-center gap-3 px-4 py-3 flex-1 rounded-lg h-50 justify-center bg-[#1D1E1E] border border-solid border-[#FFFFFF14] [outline:1px_solid_#00000080] outline-offset-1">
              <div className="flex items-center gap-3 self-stretch justify-between p-0">
                <div className="flex-1 font-['AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] font-medium text-white text-base/5">
                  OneLinkAI
                </div>
                <div className="flex items-center gap-0 w-14 rounded-full shrink-0 [box-shadow:#FFFFFF14_0px_0px_0px_1px_inset] bg-[#090909] p-1">
                  <div className="rounded-full shrink-0 bg-[#FFFFFF14] size-4" />
                  <div className="flex-1 text-center font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF66] text-xs/4">
                    关闭
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-center gap-0 self-stretch flex-1 justify-center p-0">
                <div className="flex items-center h-8 rounded-lg px-4 gap-1 shrink-0 bg-[#2DC3E1] bg-origin-border border border-solid border-[#FFFFFF33] [outline:1px_solid_#00000080]" style={{ backgroundImage: 'linear-gradient(in oklab 107.50999999999999deg, oklab(84.6% -0.114 0.031 / 30%) 8.14%, oklab(84.6% -0.114 0.031 / 0%) 54.48%)' }}>
                  <div className="inline-block text-center font-['AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] font-medium text-[#090909] text-sm/4.5">
                    开始配置API
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-3 px-4 py-3 flex-1 rounded-lg h-50 justify-center bg-[#1D1E1E] border border-solid border-[#FFFFFF14] [outline:1px_solid_#00000080] outline-offset-1">
              <div className="flex flex-col items-center gap-0 self-stretch flex-1 justify-center p-0">
                <div className="flex items-center h-9 shrink-0 rounded-lg px-4 gap-1 [box-shadow:#00000066_3px_3px_8px] bg-[#161616] border border-solid border-[#FFFFFF0D] [outline:1px_solid_#00000080]">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                    <path d="M8 3v10M3 8h10" stroke="#FFFFFFCC" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <div className="inline-block w-max shrink-0 font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFFCC] text-sm/4.5">
                    自定义服务商
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-3 px-4 py-3 flex-1 rounded-lg h-50 justify-center opacity-[0] bg-[#1D1E1E] border border-solid border-[#FFFFFF14] [outline:1px_solid_#00000080] outline-offset-1">
              <div className="self-stretch text-center font-['AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] font-medium text-white text-base/5">
                硅基流动
              </div>
              <div className="flex items-center gap-2 self-stretch justify-between p-0">
                <div className="w-fit shrink-0 font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99] text-sm/4.5">
                  已配置模型
                </div>
                <div className="w-fit shrink-0 font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-white text-sm/4.5">
                  23个
                </div>
              </div>
              <div className="flex items-center gap-2 self-stretch justify-between p-0">
                <div className="w-fit shrink-0 font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99] text-sm/4.5">
                  添加时间
                </div>
                <div className="w-fit shrink-0 font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-white text-sm/4.5">
                  2026-01-01
                </div>
              </div>
              <div className="flex items-center gap-2 self-stretch justify-between p-0">
                <div className="w-fit shrink-0 font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99] text-sm/4.5">
                  状态
                </div>
                <div className="flex items-center gap-0.5 rounded-full justify-between w-14 shrink-0 [box-shadow:#FFFFFF14_0px_0px_0px_1px_inset] bg-[#090909] p-1">
                  <div className="flex-1 text-center font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#52BF92] text-xs/4">
                    开
                  </div>
                  <div className="rounded-full shrink-0 bg-[#52BF92] border border-solid border-[#FFFFFF33] [outline:1px_solid_#00000080] size-4" />
                </div>
              </div>
              <div className="flex flex-col items-end gap-0 self-stretch flex-1 justify-center p-0">
                <div className="flex items-center h-8 rounded-lg px-4 gap-1 shrink-0 bg-[#2DC3E1] bg-origin-border border border-solid border-[#FFFFFF33] [outline:1px_solid_#00000080]" style={{ backgroundImage: 'linear-gradient(in oklab 107.50999999999999deg, oklab(84.6% -0.114 0.031 / 30%) 8.14%, oklab(84.6% -0.114 0.031 / 0%) 54.48%)' }}>
                  <div className="inline-block w-14 text-center shrink-0 font-['AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] font-medium text-[#090909] text-sm/4.5">
                    测试连接
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 self-stretch p-0">
          <div className="self-stretch font-['AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] font-medium text-white text-sm/4.5">
            配置说明
          </div>
          <div className="flex flex-col items-start gap-0.5 self-stretch p-0">
            <div className="flex items-center gap-0.5 self-stretch p-0">
              <div className="text-[14px] leading-[150%] flex-1 whitespace-pre-wrap font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99]">
                我们已经为您配置好OneLink AI平台内的23个主流模型，前往官网获取API后即可开始使用<br />您也可以使用其他API服务，添加自定义模型，查看教程<br />为保证安全，您的API配置仅保存在本地浏览器，不会上传到云端
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 justify-between self-stretch bg-[#161616] rounded-t-none rounded-b-2xl py-4 px-6">
        <div className="flex items-center gap-4 flex-1 justify-end">
          <div className="flex items-center h-9 shrink-0 rounded-lg px-4 gap-1 [box-shadow:#00000066_3px_3px_8px] bg-[#161616] border border-solid border-[#FFFFFF0D] [outline:1px_solid_#00000080]">
            <div className="inline-block w-max shrink-0 font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF99] text-sm/4.5">
              保存
            </div>
          </div>
          <div className="flex flex-col h-9 shrink-0 rounded-lg [box-shadow:#00000066_3px_3px_8px] [outline:1px_solid_#00000080] p-px" style={{ backgroundImage: 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)' }}>
            <div className="flex items-center grow shrink basis-[0%] rounded-[7px] px-3.75 gap-1 bg-[#161616]">
              <div className="inline-block w-max shrink-0 font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-white text-sm/4.5">
                完成
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
