import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getTheme, THEME_BY_REGION, THEMES } from '../src/themes.js';

const CSS_VARIABLES = { accent: '--red', accentBright: '--red-bright', accentLight: '--red-light', accentDark: '--red-dark', accentGlow: '--red-glow' };

const readCssVariables = name => {
	const css = readFileSync(new URL(`../../../apps/web/public/css/themes/${name}.css`, import.meta.url), 'utf8');
	return Object.fromEntries([...css.matchAll(/(--[a-z-]+):\s*([^;]+);/g)].map(([, key, value]) => [key, value.trim()]));
};

for (const [name, theme] of Object.entries(THEMES)) {
	test(`theme "${name}" matches the website CSS`, () => {
		const css = readCssVariables(name);
		for (const [key, variable] of Object.entries(CSS_VARIABLES)) assert.equal(theme[key], css[variable], `${name}.${key}`);
	});
}

test('getTheme resolves the theme from the region and falls back to global', () => {
	assert.equal(getTheme('pl'), THEMES[THEME_BY_REGION.pl]);
	assert.equal(getTheme('all'), THEMES.global);
	assert.equal(getTheme(null), THEMES.global);
});
