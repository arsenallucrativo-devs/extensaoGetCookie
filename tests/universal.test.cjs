const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.join(__dirname, '../ai-platform-poc');

test('universal detector identifies known platforms and heuristics for new AIs', () => {
  const ctx = { globalThis: {}, console };
  vm.runInNewContext(fs.readFileSync(path.join(dir, 'universal-capture.js'), 'utf8'), ctx);
  const { detectPlatform } = ctx.globalThis.AiPlatformPoC;

  assert.equal(detectPlatform('app.klingai.com').toolId, 'kling');
  assert.equal(detectPlatform('klingai.com').name, 'Kling AI');

  assert.equal(detectPlatform('app.runwayml.com').toolId, 'runway');
  assert.equal(detectPlatform('midjourney.com').toolId, 'midjourney');
  assert.equal(detectPlatform('sora.com').toolId, 'sora');

  // Nova IA arbitrária sem cadastro prévio
  const novaIa = detectPlatform('beta.minha-nova-ia.ai');
  assert.equal(novaIa.toolId, 'minha-nova-ia');
  assert.equal(novaIa.plan, 'pro');
});

test('universal extraction builds clean session payload with cookies and detected token', () => {
  const ctx = {
    globalThis: {},
    console,
    navigator: { userAgent: 'test-agent-universal' },
    document: { cookie: 'doc_token=abc' },
    window: {
      localStorage: {
        length: 2,
        key: i => ['token', 'other'][i],
        getItem: k => k === 'token' ? 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.sig' : '123'
      },
      sessionStorage: { length: 0 }
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(dir, 'universal-capture.js'), 'utf8'), ctx);
  const { executeUniversalExtraction } = ctx.globalThis.AiPlatformPoC;

  const payload = executeUniversalExtraction({
    toolId: 'kling',
    accountKey: 'conta-kling-01',
    planType: 'ultra',
    rawCookies: 'kling_sess=xyz987; cf_clearance=cf123'
  });

  assert.equal(payload.toolId, 'kling');
  assert.equal(payload.accountKey, 'conta-kling-01');
  assert.equal(payload.planType, 'ultra');
  assert.equal(payload.label, 'Kling 01 (Ultra)');
  assert.match(payload.cookies, /kling_sess=xyz987/);
  assert.match(payload.cookies, /doc_token=abc/);
  assert.equal(payload.accessToken, 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.sig');
  assert.equal(payload.userAgent, 'test-agent-universal');
});

test('background supports universal fallback query on unknown AI domains', async () => {
  let listener, queries = [];
  const runtime = { onMessage: { addListener: fn => { listener = fn; } } };
  const ctx = {
    URL,
    globalThis: {},
    chrome: {
      runtime,
      cookies: {
        getAll: (q, cb) => {
          queries.push(q);
          cb([{ name: 'session_id', value: 'secret_sess' }]);
        }
      }
    }
  };

  vm.runInNewContext(fs.readFileSync(path.join(dir, 'background.js'), 'utf8'), ctx);

  const sender = { tab: { url: 'https://app.klingai.com/dashboard', cookieStoreId: 'firefox-container-1' } };
  const response = await new Promise(resolve => {
    listener({ action: 'GET_SESSION_COOKIES' }, sender, resolve);
  });

  // Deve ter consultado domínio e subdomínios com storeId preservado
  assert.ok(queries.length >= 1);
  assert.equal(queries[0].storeId, 'firefox-container-1');
  assert.ok(queries.some(q => q.domain === 'klingai.com' || q.domain === '.klingai.com'));
  assert.match(response.cookies, /session_id=secret_sess/);
});
