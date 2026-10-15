import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const ledgerPath = path.join(dir, 'audit.json');
const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
const baseline = '2c513f7 加审查时工作区修改；图片编辑另有并行用户修改';
const timestamp = new Date().toISOString();
const entries = [
  ['首页与导航', 'src/pages/Home.jsx', []],
  ['登录与账号会话', 'src/components/LoginModal.jsx', [11]],
  ['项目管理', 'src/pages/ProjectList.jsx', []],
  ['项目全局设置', 'src/pages/GlobalSettings.jsx', []],
  ['剧本', 'src/pages/ScriptPage.jsx', [12]],
  ['主体与音色', 'src/pages/SubjectPage.jsx', []],
  ['分镜与生成', 'src/pages/StoryboardPage.jsx', [8]],
  ['创作', 'src/pages/CreationPage.jsx', [2]],
  ['项目资产', 'src/components/assets/AssetsProjectPanel.jsx', [7]],
  ['创作资产', 'src/components/assets/AssetsCreativePanel.jsx', []],
  ['素材库', 'src/components/assets/SeedanceAssetLibraryPanel.jsx', []],
  ['图片编辑与资源选择', 'src/components/image-edit/LocalImageEditor.jsx', []],
  ['接口与模型配置', 'src/components/ApiConfigModal.jsx', [10]],
  ['个人资料', 'src/components/ProfileModal.jsx', [6]],
  ['通知水印与存储', 'src/components/WatermarkSettingsModal.jsx', [3, 9]],
  ['管理员总览', 'src/pages/AdminConsolePage.jsx', []],
  ['管理员展示配置', 'src/components/admin/AdminDisplaySettingsPage.jsx', [4]],
  ['管理员模型开放', 'src/components/admin/AdminModelVisibilityPage.jsx', [5]],
  ['管理员音色库', 'src/components/admin/AdminVoiceLibraryPage.jsx', []],
  ['管理员账号管理', 'src/components/admin/AdminAccountManagementPage.jsx', []],
  ['公共页面与帮助', 'public/about/index.html', []],
  ['共享组件缓存与请求', 'src/utils/cache.js', [1]],
];
const id = (prefix, n) => `${prefix}-${String(n).padStart(3, '0')}`;
const report = fs.readFileSync(path.join(dir, 'findings.md'), 'utf8');
Object.assign(ledger.project, {
  target: '/Users/suzylee/Desktop/miioo-v1.5/frontend',
  baseline: { source_ref: baseline, runtime_ref: '未运行浏览器', observed_at: timestamp },
  inventory_status: 'discovering',
  inventory_sources: [{ kind: 'source', locator: 'src/App.jsx、src/main.jsx、模块检查记录.md；组件候选见 discovery-candidates.json', evidence_ids: [] }],
  scope: '除自由画布和剪辑外全部功能；首轮关键路径检查，逐组件实例发现与深查尚未完成',
  out_of_scope: ['自由画布', '剪辑'].map(surface => ({ surface, reason: '用户明确排除', authority: '本次用户请求' })),
  production_profile: { audience: 'AI 视频创作者及管理员', risk: '账号、项目资产与收费生成', supported_environments: 'unknown', release: 'unknown' },
  assumptions: ['运行验收由 Suzy 手动完成；不访问真实写删与收费接口；不修改业务代码'],
});
ledger.pages = entries.map(([title, source_locator], index) => ({
  id: id('PAGE', index + 1), route: `模块入口（非 URL）：${title}`, title, source_locator,
  entry_conditions: ['由首页、弹窗或管理台进入；具体条件尚待逐实例登记'],
  variants: ['正常、空态、加载、失败、离开返回；子分支尚未完整展开'], evidence_ids: [], scope_status: 'in_scope',
}));
// 这里只登记确已确认的问题，候选文件不冒充已审查组件实例。
ledger.evidence = [];
ledger.findings = [];
ledger.tasks = [];
ledger.scenarios = [];
ledger.checks = ledger.checks.filter(check => check.scope === 'project');
for (const match of report.matchAll(/^## (FND-\d+)：([^\n]+)\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)) {
  const [, findingId, title, body] = match;
  const number = Number(findingId.slice(4));
  const field = name => body.match(new RegExp(`^- ${name}：(.+)$`, 'm'))?.[1] || '';
  const pageIndex = entries.findIndex(entry => entry[2].includes(number));
  const pageId = id('PAGE', pageIndex + 1);
  const evidenceId = id('EV', number);
  const scenarioId = id('SCN', number);
  const checkId = id('CHK-F', number);
  const taskId = id('TASK', number);
  ledger.evidence.push({ id: evidenceId, kind: 'source', locator: field('位置'), observed_at: timestamp, baseline_ref: baseline, summary: field('证据') });
  ledger.scenarios.push({ id: scenarioId, title: `${title}：手动复验`, page_ids: [pageId], instance_ids: [], preconditions: ['使用本地或测试数据，具备控制错误响应或延迟的条件'], steps: [field('验收')], expected: [field('修复')], context: { role: pageIndex >= 15 && pageIndex <= 19 ? '测试管理员' : '测试用户', data: '测试项目和资产，不使用真实敏感信息', network: '正常、失败和受控延迟', viewport: '用户实际桌面环境，尚未运行验证', input: '按验收步骤操作', lifecycle: '按验收步骤刷新或切换' }, risk: number === 1 || number === 6 ? 'high' : 'normal', status: 'blocked', evidence_ids: [], finding_ids: [findingId], reason: '用户要求不打开浏览器；待 Suzy 手动验证' });
  ledger.checks.push({ id: checkId, scope: 'page', target_id: pageId, dimension: 'state_coverage', question: `源码是否处理：${title}`, status: 'failed', evidence_ids: [evidenceId], scenario_ids: [scenarioId], finding_ids: [findingId], reason: '源码缺口确认，实际端到端影响见手动验收边界' });
  ledger.findings.push({ id: findingId, title, category: '状态与交互', severity: field('优先级').slice(0, 2), confidence: 'confirmed', status: 'open', owner: '前端开发', page_ids: [pageId], instance_ids: [], definition_ids: [], check_ids: [checkId], scenario_ids: [scenarioId], evidence_ids: [evidenceId], actual: field('证据'), expected: field('修复'), impact: field('影响'), root_cause: field('证据'), root_cause_confidence: 'confirmed', remediation: field('修复'), regression_test: field('验收'), reproduction: { preconditions: ['源码检查；实际运行按手动验收条件进行'], steps: [field('验收')] }, resolution_evidence_ids: [] });
  ledger.tasks.push({ id: taskId, title: `修复：${title}`, phase: number === 1 || number === 6 ? '优先一致性' : '交互与状态修复', owner: '前端开发', scope_ids: [pageId], finding_ids: [findingId], depends_on: [], change_locations: [field('位置')], implementation_steps: [field('修复')], acceptance_criteria: [field('验收')], verification_scenario_ids: [scenarioId], rollback: '按问题小批改动；任何回滚须另获用户授权，保留用户并行修改', risk: field('影响'), status: 'planned', evidence_ids: [] });
}
ledger.progress = { current_page: null, completed_batches: ['22 个模块入口/关键路径首轮检查；非逐组件完成', `${ledger.findings.length} 项问题及修复验收已登记`], next_actions: ['按模块检查记录.md 补完每个模块未完成源码分支', '将候选逐项核对为 DEF/CMP 并建立实例蓝图；不可将空组件台账解释为没有组件', 'Suzy 手动验收后补运行证据'], unresolved_access: ['无浏览器验证（用户要求）', '后端权限及真实接口语义未验证'], last_updated: timestamp };
ledger.tasks.forEach(task => { task.phase = task.phase === '优先一致性' ? 1 : 2; });
fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
let progress = fs.readFileSync(path.join(dir, '进度.md'), 'utf8');
progress = progress.split('\n').map(line => {
  const matched = line.match(/^\| (\d{2}) \|/);
  if (!matched) return line;
  const index = Number(matched[1]) - 1;
  const cells = line.split('|');
  cells[4] = entries[index][2].length ? ' 需要修复，继续审查 ' : ' 审查中 ';
  cells[5] = entries[index][2].length ? ` ${entries[index][2].map(n => id('FND', n)).join('、')} ` : ' 尚未发现可定案问题；剩余分支待查 ';
  return cells.join('|');
}).join('\n');
fs.writeFileSync(path.join(dir, '进度.md'), progress);
console.log(`已同步 ${ledger.pages.length} 个模块、${ledger.findings.length} 个问题；组件实例仍待逐项发现。`);
