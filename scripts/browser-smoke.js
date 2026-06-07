const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const FRONTEND_URL = process.env.BROWSER_SMOKE_FRONTEND_URL || 'http://localhost:8081';
const BACKEND_URL = (process.env.BROWSER_SMOKE_BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');
const ADMIN_URL = process.env.BROWSER_SMOKE_ADMIN_URL || `${BACKEND_URL}/admin-ui/`;
const ADMIN_SECRET = process.env.ADMIN_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'crackl-admin-2026');
const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, options);
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

async function createBrowserSmokeUser() {
  const stamp = Date.now();
  const body = {
    username: `browser_smoke_${String(stamp).slice(-12)}`,
    email: `browser-smoke-${stamp}@example.test`,
    password: `SmokePass${stamp}!`
  };
  const { res, json } = await jsonFetch(`${BACKEND_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  assert(res.ok && json.success && json.user && json.token, `Browser smoke signup failed: ${JSON.stringify(json)}`);
  return { user: json.user, token: json.token };
}

async function waitForAnyText(page, labels, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    for (const label of labels) {
      const count = await page.getByText(label, { exact: false }).count().catch(() => 0);
      if (count > 0) return label;
    }
    await page.waitForTimeout(250);
  }
  throw new Error(`Timed out waiting for any text: ${labels.join(', ')}`);
}

async function main() {
  const health = await jsonFetch(`${BACKEND_URL}/health`);
  assert(health.res.ok && health.json.success, `Backend health failed: ${JSON.stringify(health.json)}`);

  const ready = await jsonFetch(`${BACKEND_URL}/ready`);
  assert(ready.res.ok && ready.json.success, `Backend readiness failed: ${JSON.stringify(ready.json)}`);

  const launchOptions = { headless: true };
  if (fs.existsSync(CHROME_PATH)) launchOptions.executablePath = CHROME_PATH;

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];

  context.on('page', (page) => {
    page.on('pageerror', (error) => pageErrors.push(error.message));
  });

  try {
    const { user, token } = await createBrowserSmokeUser();

    const appPage = await context.newPage();
    await appPage.addInitScript(({ smokeUser, smokeToken }) => {
      window.localStorage.setItem('crackl_user', JSON.stringify(smokeUser));
      window.localStorage.setItem('crackl_token', smokeToken);
    }, { smokeUser: user, smokeToken: token });

    await appPage.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await waitForAnyText(appPage, ['GAME ARENAS', 'STANDARD QUEUE', 'CRACKL']);

    await appPage.getByText('WAR ROOM', { exact: false }).first().click();
    await waitForAnyText(appPage, ['ENGAGEMENT TYPE', 'DEAD HEAT', 'ALLIED OPS']);
    await appPage.getByText('ABORT', { exact: false }).first().click();
    await waitForAnyText(appPage, ['GAME ARENAS', 'STANDARD QUEUE']);

    if (ADMIN_SECRET) {
      const adminPage = await context.newPage();
      await adminPage.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' });
      await adminPage.locator('#server-url').fill(BACKEND_URL);
      await adminPage.locator('#admin-key').fill(ADMIN_SECRET);
      await adminPage.getByRole('button', { name: /enter/i }).click();
      await waitForAnyText(adminPage, ['CRACKL ADMIN', 'Real-Time Overview', 'Riddle Format']);
      await adminPage.getByText('RIDDLE STUDIO', { exact: false }).first().click().catch(() => {});
      await waitForAnyText(adminPage, ['Riddle Format', 'Upload Media', 'Layout Elements']);
    }

    assert(pageErrors.length === 0, `Browser page errors: ${pageErrors.join(' | ')}`);
    console.log(JSON.stringify({
      ok: true,
      frontend: FRONTEND_URL,
      backend: BACKEND_URL,
      adminChecked: !!ADMIN_SECRET,
      checks: ['backend-health', 'backend-ready', 'frontend-home', 'war-room-setup', 'admin-login']
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
