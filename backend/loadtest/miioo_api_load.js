import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import exec from 'k6/execution';
import { Counter, Rate } from 'k6/metrics';

const BASE_URL = stripTrailingSlash(__ENV.BASE_URL || 'http://127.0.0.1:8000');
const TOKEN = (__ENV.TOKEN || '').trim();
const PROJECT_ID = (__ENV.PROJECT_ID || '').trim();
const TASK_ID = (__ENV.TASK_ID || '').trim();
const TASK_STATUS_PATH = ((__ENV.TASK_STATUS_PATH || '').trim()) || (TASK_ID ? `/api/tasks/${TASK_ID}` : '');

const ENABLE_PROJECT_READS = toBool(__ENV.ENABLE_PROJECT_READS, true);
const ENABLE_EPISODE_READS = toBool(__ENV.ENABLE_EPISODE_READS, Boolean(PROJECT_ID));
const ENABLE_STORYBOARD_READS = toBool(__ENV.ENABLE_STORYBOARD_READS, Boolean(PROJECT_ID));
const ENABLE_TASK_POLL = toBool(__ENV.ENABLE_TASK_POLL, Boolean(TASK_STATUS_PATH));
const ENABLE_PROJECT_CREATE = toBool(__ENV.ENABLE_PROJECT_CREATE, false);

const READ_START_VUS = toInt(__ENV.READ_START_VUS, 0);
const READ_STAGE1_VUS = toInt(__ENV.READ_STAGE1_VUS, 20);
const READ_STAGE2_VUS = toInt(__ENV.READ_STAGE2_VUS, 50);
const READ_STAGE3_VUS = toInt(__ENV.READ_STAGE3_VUS, 100);
const READ_STAGE1_DURATION = __ENV.READ_STAGE1_DURATION || '30s';
const READ_STAGE2_DURATION = __ENV.READ_STAGE2_DURATION || '1m';
const READ_STAGE3_DURATION = __ENV.READ_STAGE3_DURATION || '1m';
const READ_RAMPDOWN_DURATION = __ENV.READ_RAMPDOWN_DURATION || '20s';
const READ_SLEEP_SECONDS = toFloat(__ENV.READ_SLEEP_SECONDS, 1);

const TASK_POLL_VUS = toInt(__ENV.TASK_POLL_VUS, 20);
const TASK_POLL_DURATION = __ENV.TASK_POLL_DURATION || '1m';
const TASK_POLL_SLEEP_SECONDS = toFloat(__ENV.TASK_POLL_SLEEP_SECONDS, 2);

const WRITE_RATE = toInt(__ENV.WRITE_RATE, 1);
const WRITE_DURATION = __ENV.WRITE_DURATION || '30s';
const WRITE_PREALLOCATED_VUS = toInt(__ENV.WRITE_PREALLOCATED_VUS, 2);
const WRITE_MAX_VUS = toInt(__ENV.WRITE_MAX_VUS, 10);
const WRITE_PROJECT_PREFIX = (__ENV.WRITE_PROJECT_PREFIX || 'loadtest-project').trim();

const businessFailures = new Counter('business_failures');
const unexpectedStatusRate = new Rate('unexpected_status_rate');

const scenarios = {};

if (ENABLE_PROJECT_READS || ENABLE_EPISODE_READS || ENABLE_STORYBOARD_READS) {
  scenarios.read_baseline = {
    executor: 'ramping-vus',
    exec: 'readBaseline',
    startVUs: READ_START_VUS,
    gracefulRampDown: '5s',
    stages: [
      { duration: READ_STAGE1_DURATION, target: READ_STAGE1_VUS },
      { duration: READ_STAGE2_DURATION, target: READ_STAGE2_VUS },
      { duration: READ_STAGE3_DURATION, target: READ_STAGE3_VUS },
      { duration: READ_RAMPDOWN_DURATION, target: 0 },
    ],
  };
}

if (ENABLE_TASK_POLL) {
  scenarios.task_poll = {
    executor: 'constant-vus',
    exec: 'pollTaskStatus',
    vus: TASK_POLL_VUS,
    duration: TASK_POLL_DURATION,
    startTime: '5s',
  };
}

if (ENABLE_PROJECT_CREATE) {
  scenarios.create_project = {
    executor: 'constant-arrival-rate',
    exec: 'createProject',
    rate: WRITE_RATE,
    timeUnit: '1s',
    duration: WRITE_DURATION,
    preAllocatedVUs: WRITE_PREALLOCATED_VUS,
    maxVUs: WRITE_MAX_VUS,
    startTime: '5s',
  };
}

export const options = {
  scenarios,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
    unexpected_status_rate: ['rate<0.01'],
  },
};

