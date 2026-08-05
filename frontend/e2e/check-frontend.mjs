import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 60000 });
  const rootHTML = await page.locator('#root').innerHTML().catch(() => '');
  const hasRoot = (await page.locator('#root').count()) > 0;
  const loginVisible = await page.getByRole('button', { name: /sign in|google/i }).first().isVisible().catch(() => false);
  const brand = await page.getByText(/Pro Studio Dubbing|Dubnex|Studio/i).first().isVisible().catch(() => false);

  // Firebase init evidence from console env-debug if present
  const logs = [];
  page.on('console', (msg) => logs.push(`${msg.type()}: ${msg.text()}`));

  console.log(JSON.stringify({
    hasRoot,
    rootLen: rootHTML.length,
    loginVisible,
    brand,
    consoleErrors: errors.slice(0, 20),
    pageErrors: pageErrors.slice(0, 20),
  }, null, 2));

  await browser.close();
  if (!hasRoot || rootHTML.length < 20) process.exit(2);
  if (pageErrors.length) process.exit(3);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
