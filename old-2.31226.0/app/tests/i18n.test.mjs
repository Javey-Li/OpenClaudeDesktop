import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { t, tn, setLocale, getLocale, dictionary, LOCALES, LOCALE_CODES, localePreference, DEFAULT_LOCALE } from '../electron/i18n/index.mjs';
import { settingsPatch } from '../electron/preferences.mjs';

const placeholders = text => [...String(text).matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

test('t returns English in en-US and the zh-CN entry otherwise, with placeholders filled after lookup', (context) => {
  context.after(() => setLocale(DEFAULT_LOCALE));
  assert.equal(getLocale(), 'en-US');
  assert.equal(t('Settings'), 'Settings');
  assert.equal(t('Unknown {thing}', { thing: 'x' }), 'Unknown x');
  setLocale('zh-CN');
  assert.equal(t('Settings'), '设置');
  assert.equal(t('Language'), '语言');
  assert.equal(t('No such string'), 'No such string', 'a missing entry falls back to English');
  assert.equal(t('Left {a} alone', {}), 'Left {a} alone');
  assert.equal(tn(1, '{count} widget', '{count} widgets'), '1 widget');
  assert.equal(setLocale('xx-YY'), 'en-US', 'unknown locales read as the default');
});

test('locale preference: en-US and zh-CN only', () => {
  assert.deepEqual(LOCALE_CODES, ['en-US', 'zh-CN']);
  assert.ok(LOCALES.every(entry => entry.name && entry.localName));
  assert.equal(localePreference('zh-CN'), 'zh-CN');
  assert.equal(localePreference(undefined), 'en-US');
  assert.equal(settingsPatch({}, { locale: 'zh-CN' }).locale, 'zh-CN');
  assert.throws(() => settingsPatch({}, { locale: 'fr-FR' }), /Invalid locale/);
});

test('zh-CN dictionaries: string values, same placeholders as the English key, no empty entries', async () => {
  const dir = new URL('../electron/i18n/zh-CN/', import.meta.url);
  const problems = [];
  for (const file of readdirSync(dir).filter(name => name.endsWith('.mjs') && name !== 'index.mjs')) {
    const table = (await import(new URL(file, dir))).default;
    for (const [key, value] of Object.entries(table)) {
      if (typeof value !== 'string' || !value.trim()) problems.push(`${file}: ${key} → empty or not a string`);
      else if (placeholders(key).join() !== placeholders(value).join()) problems.push(`${file}: ${key} → placeholders differ: ${value}`);
    }
  }
  assert.deepEqual(problems, []);
  assert.ok(Object.keys(dictionary('zh-CN')).length > 0);
});
