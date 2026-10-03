import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { appearancePreferences, fastTierForModel, settingsPatch, validateServiceTier, DEFAULT_THEME, themePreference } from '../electron/preferences.mjs';
const models=[{model:'a',isDefault:true,serviceTiers:[{id:'priority',name:'Fast',description:'More usage'}]},{model:'b',additionalSpeedTiers:['fast'],serviceTiers:[]}];
test('Fast is discovered from the current catalog name and ID, not legacy flags',()=>{
  assert.equal(fastTierForModel(models[0]).id,'priority');assert.equal(fastTierForModel(models[1]),null);
  assert.equal(fastTierForModel({serviceTiers:[{id:'future-fast',name:'FAST'}]}).id,'future-fast');
});
test('settings atomically reject invalid values and unsupported Fast mode',()=>{
  const previous={model:'a',fastMode:false,theme:'light'};
  assert.throws(()=>settingsPatch(previous,{theme:'dark',fastMode:'yes'},models));assert.equal(previous.theme,'light');
  assert.throws(()=>settingsPatch(previous,{model:'b',fastMode:true},models),/not available/);
  assert.equal(settingsPatch({model:'a',fastMode:true},{model:'b'},models).fastMode,false);
  assert.equal(settingsPatch(previous,{fastMode:true},models).fastMode,true);
});
test('explicit standard speed clears inherited Fast and arbitrary tiers are rejected',()=>{
  assert.equal(validateServiceTier(models,'a','priority'),'priority');
  assert.equal(validateServiceTier(models,'a','default'),'default');
  assert.throws(()=>validateServiceTier(models,'b','priority'));
  assert.throws(()=>validateServiceTier(models,'unknown','priority'));
});
test('appearance config normalizes legacy and invalid data, validates font names',()=>{
  assert.deepEqual(appearancePreferences({motion:'oops',transcriptSize:'l'}),{motion:'system',interfaceFont:'anthropic',codeFont:'',transcriptSize:'l',transcriptWidth:'s',codeThemeLight:'claude-light',codeThemeDark:'claude-dark',transcriptView:'normal'});
  assert.equal(appearancePreferences({interfaceFont:'dyslexic'}).interfaceFont,'dyslexic');
  assert.equal(settingsPatch({}, {interfaceFont:'dyslexic'}).interfaceFont,'dyslexic');
  assert.throws(()=>settingsPatch({}, {interfaceFont:'comic'}));
  assert.equal(settingsPatch({}, {codeFont:'JetBrains Mono'}).codeFont,'JetBrains Mono');
  assert.throws(()=>settingsPatch({}, {codeFont:'x; color:red'}));
  assert.throws(()=>settingsPatch({}, {codeFont:'x\nfont'}));
  assert.throws(()=>settingsPatch({}, {transcriptWidth:'xxl'}));
});
test('code themes validate against the catalog and their column mode; transcript view has three values',()=>{
  assert.equal(settingsPatch({}, {codeThemeDark:'github-dark'}).codeThemeDark,'github-dark');
  assert.equal(settingsPatch({}, {codeThemeLight:'github-light'}).codeThemeLight,'github-light');
  assert.throws(()=>settingsPatch({}, {codeThemeDark:'github-light'}),/codeThemeDark/);
  assert.throws(()=>settingsPatch({}, {codeThemeLight:'nope'}),/codeThemeLight/);
  assert.throws(()=>settingsPatch({}, {codeThemeLight:'pierre-light'}),/codeThemeLight/);
  const normalized=appearancePreferences({codeThemeLight:'github-dark',codeThemeDark:'dracula'});
  assert.equal(normalized.codeThemeLight,'claude-light');assert.equal(normalized.codeThemeDark,'dracula');
  assert.equal(settingsPatch({}, {transcriptView:'verbose'}).transcriptView,'verbose');
  assert.throws(()=>settingsPatch({}, {transcriptView:'all'}));
  assert.equal(appearancePreferences({transcriptView:'thinking'}).transcriptView,'thinking');
  assert.equal(appearancePreferences({transcriptView:'x'}).transcriptView,'normal');
});
test('the theme defaults to system (shared-7 xh bi("userThemeMode","auto")) and only light/dark/system are kept',()=>{
  assert.equal(DEFAULT_THEME,'system');
  for(const value of ['light','dark','system'])assert.equal(themePreference(value),value);
  for(const value of [undefined,null,'auto','sepia',1])assert.equal(themePreference(value),'system');
  assert.equal(settingsPatch({theme:'light'},{theme:'system'}).theme,'system');
  assert.throws(()=>settingsPatch({},{theme:'auto'}),/theme/);
  // main.cjs seeds new profiles with DEFAULT_THEME, not a hard-coded light.
  const main=readFileSync(new URL('../electron/main.cjs',import.meta.url),'utf8');
  assert.match(main,/theme: DEFAULT_THEME,/);assert.doesNotMatch(main,/theme: "light"/);
});
