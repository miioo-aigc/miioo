/**
 * @file AssetsPage.jsx
 * @structure-index
 *
 * 页面入口只负责模块切换和业务面板组合；项目资产、创作资产、卡片和详情组合
 * 分别由 src/components/assets/ 目录承载，页面不持有资产 API 或卡片细节。
 *
 * ─── 主页面入口 ────────────────────────────────────
 *   AssetsPage：模块切换（项目资产 / 创作资产）与页面外框
 *   AssetsProjectPanel：项目资产筛选、分页、批量操作和详情回调编排
 *   AssetsCreativePanel：创作资产历史分页、收藏和批量操作编排
 *   SeedanceAssetLibraryPanel：Seedance2.0素材库子 Tab 和文件夹组合
 *
 * ─── 页面级边界 ───────────────────────────────────
 *   页面入口不直接调用资产 API；业务面板继续持有各自 API、Store、副作用和回调。
 *   组件迁移保持原参数、交互、删除/下载副作用和详情打开行为不变。
 *
 * ─── 更新记录 ─────────────────────────────────────
 *   2026-07-16  抽离 AssetsProjectPanel、AssetsCreativePanel 和资产卡片组合，
 *               页面入口收敛为模块切换与面板组合；同步真实行号和引用边界
 *   2026-07-24  接入 Seedance2.0素材库模块，由业务组件承载子 Tab 与文件夹展示
 */

import { useState } from 'react';
import { AssetsModuleTabBar, AssetsProjectPanel, AssetsCreativePanel, SeedanceAssetLibraryPanel } from '../components/assets';

const MODULE_TABS = [
  { key: 'project', label: '项目资产' },
  { key: 'creative', label: '创作资产' },
  { key: 'seedance', label: 'Seedance2.0素材库' },
];

export default function AssetsPage({ isLoggedIn }) {
  const [activeModule, setActiveModule] = useState('project');

  return (
    <div style={{
      flex: '1 1 0%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      height: '100%',
      paddingBottom: '24px',
      paddingRight: '24px',
    }}>
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '16px',
        border: '1px solid #FFFFFF14',
        backgroundColor: '#161616',
        overflow: 'hidden',
      }}>
        <AssetsModuleTabBar tabs={MODULE_TABS} active={activeModule} onChange={setActiveModule} />
        {activeModule === 'project' && <AssetsProjectPanel />}
        {activeModule === 'creative' && <AssetsCreativePanel isLoggedIn={isLoggedIn} />}
        {activeModule === 'seedance' && <SeedanceAssetLibraryPanel />}
      </div>
    </div>
  );
}
