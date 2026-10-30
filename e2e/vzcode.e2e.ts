import {
  test,
  expect,
  Page,
  Locator,
} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// Must match E2E_WORKSPACE in playwright.config.ts / start-backend.ts.
const workspaceDir = path.join(here, '.workspace');

const readWorkspaceFile = (name: string): string =>
  fs.readFileSync(path.join(workspaceDir, name), 'utf8');

const workspaceFileExists = (name: string): boolean =>
  fs.existsSync(path.join(workspaceDir, name));

const expectConnected = async (page: Page) => {
  await expect(
    page.locator('.connection-status'),
  ).toContainText('Connected', { timeout: 30_000 });
};

const openFilesView = async (page: Page) => {
  await page.locator('#files-icon').click();
};

const openFile = async (page: Page, name: string) => {
  await openFilesView(page);
  await page
    .locator('.file-or-directory')
    .filter({ hasText: name })
    .first()
    .click();
};

// A single click opens a transient tab (replaced by the next single
// click); a double click opens a persistent tab.
const openFilePersistent = async (
  page: Page,
  name: string,
) => {
  await openFilesView(page);
  await page
    .locator('.file-or-directory')
    .filter({ hasText: name })
    .first()
    .dblclick();
};

const editor = (page: Page): Locator =>
  page.locator('.cm-content').first();

// Sets a range input and dispatches React-compatible events.
const setRangeValue = async (
  locator: Locator,
  value: number,
) => {
  await locator.evaluate((el, v) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    setter?.call(input, String(v));
    input.dispatchEvent(
      new Event('input', { bubbles: true }),
    );
    input.dispatchEvent(
      new Event('change', { bubbles: true }),
    );
  }, value);
};

