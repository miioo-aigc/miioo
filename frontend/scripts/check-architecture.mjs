import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const src = path.join(root, 'src');
const pagesDir = path.join(src, 'pages');
const componentsDir = path.join(src, 'components');
const hooksDir = path.join(src, 'hooks');
const errors = [];
const warnings = [];

const readFiles = (dir, extensions = ['.jsx', '.js']) => {
  if (!fs.existsSync(dir)) return [];
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...readFiles(filePath, extensions));
    else if (extensions.includes(path.extname(entry.name))) result.push(filePath);
  }
  return result;
};

const relative = (filePath) => path.relative(root, filePath).split(path.sep).join('/');
const lines = (filePath) => fs.readFileSync(filePath, 'utf8').split('\n').length;

const warnSize = (filePath, count, limit, label) => {
  if (count > limit) warnings.push(`${relative(filePath)}：${count} 行，超过${label} ${limit} 行警告线`);
};

const pairedRuleDocs = [
  ['AGENTS.md', 'CLAUDE.md'],
  ['src/pages/AGENTS.md', 'src/pages/CLAUDE.md'],
  ['src/api/AGENTS.md', 'src/api/CLAUDE.md'],
  ['design-system/AGENTS.md', 'design-system/CLAUDE.md'],
];
for (const [agentsPath, claudePath] of pairedRuleDocs) {
  const agentsFile = path.join(root, agentsPath);
  const claudeFile = path.join(root, claudePath);
  if (!fs.existsSync(agentsFile) || !fs.existsSync(claudeFile)) {
    errors.push(`${agentsPath} 与 ${claudePath} 必须同时存在`);
  } else if (fs.readFileSync(agentsFile, 'utf8') !== fs.readFileSync(claudeFile, 'utf8')) {
    errors.push(`${agentsPath} 与 ${claudePath} 内容必须完全一致`);
  }
}

for (const filePath of readFiles(pagesDir)) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('L?')) errors.push(`${relative(filePath)}：结构索引不得保留 L? 占位符`);
}

for (const filePath of readFiles(pagesDir)) {
  const count = lines(filePath);
  const name = path.basename(filePath);
  if (!/^[A-Z][A-Za-z0-9]*\.(jsx|js)$/.test(name)) {
    errors.push(`${relative(filePath)}：页面文件名必须使用大驼峰`);
  }
  warnSize(filePath, count, 300, '页面入口');
}

for (const filePath of readFiles(componentsDir)) {
  const name = path.basename(filePath);
  const isComponentName = /^[A-Z][A-Za-z0-9]*\.(jsx|js)$/.test(name);
  const isHookName = /^use[A-Z][A-Za-z0-9]*\.js$/.test(name);
  const isUtilityName = /^[a-z][A-Za-z0-9]*(Utils|Adapter|Styles|Context|Mappers|Params|Result|Actions|Polling)\.js$/.test(name);
  if (!isComponentName && !isHookName && !isUtilityName && name !== 'adminShared.jsx' && name !== 'index.js') {
    errors.push(`${relative(filePath)}：组件文件名必须使用大驼峰`);
  }

  const count = lines(filePath);
  const normalized = relative(filePath);
  if (normalized.includes('/hooks/')) warnSize(filePath, count, 300, 'Hook');
  else if (normalized.includes('/components/ui/')) warnSize(filePath, count, 250, '通用 UI 组件');
  else if (name.endsWith('.jsx')) warnSize(filePath, count, 400, '业务区块组件');
}

for (const filePath of readFiles(hooksDir)) {
  const name = path.basename(filePath);
  if (!/^use[A-Z][A-Za-z0-9]*\.js$/.test(name)) {
    errors.push(`${relative(filePath)}：Hook 文件名必须使用 useXxx.js`);
  }
  warnSize(filePath, lines(filePath), 300, 'Hook');
}

const uiDir = path.join(componentsDir, 'ui');
const checkForbiddenImports = (filePath, patterns, message) => {
  const content = fs.readFileSync(filePath, 'utf8');
  if (patterns.some((pattern) => pattern.test(content))) {
    errors.push(`${relative(filePath)}：${message}`);
  }
};

for (const filePath of readFiles(uiDir)) {
  checkForbiddenImports(filePath, [
    /(?:from|import\s*\()['"].*\/pages(?:\/|['"])/,
    /(?:from|import\s*\()['"].*\/api(?:\/|['"])/,
    /(?:from|import\s*\()['"].*\/stores?(?:\/|['"])/,
    /(?:from|import\s*\()['"].*\/components\/(?!ui(?:\/|['"]))/,
  ], 'ui 基础组件只能依赖通用工具和 ui 内部能力');
}

for (const filePath of readFiles(path.join(src, 'api'))) {
  checkForbiddenImports(filePath, [
    /(?:from|import\s*\()['"].*\/pages(?:\/|['"])/,
    /(?:from|import\s*\()['"].*\/components(?:\/|['"])/,
  ], 'api 模块不得依赖页面或 React 组件');
}

for (const directoryName of ['feedback', 'overlay', 'actions']) {
  for (const filePath of readFiles(path.join(componentsDir, directoryName))) {
    checkForbiddenImports(filePath, [
      /(?:from|import\s*\()['"].*\/pages(?:\/|['"])/,
      /(?:from|import\s*\()['"].*\/api(?:\/|['"])/,
      /(?:from|import\s*\()['"].*\/stores?(?:\/|['"])/,
    ], `${directoryName} 组件不得依赖页面、业务 API 或 Store`);
  }
}

for (const filePath of readFiles(componentsDir)) {
  const normalized = relative(filePath);
  if (!normalized.includes('/components/') || normalized.includes('/components/ui/')) continue;
  checkForbiddenImports(filePath, [
    /(?:from|import\s*\()['"].*\/pages(?:\/|['"])/,
  ], '业务组件不得反向依赖页面入口');
}

if (warnings.length) {
  console.log('架构检查告警：');
  for (const warning of warnings) console.log(`  ⚠ ${warning}`);
}
if (errors.length) {
  console.error('架构检查失败：');
  for (const error of errors) console.error(`  ✗ ${error}`);
  process.exitCode = 1;
} else {
  console.log('架构检查通过：未发现阻断级违规。');
}
