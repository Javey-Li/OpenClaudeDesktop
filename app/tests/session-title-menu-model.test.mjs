import test from 'node:test';
import assert from 'node:assert/strict';
import { setLocale, DEFAULT_LOCALE } from '../electron/i18n/index.mjs';
import { sessionMenuTriggerLabel, viewOptionsLabel, titleOverflows, titleTooltipContent, renameSubmission, renameSubmittable, RENAME_START_DELAY_MS }
  from '../src/session-title-menu-model.mjs';

// c593f7513 wm (readable 7520-7540): Be = title.trim(); Ve = Be ? "More options for {label}" : "More options";
// He = "View options".
test('header menu trigger labels follow wm', (context) => {
  context.after(() => setLocale(DEFAULT_LOCALE));
  assert.equal(sessionMenuTriggerLabel('  Fix login  '), 'More options for Fix login');
  assert.equal(sessionMenuTriggerLabel('   '), 'More options');
  assert.equal(sessionMenuTriggerLabel(undefined), 'More options');
  assert.equal(viewOptionsLabel(), 'View options');
  assert.equal(viewOptionsLabel(true), 'View options (a dev server or command is running)');
  setLocale('zh-CN');
  assert.equal(sessionMenuTriggerLabel('修复'), '“修复”的更多选项');
  assert.equal(sessionMenuTriggerLabel(''), '更多选项');
  assert.equal(viewOptionsLabel(), '视图选项');
  assert.equal(viewOptionsLabel(true), '视图选项（有开发服务器或命令正在运行）');
});

// c593f7513 vm (7270-7300): _ = scrollWidth > clientWidth ? title : undefined; v = _() ?? "Rename".
test('the title tooltip is the full title only while it is truncated', () => {
  assert.equal(titleTooltipContent({ scrollWidth: 300, clientWidth: 120 }, 'A long session title'), 'A long session title');
  assert.equal(titleTooltipContent({ scrollWidth: 120, clientWidth: 120 }, 'Short'), 'Rename');
  assert.equal(titleTooltipContent(null, 'Unmounted'), 'Rename');
  assert.equal(titleOverflows({ scrollWidth: 121, clientWidth: 120 }), true);
  assert.equal(titleOverflows({ scrollWidth: 120.4, clientWidth: 120 }), true, 'no subpixel allowance, as vm');
});

// shared-16 Jd (5027-5120): b() trims, closes, and calls onRename only when the name changed; a blank name does nothing.
test('Rename session dialog submission follows Jd', () => {
  assert.deepEqual(renameSubmission('  New name  ', 'Old name'), { close: true, name: 'New name' });
  assert.deepEqual(renameSubmission('Old name', 'Old name'), { close: true }, 'unchanged: closes without a rename');
  assert.deepEqual(renameSubmission('  Old name ', 'Old name'), { close: true }, 'only whitespace added: no rename');
  assert.deepEqual(renameSubmission('   ', 'Old name'), { close: false });
  assert.deepEqual(renameSubmission('', ''), { close: false });
  assert.deepEqual(renameSubmission('Named', ''), { close: true, name: 'Named' });
  assert.equal(renameSubmittable(' x '), true);
  assert.equal(renameSubmittable(' \t'), false);
  assert.equal(renameSubmittable(undefined), false);
  // shared-21 IV: onRenameStart runs through the xV = 100ms deferral after the menu closes.
  assert.equal(RENAME_START_DELAY_MS, 100);
});
