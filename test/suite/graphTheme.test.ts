import * as assert from 'assert';
import {
  DARK_GRAPH_THEME,
  LIGHT_GRAPH_THEME,
  themeToCssVars,
  themeToJsObject
} from '../../src/ui/webview/graphTheme';

describe('graphTheme', () => {
  it('menggunakan palette light dan dark yang berbeda', () => {
    assert.strictEqual(LIGHT_GRAPH_THEME.mode, 'light');
    assert.strictEqual(DARK_GRAPH_THEME.mode, 'dark');
    assert.notStrictEqual(LIGHT_GRAPH_THEME.bg, DARK_GRAPH_THEME.bg);
    assert.notStrictEqual(LIGHT_GRAPH_THEME.text, DARK_GRAPH_THEME.text);
    assert.notStrictEqual(LIGHT_GRAPH_THEME.function, DARK_GRAPH_THEME.function);
  });

  it('themeToCssVars menyertakan --bg dan file card tokens', () => {
    const css = themeToCssVars(LIGHT_GRAPH_THEME);
    assert.ok(css.includes('--bg:'));
    assert.ok(css.includes(LIGHT_GRAPH_THEME.bg));
    assert.ok(css.includes('--text:'));
    assert.ok(css.includes('--imports:'));
    assert.ok(css.includes('--file-text:'));
    assert.strictEqual(LIGHT_GRAPH_THEME.file, '#FFF7ED');
    assert.strictEqual(LIGHT_GRAPH_THEME.fileBorder, '#FDBA74');
    assert.strictEqual(LIGHT_GRAPH_THEME.fileText, '#C2410C');
  });

  it('themeToJsObject menghasilkan JSON theme yang valid', () => {
    const parsed = JSON.parse(themeToJsObject(DARK_GRAPH_THEME));
    assert.strictEqual(parsed.mode, 'dark');
    assert.strictEqual(parsed.bg, DARK_GRAPH_THEME.bg);
  });
});