export function setup() {
  if (!Object.keys(options.scenarios).length) {
    fail('没有启用任何场景，请至少开启一种读/轮询/写入压测场景。');
  }

  if (!TOKEN) {
    fail('缺少 TOKEN 环境变量。请先准备测试账号的 access_token。');
  }

  if ((ENABLE_EPISODE_READS || ENABLE_STORYBOARD_READS) && !PROJECT_ID) {
    fail('已启用项目级读取，但缺少 PROJECT_ID。');
  }

  if (ENABLE_TASK_POLL && !TASK_STATUS_PATH) {
    fail('已启用任务轮询，但缺少 TASK_STATUS_PATH 或 TASK_ID。');
  }

  const authHeaders = {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  };

  const meRes = http.get(`${BASE_URL}/api/auth/me`, {
    headers: authHeaders,
    tags: { endpoint: 'auth_me', phase: 'setup' },
  });

  const meOk = check(meRes, {
    'setup auth/me is 200': (res) => res.status === 200,
  });

  if (!meOk) {
    fail(`认证预检失败，/api/auth/me 返回 ${meRes.status}`);
  }

  return { authHeaders };
}

export function readBaseline(data) {
  const requests = [
    {
      method: 'GET',
      url: `${BASE_URL}/api/projects`,
      params: withTags(data.authHeaders, { endpoint: 'projects_list', kind: 'read' }),
    },
    {
      method: 'GET',
      url: `${BASE_URL}/api/models?category=image`,
      params: withTags(data.authHeaders, { endpoint: 'models_image', kind: 'read' }),
    },
    {
      method: 'GET',
      url: `${BASE_URL}/api/models?category=video`,
      params: withTags(data.authHeaders, { endpoint: 'models_video', kind: 'read' }),
    },
  ];

  if (ENABLE_EPISODE_READS) {
    requests.push({
      method: 'GET',
      url: `${BASE_URL}/api/projects/${PROJECT_ID}/episodes`,
      params: withTags(data.authHeaders, { endpoint: 'episodes_list', kind: 'read' }),
    });
  }

  if (ENABLE_STORYBOARD_READS) {
    requests.push({
      method: 'GET',
      url: `${BASE_URL}/api/projects/${PROJECT_ID}/storyboards`,
      params: withTags(data.authHeaders, { endpoint: 'storyboards_list', kind: 'read' }),
    });
  }

  const responses = http.batch(requests);
  for (const response of responses) {
    assertJsonOk(response, [200]);
  }

  sleep(READ_SLEEP_SECONDS);
}

export function pollTaskStatus(data) {
  const response = http.get(`${BASE_URL}${TASK_STATUS_PATH}`, withTags(data.authHeaders, {
    endpoint: 'task_status',
    kind: 'poll',
  }));

  const ok = assertJsonOk(response, [200]);
  if (ok) {
    const payload = safeJson(response);
    const status = payload?.status || payload?.raw_status || 'unknown';
    check(payload, {
      'task payload has status': (body) => typeof status === 'string' && status.length > 0,
    });
  }

  sleep(TASK_POLL_SLEEP_SECONDS);
}

export function createProject(data) {
  const iteration = exec.scenario.iterationInTest;
  const projectName = `${WRITE_PROJECT_PREFIX}-${iteration}-${Date.now()}`;
  const payload = {
    name: projectName,
    description: 'Created by k6 load test script',
    aspect_ratio: '16:9',
    visual_style: '电影感',
    project_type: 'video',
  };

  const response = http.post(
    `${BASE_URL}/api/projects`,
    JSON.stringify(payload),
    withTags(data.authHeaders, { endpoint: 'projects_create', kind: 'write' }),
  );

  const ok = assertJsonOk(response, [200, 201]);
  if (ok) {
    const body = safeJson(response);
    check(body, {
      'create project returns id': (json) => typeof json?.id === 'string' && json.id.length > 0,
    });
  }
}

function assertJsonOk(response, allowedStatusCodes) {
  const ok = check(response, {
    [`status in ${allowedStatusCodes.join('/')}`]: (res) => allowedStatusCodes.includes(res.status),
  });

  if (!ok) {
    businessFailures.add(1);
    unexpectedStatusRate.add(1);
    console.error(
      `[${response.request.method}] ${response.url} -> ${response.status} | ${truncate(response.body, 400)}`,
    );
    return false;
  }

  unexpectedStatusRate.add(0);
  return true;
}

function withTags(headers, tags) {
  return {
    headers,
    tags,
  };
}

function safeJson(response) {
  try {
    return response.json();
  } catch (_error) {
    return null;
  }
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function truncate(value, maxLength) {
  if (!value || value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}...`;
}

function toBool(value, fallbackValue) {
  if (value === undefined || value === null || value === '') {
    return fallbackValue;
  }

  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function toInt(value, fallbackValue) {
  if (value === undefined || value === null || value === '') {
    return fallbackValue;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallbackValue;
}

function toFloat(value, fallbackValue) {
  if (value === undefined || value === null || value === '') {
    return fallbackValue;
  }

  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : fallbackValue;
}
