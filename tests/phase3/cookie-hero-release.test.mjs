import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';const f=p=>readFileSync(p,'utf8');
test('cookie banner reappears on the new notice version, remembers explicit choice',()=>{const s=f('components/cookie-preferences.tsx');assert.match(s,/businessos_cookie_notice_v3/);assert.match(s,/getCookie\(COOKIE_NAME\)/);assert.match(s,/putCookie\(COOKIE_NAME,choice\)/);assert.match(s,/decision===null/);});
test('privacy panel saves real optional display preference and can revoke it',()=>{const s=f('components/cookie-preferences.tsx');assert.match(s,/businessos_visual_motion_v1/);assert.match(s,/putCookie\(MOTION_COOKIE,'reduce'\)/);assert.match(s,/putCookie\(MOTION_COOKIE,'',0\)/);assert.match(s,/onChange=\{event=>setReduceMotion\(event.target.checked\)\}/);assert.match(s,/Save preferences/);assert.match(s,/Necessary only/);});
test('analytics and marketing are declared inactive, not enabled by false consent',()=>{const s=f('components/cookie-preferences.tsx');assert.match(s,/Not in use/);assert.match(s,/No analytics or advertising cookies are active/);assert.doesNotMatch(s,/gtag\(|fbq\(|GoogleAnalytics|posthog\.init/);});
test('cookie settings can reopen after saving, even from the bottom left or footer',()=>{const s=f('components/cookie-preferences.tsx');assert.match(s,/bo-cookie-floating-trigger/);assert.match(s,/OPEN_COOKIE_SETTINGS_EVENT/);assert.match(f('components/public-footer.tsx'),/CookieSettingsButton/);});
test('hero has real keyboard tabs, reduced motion support, no heavy 3d runtime',()=>{const s=f('components/public-hero-experience.tsx');assert.match(s,/useState/);assert.match(s,/aria-pressed/);assert.match(s,/onPointerMove/);assert.match(s,/pointerType!=='mouse'/);assert.match(s,/prefers-reduced-motion/);assert.match(f('app/page.tsx'),/PublicHeroExperience/);assert.doesNotMatch(f('package.json'),/@react-three\/fiber|@react-three\/drei|three":/);});
test('hero and cookie CSS honor users who choose reduced motion',()=>{const s=f('app/globals.css');assert.match(s,/html\[data-bo-motion='reduce'\] \.bo-showcase-light/);assert.match(s,/\.bo-cookie-dialog-v3/);assert.match(s,/\.bo-cookie-switch input:focus-visible/);});

test('workspace cookie settings stay mounted and first visit notice is not hidden behind route gating',()=>{
 const s=f('components/cookie-preferences.tsx');
 assert.match(s,/if\(!ready\)return null/);
 assert.doesNotMatch(s,/if\(!ready\|\|!publicArea\)return null/);
 assert.match(s,/decision===null&&<aside/);
 assert.match(s,/decision!==null&&publicArea&&<button/);
 assert.match(f('app/(dashboard)/settings/privacy/page.tsx'),/CookieSettingsButton/);
});
