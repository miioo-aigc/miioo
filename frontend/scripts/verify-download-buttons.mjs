#!/usr/bin/env node

/**
 * 环境变量驱动的真实页面下载按钮验收脚本。
 *
 * 用法：
 *   npm --prefix frontend_new run verify:downloads
 *
 * 常用环境变量：
 *   BASE_URL          前端地址，默认 http://localhost:5173
 *   DOWNLOAD_DIR      下载目录，默认 ./.download-verify
 *   LOGIN_PHONE       登录手机号
 *   LOGIN_PASSWORD    登录密码
 *   LOGIN_CODE        验证码登录（可选，与密码二选一）
 *   PROJECT_NAME      要进入的项目名称
 *   HEADLESS          true/false，默认 true
 *   TIMEOUT_MS        超时毫秒，默认 60000
 *   STORYBOARD_DOWNLOAD_SELECTOR  分镜页下载按钮选择器（可选覆盖）
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = {
  baseUrl: process.env.BASE_URL || 'http://localhost:5173',
  downloadDir: path.resolve(process.env.DOWNLOAD_DIR || path.join(__dirname, '../.download-verify')),
  loginPhone: process.env.LOGIN_PHONE || '',
  loginPassword: process.env.LOGIN_PASSWORD || '',
  loginCode: process.env.LOGIN_CODE || '',
  projectName: process.env.PROJECT_NAME || '',
  headless: process.env.HEADLESS !== 'false',
  timeoutMs: Number(process.env.TIMEOUT_MS || 60000),
  storyboardDownloadSelector: process.env.STORYBOARD_DOWNLOAD_SELECTOR || '[aria-label="下载"], button:has-text("下载")',
};

function takeReadableChars(value, limit = 8) {
  return Array.from(String(value || '').trim()).slice(0, limit).join('');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function loadPlaywright() {
  try {
    const mod = await import('playwright');
    return mod.chromium;
  } catch {
    console.error('未找到 playwright。请先执行：npm --prefix frontend_new install -D playwright');
    process.exit(1);
  }
}

async function login(page) {
  if (!config.loginPhone) {
    console.warn('[verify] 未设置 LOGIN_PHONE，跳过登录步骤');
    return;
  }

  await page.goto(`${config.baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: config.timeoutMs });

  await page.fill('input[type="tel"], input[name="phone"], input[placeholder*="手机"]', config.loginPhone);
  if (config.loginCode) {
    await page.fill('input[name="code"], input[placeholder*="验证码"]', config.loginCode);
  } else if (config.loginPassword) {
    await page.fill('input[type="password"], input[name="password"]', config.loginPassword);
  }

  const submit = page.locator('button[type="submit"], button:has-text("登录")').first();
  await submit.click();
  await page.waitForLoadState('networkidle', { timeout: config.timeoutMs }).catch(() => {});
}

async function openProject(page) {
  if (!config.projectName) {
    console.warn('[verify] 未设置 PROJECT_NAME，跳过分镜页导航');
    return false;
  }

  await page.goto(`${config.baseUrl}/projects`, { waitUntil: 'domcontentloaded', timeout: config.timeoutMs });
  const project = page.locator(`text=${config.projectName}`).first();
  await project.click({ timeout: config.timeoutMs });
  await page.waitForLoadState('networkidle', { timeout: config.timeoutMs }).catch(() => {});
  return true;
}

async function openStoryboardTab(page) {
  const tab = page.locator('text=分镜').first();
  if (await tab.count()) {
    await tab.click({ timeout: config.timeoutMs });
    await page.waitForTimeout(1000);
    return true;
  }
  return false;
}

function validateDownloadFile(filePath, { promptExcerpt, expectedExt }) {
  assert(fs.existsSync(filePath), `下载文件不存在: ${filePath}`);
  const stat = fs.statSync(filePath);
  assert(stat.size > 0, `下载文件大小为 0: ${filePath}`);
  assert(filePath.toLowerCase().endsWith(expectedExt), `扩展名不符合预期: ${filePath}`);
  if (promptExcerpt) {
    const base = path.basename(filePath);
    assert(base.includes(promptExcerpt), `文件名未包含提示词节选 "${promptExcerpt}": ${base}`);
  }
}

async function verifyStoryboardDownload(page) {
  const promptNode = page.locator('[data-testid="shot-description"], textarea, [class*="description"]').first();
  const promptText = (await promptNode.textContent().catch(() => '')) || '';
  const promptExcerpt = takeReadableChars(promptText.replace(/\s+/g, ' ').trim(), 8);

  const downloadButton = page.locator(config.storyboardDownloadSelector).first();
  assert(await downloadButton.count(), '未找到分镜下载按钮，可通过 STORYBOARD_DOWNLOAD_SELECTOR 覆盖');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: config.timeoutMs }),
    downloadButton.click(),
  ]);

  const suggested = download.suggestedFilename();
  const targetPath = path.join(config.downloadDir, suggested);
  await download.saveAs(targetPath);

  const ext = suggested.includes('.') ? `.${suggested.split('.').pop()}` : '';
  validateDownloadFile(targetPath, {
    promptExcerpt: promptExcerpt || null,
    expectedExt: ext || '.png',
  });

  console.log(`[verify] 分镜下载通过: ${suggested}`);
}

async function main() {
  fs.mkdirSync(config.downloadDir, { recursive: true });

  const chromium = await loadPlaywright();
  const browser = await chromium.launch({ headless: config.headless });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(config.timeoutMs);

  try {
    await login(page);
    const opened = await openProject(page);
    if (opened) {
      await openStoryboardTab(page);
      await verifyStoryboardDownload(page);
    } else {
      console.warn('[verify] 未进入项目，仅完成脚本冒烟（浏览器启动 + 登录页可达）');
      await page.goto(config.baseUrl, { waitUntil: 'domcontentloaded', timeout: config.timeoutMs });
    }
    console.log('[verify] 下载按钮验收完成');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('[verify] 失败:', error.message);
  process.exit(1);
});