test.describe('VZCode browser end-to-end', () => {
  test('loads the app and lists the workspace files', async ({
    page,
  }) => {
    await page.goto('/');
    await expectConnected(page);
    await openFilesView(page);
    const names = await page
      .locator('.file-or-directory .name')
      .allInnerTexts();
    expect(names.join('\n')).toContain('index.js');
    expect(names.join('\n')).toContain('index.html');
    expect(names.join('\n')).toContain('styles.css');
    expect(names.join('\n')).toContain('config.json');
  });

  test('opens, edits, and autosaves a file to disk', async ({
    page,
  }) => {
    await page.goto('/');
    await expectConnected(page);
    await openFile(page, 'index.js');

    const cm = editor(page);
    await expect(cm).toContainText('greeting');
    await cm.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type('\n// e2e autosave marker');

    // Auto-save is debounced on the server; poll the workspace file.
    await expect
      .poll(() => readWorkspaceFile('index.js'), {
        timeout: 20_000,
      })
      .toContain('e2e autosave marker');
  });

  test('opens multiple files as tabs', async ({ page }) => {
    await page.goto('/');
    await expectConnected(page);
    await openFilePersistent(page, 'index.js');
    await openFilePersistent(page, 'styles.css');
    await expect(
      page.locator('.vz-tab-list .tab'),
    ).toHaveCount(2);
    await expect(
      page.locator('.vz-tab-list .tab').first(),
    ).toContainText('index.js');
  });

  test('searches file contents', async ({ page }) => {
    await page.goto('/');
    await expectConnected(page);
    await page.locator('#search-icon').click();
    await page.locator('#searchName').fill('greeting');
    await expect(
      page.locator('.search-file-name').first(),
    ).toContainText('index.js');
  });

  test('opens the AI chat', async ({ page }) => {
    await page.goto('/');
    await expectConnected(page);
    await page.locator('#ai-chat-icon').click();
    await expect(
      page.getByText('How can I help you?'),
    ).toBeVisible();
    await expect(
      page.getByPlaceholder(
        'Ask me to make code changes...',
      ),
    ).toBeVisible();
  });

  test('two clients converge on edits in real time', async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    try {
      await pageA.goto('/');
      await pageB.goto('/');
      await expectConnected(pageA);
      await expectConnected(pageB);

      await openFile(pageA, 'index.js');
      await openFile(pageB, 'index.js');
      await expect(editor(pageA)).toContainText('greeting');
      await expect(editor(pageB)).toContainText('greeting');

      const marker = `converged-${Date.now()}`;
      await editor(pageA).click();
      await pageA.keyboard.press('Control+End');
      await pageA.keyboard.type(`\n// ${marker}`);

      // The other client should observe the edit via ShareDB/OT.
      await expect(editor(pageB)).toContainText(marker, {
        timeout: 20_000,
      });
      // And it should persist to disk.
      await expect
        .poll(() => readWorkspaceFile('index.js'), {
          timeout: 20_000,
        })
        .toContain(marker);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('visual editor updates config.json and notifies the preview iframe', async ({
    page,
  }) => {
    await page.goto('/');
    await expectConnected(page);
    await page.locator('#visual-editor-icon').click();

    // Ensure the preview iframe (and its message listener) has loaded
    // before changing a widget, so the posted config change is received.
    const frame = page.frameLocator('.right iframe');
    await expect(frame.locator('#viz')).toHaveText(
      'initial',
    );

    const slider = page
      .locator('.visual-editor-slider input.slider-input')
      .first();
    await expect(slider).toBeVisible();
    await setRangeValue(slider, 25);

    // The widget writes to config.json (autosaved to the workspace).
    await expect
      .poll(() => readWorkspaceFile('config.json'), {
        timeout: 20_000,
      })
      .toContain('"pointRadius": 25');

    // Config changes are posted to the preview iframe (see useVZCodeState).
    await expect
      .poll(
        async () => {
          try {
            return (
              (await frame.locator('#viz').textContent()) ??
              ''
            );
          } catch {
            return '';
          }
        },
        { timeout: 20_000 },
      )
      .toContain('pointRadius');
  });

  test('creates, renames, and deletes a file', async ({
    page,
  }) => {
    await page.goto('/');
    await expectConnected(page);
    await openFilesView(page);

    // Create
    await page.locator('#new-file-icon').click();
    await page.locator('#fileName').fill('e2e-created.js');
    await page
      .getByRole('button', { name: 'Create File' })
      .click();
    await expect(
      page
        .locator('.file-or-directory')
        .filter({ hasText: 'e2e-created.js' }),
    ).toBeVisible();
    await expect
      .poll(() => workspaceFileExists('e2e-created.js'), {
        timeout: 20_000,
      })
      .toBe(true);

    // Rename
    const created = page
      .locator('.file-or-directory')
      .filter({ hasText: 'e2e-created.js' });
    await created.hover();
    await created.locator('.utils button').first().click();
    // Once renaming, the item no longer matches by text (the name is an
    // input value), so target the rename input globally.
    const renameInput = page.locator('.rename-input');
    await renameInput.waitFor();
    await renameInput.fill('e2e-renamed.js');
    await renameInput.press('Enter');
    await expect(
      page
        .locator('.file-or-directory')
        .filter({ hasText: 'e2e-renamed.js' }),
    ).toBeVisible();
    await expect
      .poll(() => workspaceFileExists('e2e-renamed.js'), {
        timeout: 20_000,
      })
      .toBe(true);

    // Delete
    const renamed = page
      .locator('.file-or-directory')
      .filter({ hasText: 'e2e-renamed.js' });
    await renamed.hover();
    await renamed.locator('.utils button').last().click();
    await page
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    await expect(
      page
        .locator('.file-or-directory')
        .filter({ hasText: 'e2e-renamed.js' }),
    ).toHaveCount(0);
    await expect
      .poll(() => workspaceFileExists('e2e-renamed.js'), {
        timeout: 20_000,
      })
      .toBe(false);
  });

  test('uses AI Studio button and dialog styles', async ({ page }) => {
    await page.goto('/');
    await expectConnected(page);
    await page.locator('#new-file-icon').click();
    await page.locator('#fileName').fill('ui-consistency-test.js');
    const create = page.getByRole('button', { name: 'Create File' });
    await expect(create).toHaveCSS('background-color', 'rgb(3, 102, 214)');
    await expect(create).toHaveCSS('border-radius', '6px');
    await create.hover();
    await expect(create).toHaveCSS('background-color', 'rgb(2, 86, 194)');
    await expect(page.getByRole('dialog')).toHaveCSS('border-radius', '10px');
    await page.keyboard.press('Escape');
  });

  test('sidebar icons support keyboard navigation and selected states', async ({ page }) => {
    await page.goto('/');
    await expectConnected(page);
    const files = page.getByRole('button', { name: 'Files', exact: true });
    const search = page.getByRole('button', { name: 'Search', exact: true });
    await expect(files).toHaveAttribute('aria-pressed', 'true');
    await search.focus();
    await search.press('Enter');
    await expect(search).toHaveAttribute('aria-pressed', 'true');
    await expect(files).toHaveAttribute('aria-pressed', 'false');
    await files.press('Space');
    await expect(files).toHaveAttribute('aria-pressed', 'true');
  });

  test('file tabs expose a keyboard-operable close action', async ({ page }) => {
    await page.goto('/');
    await expectConnected(page);
    await openFile(page, 'index.js');
    const tab = page.getByRole('button', { name: 'index.js', exact: true });
    await expect(tab).toBeVisible();
    await expect(tab).toHaveAttribute('aria-current', 'page');
    await page.getByRole('button', { name: 'Close index.js' }).click();
    await expect(page.locator('.vz-tab-list .tab')).toHaveCount(0);
  });
});
