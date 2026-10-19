// 19.10: проверка значка «З» и подписи платформы на страницах claim (index, contract, cancel). Что проверяется:
//  1) значок вкладки: <link rel="icon"> — тот же SVG, что на zaedem.by (тёмно-зелёный #0F2D1D, лаймовая «З» #c9f135),
//     <link rel="apple-touch-icon"> и сам файл /apple-touch-icon.png отдаётся и совпадает с файлом сайта;
//  2) логотип в шапке «Заедем.by» на месте: тот же шрифт Unbounded, лайм + белое «.by»;
//  3) подпись платформы в подвале — «Белорусская платформа бронирования жилья»; старых вариантов
//     («Платформа бронирования жилья» без «Белорусская», «агрегатор отелей») нет ни в тексте, ни в title, ни в исходнике;
//  4) страницы работают как раньше: claim (форма, отправка, отказ), contract (отправка данных гостей),
//     cancel — отмена брони по ссылке из ваучера «cancel.html?t=…» (с заглушкой API: проверяется, что
//     в POST /api/bookings/cancel/<номер> уходит токен, и что бронь после ответа показана отменённой; отказ сервера —
//     бронь остаётся, кнопка снова доступна; уже отменённая бронь);
//  5) ошибок в консоли нет, горизонтальной прокрутки нет;
//  6) экран «Бронь отменена» показывает refund_text из ответа бэкенда (порция 39, zaedem-backend#21) как есть:
//     полный возврат, возврат с удержанием, тестовая бронь (+ текст приходит с сервера — разметка в нём не исполняется);
//     в ответе без refund_text — прежний текст «Возврат средств — по правилам объекта».
// Все ответы API — заглушки (https://api.zaedem.by перехватывается), шрифты Google — пустой CSS, страницы
// отдаются локально. Экраны: 390×844 (тач) и 1366×768. Запуск из корня репозитория:
//   node .github/znachok-test/znachok_19_10.test.js        (ZB_VP=390|1366 — только один экран)
// Папка .github не попадает на GitHub Pages.
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const cp = require('child_process');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(cp.execSync('npm root -g').toString().trim() + '/playwright'); }

const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = path.join(__dirname, 'shots_19_10');
fs.mkdirSync(SHOTS, { recursive: true });

// Эталон: разметка значка из zaedem-frontend (oferta.html, PR frontend #1 от 11.10) — копия строки как есть.
const ICON_HREF = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230F2D1D'/%3E%3Cpath d='M32.18 44.4Q27.8 44.4 25.14 42.65Q22.47 40.89 21.19 37.2L26.09 35.47Q27.8 40.17 32.18 40.17Q34.58 40.17 35.82 39.17Q37.06 38.18 37.06 36.38Q37.06 34.51 35.59 33.68Q34.11 32.85 30.97 32.85H29.88V28.64H30.97Q33.78 28.64 35.11 27.75Q36.45 26.86 36.45 25Q36.45 23.31 35.31 22.42Q34.17 21.53 32.16 21.53Q28.23 21.53 26.82 26.11L21.84 24.98Q23.12 21.18 25.69 19.34Q28.26 17.5 32.25 17.5Q36.54 17.5 39.14 19.35Q41.74 21.19 41.74 24.31Q41.74 26.71 40.42 28.3Q39.11 29.9 36.54 30.55Q39.35 30.96 40.88 32.56Q42.41 34.15 42.41 36.6Q42.41 40.17 39.64 42.28Q36.88 44.4 32.18 44.4Z' fill='%23c9f135'/%3E%3C/svg%3E";
const APPLE_HREF = '/apple-touch-icon.png';
// sha256 файла apple-touch-icon.png из zaedem-frontend (main на 19.10)
const APPLE_SHA = '96b875dd92a0bc65cebe59afe44d65ba22851d6fec11cf0bfaa559dfe646aec6';
const FOOT = 'Заедем.by · Белорусская платформа бронирования жилья';

const TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718';
const NUM = 'ZB-260101';

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, resp) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      // ссылки как в письмах: /claim/<токен> и /contract/<токен> отдают index.html и contract.html
      if (/^\/claim\/[^/]+\/?$/.test(p)) p = '/index.html';
      else if (/^\/contract\/[^/]+\/?$/.test(p)) p = '/contract.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { resp.writeHead(404); return resp.end('nf'); }
      const ct = { '.html': 'text/html; charset=utf-8', '.png': 'image/png' }[path.extname(f)] || 'application/octet-stream';
      resp.writeHead(200, { 'Content-Type': ct });
      fs.createReadStream(f).pipe(resp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });

const results = [];
function check(name, ok, info) { results.push({ name, ok: !!ok, info: info || '' }); console.log((ok ? '  ✔ ' : '  ✘ ') + name + (info && !ok ? ' — ' + info : '')); }

// Сценарии заглушек API
function futureDate(days) { const d = new Date(Date.now() + days * 86400000); return d.toISOString().slice(0, 10); }
const BOOKING = { booking_num: NUM, hotel_name: 'Усадьба «Тестовая»', check_in: futureDate(20), check_out: futureDate(23), guests_count: 2, guest_name: 'Иванов Иван Иванович', status: 'confirmed', cancel_rules: 'Бесплатная отмена за 3 дня до заезда.' };

async function open(browser, base, vp, apiState) {
  const isTouch = vp === 390;
  const ctx = await browser.newContext(isTouch
    ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', async d => { apiState.dialogs.push(d.message()); await d.accept(); });
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('https://fonts.gstatic.com/**', r => r.fulfill({ status: 200, contentType: 'font/woff2', body: '' }));
  await page.route('https://api.zaedem.by/**', async route => {
    const req = route.request(); const u = new URL(req.url()); const m = req.method();
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    apiState.calls.push({ m, p: u.pathname, body: req.postData() });
    return apiState.handler(route, u, m, req);
  });
  return { ctx, page, errors };
}

function mkState(handler) { return { calls: [], dialogs: [], handler }; }

async function commonChecks(page, errors, label, vp) {
  const hasH = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  check(label + ': нет горизонтальной прокрутки', !hasH);
  check(label + ': ошибок в консоли нет', errors.length === 0, errors.join(' | '));
}

async function staticChecks(page, base, file, label) {
  const icon = await page.evaluate(() => { const l = document.querySelector('link[rel="icon"]'); return l ? { href: l.getAttribute('href'), type: l.getAttribute('type') } : null; });
  check(label + ': значок вкладки — тот же SVG, что на zaedem.by', icon && icon.href === ICON_HREF && icon.type === 'image/svg+xml', icon && icon.href.slice(0, 60));
  const apple = await page.evaluate(() => { const l = document.querySelector('link[rel="apple-touch-icon"]'); return l ? l.getAttribute('href') : null; });
  check(label + ': apple-touch-icon указан', apple === APPLE_HREF, String(apple));
  // значок как картинка: SVG из ссылки рисуется (проверяем, что это валидная картинка нужного цвета)
  const px = await page.evaluate(async href => {
    const img = new Image(); img.src = href; await img.decode();
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 64, 64);
    const bg = x.getImageData(32, 3, 1, 1).data; // фон плитки (над «З»)
    let lime = 0; const d = x.getImageData(0, 0, 64, 64).data;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 170 && d[i + 1] > 215 && d[i + 2] < 110) lime++;
    return { bg: [bg[0], bg[1], bg[2]], lime };
  }, ICON_HREF);
  check(label + ': значок рисуется — фон #0F2D1D и лаймовая «З»', px.bg[0] === 15 && px.bg[1] === 45 && px.bg[2] === 29 && px.lime > 100, JSON.stringify(px));
  const r = await page.evaluate(async () => { const x = await fetch('/apple-touch-icon.png'); const b = new Uint8Array(await x.arrayBuffer()); const h = await crypto.subtle.digest('SHA-256', b); return { ok: x.ok, type: x.headers.get('content-type'), len: b.length, sha: [...new Uint8Array(h)].map(v => v.toString(16).padStart(2, '0')).join('') }; });
  check(label + ': файл /apple-touch-icon.png отдаётся (image/png) и совпадает с файлом сайта', r.ok && r.type === 'image/png' && r.sha === APPLE_SHA, JSON.stringify(r));

  const logo = await page.evaluate(() => {
    const l = document.querySelector('.hero .logo'); if (!l) return null;
    const cs = getComputedStyle(l), em = l.querySelector('em'), rect = l.getBoundingClientRect();
    return { text: l.textContent.trim(), color: cs.color, font: cs.fontFamily, emColor: em && getComputedStyle(em).color, w: rect.width, h: rect.height };
  });
  check(label + ': логотип в шапке «Заедем.by» (Unbounded, лайм + белое «.by»)', logo && logo.text === 'Заедем.by' && logo.color === 'rgb(201, 241, 53)' && /Unbounded/.test(logo.font) && logo.emColor === 'rgb(255, 255, 255)' && logo.w > 60 && logo.h > 10, JSON.stringify(logo));

  const foot = await page.evaluate(() => { const f = document.querySelector('.foot'); return f ? f.textContent.trim() : null; });
  check(label + ': подпись платформы в подвале', foot === FOOT, String(foot));
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const seen = await page.evaluate(() => ({ title: document.title, text: document.body.innerText, metas: [...document.querySelectorAll('meta[name=description],meta[property="og:description"],meta[property="og:title"]')].map(m => m.content).join(' ') }));
  const old = [/агрегатор/i, /(?<!Белорусская )[Пп]латформа бронирования жилья/];
  const bad = old.filter(re => re.test(html) || re.test(seen.title) || re.test(seen.text) || re.test(seen.metas));
  check(label + ': старых вариантов подписи нет (title, текст, мета, исходник)', bad.length === 0, bad.map(String).join(','));
}

async function testClaim(browser, base, vp) {
  const L = vp + ' claim';
  const st = mkState(async (route, u, m, req) => {
    if (u.pathname === '/api/hotels/claim/' + TOKEN && m === 'GET') return json(route, 200, { ok: true, draft: { name_ru: 'Усадьба «Тестовая»', address: 'д. Тестовая, 1', description_ru: 'Описание', photos: [], phone: '+375291112233', email: 'o@example.by', city_id: 2, contact_tg: '', contact_wa: '', contact_viber: '', house_rules: '', cancel_rules: '' } });
    if (u.pathname === '/api/cities') return json(route, 200, [{ id: 1, name_ru: 'Минск' }, { id: 2, name_ru: 'Гродно' }]);
    if (u.pathname === '/api/hotels/claim/' + TOKEN && m === 'POST') return json(route, 200, { ok: true, message: 'Объект принят (заглушка)' });
    return json(route, 404, { error: 'нет заглушки' });
  });
  const { ctx, page, errors } = await open(browser, base, vp, st);
  await page.goto(base + '/claim/' + TOKEN, { waitUntil: 'load' });
  await page.waitForSelector('#c-name');
  await page.waitForSelector('#c-city option[value="2"]', { state: 'attached' });
  await staticChecks(page, base, 'index.html', L);
  check(L + ': форма загрузилась из ответа заглушки, город выбран', (await page.inputValue('#c-name')) === 'Усадьба «Тестовая»' && (await page.inputValue('#c-city')) === '2');
  await page.screenshot({ path: path.join(SHOTS, vp + '_1_claim_forma.png'), fullPage: false });
  // без галочки согласия — отправки нет
  await page.click('#c-submit');
  check(L + ': без галочки согласия запрос не уходит', !st.calls.some(c => c.m === 'POST') && st.dialogs.some(d => /согласие/.test(d)));
  await page.check('#c-agree');
  await page.fill('#c-opass', '12345678');
  await page.click('#c-submit');
  await page.waitForSelector('.msg h2');
  const post = st.calls.find(c => c.m === 'POST');
  const body = post && JSON.parse(post.body);
  check(L + ': отправка — POST с согласием, городом и паролем', body && body.agree === true && String(body.city_id) === '2' && body.owner_password === '12345678' && body.name_ru === 'Усадьба «Тестовая»', post && post.body);
  check(L + ': экран «Готово!» с текстом сервера', (await page.textContent('.msg h2')) === 'Готово!' && /заглушка/.test(await page.textContent('.msg p')));
  await page.screenshot({ path: path.join(SHOTS, vp + '_2_claim_gotovo.png'), fullPage: false });
  await commonChecks(page, errors, L, vp);
  await ctx.close();
}

async function testClaimBadToken(browser, base, vp) {
  const L = vp + ' claim (недействительная ссылка)';
  const st = mkState((route) => json(route, 200, { ok: false, error: 'Ссылка недействительна (заглушка)' }));
  const { ctx, page, errors } = await open(browser, base, vp, st);
  await page.goto(base + '/claim/' + TOKEN, { waitUntil: 'load' });
  await page.waitForSelector('.msg h2');
  check(L + ': «Ссылка недействительна» и подвал на месте', (await page.textContent('.msg h2')) === 'Ссылка недействительна' && (await page.textContent('.foot')).trim() === FOOT);
  await commonChecks(page, errors, L, vp);
  await ctx.close();
}

async function testContract(browser, base, vp) {
  const L = vp + ' contract';
  const st = mkState(async (route, u, m) => {
    if (u.pathname === '/api/bookings/contract/' + TOKEN && m === 'GET') return json(route, 200, { ok: true, booking: { ...BOOKING, guests_count: 2 } });
    if (u.pathname === '/api/bookings/contract/' + TOKEN && m === 'POST') return json(route, 200, { ok: true, message: 'Данные отправлены (заглушка)' });
    return json(route, 404, { error: 'нет заглушки' });
  });
  const { ctx, page, errors } = await open(browser, base, vp, st);
  await page.goto(base + '/contract/' + TOKEN, { waitUntil: 'load' });
  await page.waitForSelector('.gblock');
  await staticChecks(page, base, 'contract.html', L);
  check(L + ': по числу гостей из брони — 2 блока, первый предзаполнен из ФИО', (await page.locator('.gblock').count()) === 2 && (await page.inputValue('[data-i="0"][data-k="last"]')) === 'Иванов');
  await page.screenshot({ path: path.join(SHOTS, vp + '_3_contract_forma.png'), fullPage: false });
  await page.fill('[data-i="1"][data-k="last"]', 'Петрова');
  await page.fill('[data-i="1"][data-k="first"]', 'Анна');
  await page.check('#c-agree');
  await page.click('#c-submit');
  await page.waitForSelector('.msg h2');
  const post = st.calls.find(c => c.m === 'POST'); const body = post && JSON.parse(post.body);
  check(L + ': отправка — POST с двумя гостями и согласием', body && body.agree === true && body.guests.length === 2 && body.guests[1].last === 'Петрова', post && post.body);
  check(L + ': экран «Спасибо!»', (await page.textContent('.msg h2')) === 'Спасибо!');
  await commonChecks(page, errors, L, vp);
  await ctx.close();
}

async function testCancel(browser, base, vp) {
  const L = vp + ' cancel';
  // 1) отмена по ссылке из ваучера: cancel.html?t=<токен>
  let st = mkState(async (route, u, m) => {
    if (u.pathname === '/api/bookings/manage/' + TOKEN && m === 'GET') return json(route, 200, { booking: BOOKING, manage_token: TOKEN });
    if (u.pathname === '/api/bookings/cancel/' + NUM && m === 'POST') return json(route, 200, { success: true, booking_num: NUM, status: 'cancelled' });
    return json(route, 404, { error: 'нет заглушки' });
  });
  let { ctx, page, errors } = await open(browser, base, vp, st);
  await page.goto(base + '/cancel.html?t=' + TOKEN, { waitUntil: 'load' });
  await page.waitForSelector('#cx-btn');
  await staticChecks(page, base, 'cancel.html', L);
  check(L + ': показаны объект, номер брони и правила отмены', /Тестовая/.test(await page.textContent('.book-t')) && (await page.textContent('.book-m')).includes(NUM) && /Бесплатная отмена за 3 дня/.test(await page.textContent('.rules')));
  await page.screenshot({ path: path.join(SHOTS, vp + '_4_cancel_pravila.png'), fullPage: false });
  await page.click('#cx-btn');
  await page.waitForSelector('.msg h2');
  const post = st.calls.find(c => c.m === 'POST');
  check(L + ': подтверждение «Точно отменить бронь ZB-…?» показано', st.dialogs.some(d => d.includes(NUM)), st.dialogs.join('|'));
  check(L + ': в POST /api/bookings/cancel/' + NUM + ' ушёл токен из ссылки', post && post.p === '/api/bookings/cancel/' + NUM && JSON.parse(post.body).token === TOKEN, post && post.body);
  check(L + ': экран «Бронь отменена»', (await page.textContent('.msg h2')) === 'Бронь отменена' && /Возврат средств — по правилам объекта/.test(await page.textContent('.msg p')));
  await page.screenshot({ path: path.join(SHOTS, vp + '_5_cancel_otmenena.png'), fullPage: false });
  await commonChecks(page, errors, L + ' (отмена)', vp);
  await ctx.close();

  // 2) ссылка в виде #токен — как раньше
  st = mkState(async (route, u, m) => {
    if (u.pathname === '/api/bookings/manage/' + TOKEN) return json(route, 200, { booking: BOOKING });
    return json(route, 404, { error: 'нет заглушки' });
  });
  ({ ctx, page, errors } = await open(browser, base, vp, st));
  await page.goto(base + '/cancel.html#' + TOKEN, { waitUntil: 'load' });
  await page.waitForSelector('#cx-btn');
  check(L + ': ссылка с #токеном открывает бронь', (await page.textContent('.book-m')).includes(NUM));
  await ctx.close();

  // 3) сервер отказал в отмене (400) — бронь остаётся, кнопка снова доступна, текст сервера показан
  st = mkState(async (route, u, m) => {
    if (u.pathname === '/api/bookings/manage/' + TOKEN) return json(route, 200, { booking: BOOKING });
    if (u.pathname === '/api/bookings/cancel/' + NUM) return json(route, 400, { error: 'Тариф этой брони невозвратный — онлайн-отмена недоступна (заглушка)' });
    return json(route, 404, { error: 'нет заглушки' });
  });
  ({ ctx, page, errors } = await open(browser, base, vp, st));
  await page.goto(base + '/cancel.html?t=' + TOKEN, { waitUntil: 'load' });
  await page.waitForSelector('#cx-btn');
  await page.click('#cx-btn');
  await page.waitForFunction(() => { const b = document.getElementById('cx-btn'); return b && !b.disabled && b.textContent === 'Отменить бронь'; });
  check(L + ': отказ сервера — показан его текст, бронь не отменена, кнопка снова активна', st.dialogs.some(d => /невозвратный/.test(d)) && (await page.locator('.msg h2').count()) === 0);
  await ctx.close();

  // 4) бронь уже отменена
  st = mkState(async (route, u, m) => {
    if (u.pathname === '/api/bookings/manage/' + TOKEN) return json(route, 200, { booking: { ...BOOKING, status: 'cancelled' } });
    return json(route, 404, { error: 'нет заглушки' });
  });
  ({ ctx, page, errors } = await open(browser, base, vp, st));
  await page.goto(base + '/cancel.html?t=' + TOKEN, { waitUntil: 'load' });
  await page.waitForSelector('.msg h2');
  check(L + ': уже отменённая бронь — «Бронь уже отменена», кнопки отмены нет', (await page.textContent('.msg h2')) === 'Бронь уже отменена' && (await page.locator('#cx-btn').count()) === 0);
  await ctx.close();

  // 5) ссылка без токена
  st = mkState((route) => json(route, 404, { error: 'нет заглушки' }));
  ({ ctx, page, errors } = await open(browser, base, vp, st));
  await page.goto(base + '/cancel.html', { waitUntil: 'load' });
  await page.waitForSelector('.msg h2');
  check(L + ': ссылка без токена — «Ссылка неполная», запросов к API нет', (await page.textContent('.msg h2')) === 'Ссылка неполная' && st.calls.length === 0);
  await commonChecks(page, errors, L + ' (без токена)', vp);
  await ctx.close();
}

// 19.10: сумма возврата на экране «Бронь отменена» — три варианта ответа бэкенда порции 39 (refund_text и refund{…})
const REFUND_CASES = [
  { key: 'polnyj', title: 'полный возврат', text: 'Вернём полностью, 13.00 BYN — до 30 рабочих дней на ту же карту.',
    refund: { paid: true, test: false, amount: 13, penalty: 0, full: true, currency: 'BYN', term: 'до 30 рабочих дней на ту же карту' } },
  { key: 'uderzhanie', title: 'возврат с удержанием', text: 'Вернём 8.00 BYN, удержание по правилам отмены — 5.00 BYN — до 30 рабочих дней на ту же карту.',
    refund: { paid: true, test: false, amount: 8, penalty: 5, full: false, currency: 'BYN', term: 'до 30 рабочих дней на ту же карту' } },
  { key: 'test', title: 'тестовая бронь', text: 'Тестовая бронь: оплата не списывалась, возвращать нечего.',
    refund: { paid: false, test: true, amount: 0, penalty: 0, full: null, currency: 'BYN' } },
];

async function testCancelRefund(browser, base, vp) {
  for (const c of REFUND_CASES) {
    const L = vp + ' cancel возврат (' + c.title + ')';
    const st = mkState(async (route, u, m) => {
      if (u.pathname === '/api/bookings/manage/' + TOKEN && m === 'GET') return json(route, 200, { booking: BOOKING, manage_token: TOKEN });
      if (u.pathname === '/api/bookings/cancel/' + NUM && m === 'POST') return json(route, 200, { success: true, booking_num: NUM, status: 'cancelled', refund_text: c.text, refund: { ...c.refund, text: c.text } });
      return json(route, 404, { error: 'нет заглушки' });
    });
    const { ctx, page, errors } = await open(browser, base, vp, st);
    await page.goto(base + '/cancel.html?t=' + TOKEN, { waitUntil: 'load' });
    await page.waitForSelector('#cx-btn');
    await page.click('#cx-btn');
    await page.waitForSelector('.msg h2');
    check(L + ': заголовок «Бронь отменена»', (await page.textContent('.msg h2')) === 'Бронь отменена');
    check(L + ': refund_text показан как есть', (await page.locator('.msg p.refund').count()) === 1 && (await page.textContent('.msg p.refund')) === c.text, await page.locator('.msg p.refund').allTextContents().then(a => a.join('|')));
    const all = await page.textContent('.msg');
    check(L + ': общего «по правилам объекта» нет, остаётся «Если возникнут вопросы, свяжитесь с нами»', !/по правилам объекта\./.test(all) && /Если возникнут вопросы, свяжитесь с нами\./.test(all));
    const vis = await page.evaluate(() => { const r = document.querySelector('.msg p.refund').getBoundingClientRect(); return r.width > 100 && r.height > 10 && r.right <= window.innerWidth && r.left >= 0; });
    check(L + ': строка видна и целиком в экране', vis);
    await page.screenshot({ path: path.join(SHOTS, vp + '_6_cancel_vozvrat_' + c.key + '.png'), fullPage: false });
    await commonChecks(page, errors, L, vp);
    await ctx.close();
  }

  // текст приходит с сервера: разметка в нём не должна исполняться
  {
    const L = vp + ' cancel возврат (экранирование)';
    const evil = 'Вернём <b id="x">13.00</b> BYN & <img src=x onerror="window.__pwn=1">';
    const st = mkState(async (route, u, m) => {
      if (u.pathname === '/api/bookings/manage/' + TOKEN) return json(route, 200, { booking: BOOKING });
      if (u.pathname === '/api/bookings/cancel/' + NUM) return json(route, 200, { success: true, booking_num: NUM, status: 'cancelled', refund_text: evil });
      return json(route, 404, { error: 'нет заглушки' });
    });
    const { ctx, page, errors } = await open(browser, base, vp, st);
    await page.goto(base + '/cancel.html?t=' + TOKEN, { waitUntil: 'load' });
    await page.waitForSelector('#cx-btn');
    await page.click('#cx-btn');
    await page.waitForSelector('.msg p.refund');
    check(L + ': разметка в refund_text показана текстом, не исполнена', (await page.textContent('.msg p.refund')) === evil && (await page.locator('.msg p.refund b, .msg p.refund img').count()) === 0 && !(await page.evaluate(() => window.__pwn)));
    await ctx.close();
  }

  // пустой / не строка refund_text — прежний текст
  for (const bad of ['', '   ', null, 123]) {
    const L = vp + ' cancel возврат (refund_text = ' + JSON.stringify(bad) + ')';
    const st = mkState(async (route, u, m) => {
      if (u.pathname === '/api/bookings/manage/' + TOKEN) return json(route, 200, { booking: BOOKING });
      if (u.pathname === '/api/bookings/cancel/' + NUM) return json(route, 200, { success: true, booking_num: NUM, status: 'cancelled', refund_text: bad });
      return json(route, 404, { error: 'нет заглушки' });
    });
    const { ctx, page } = await open(browser, base, vp, st);
    await page.goto(base + '/cancel.html?t=' + TOKEN, { waitUntil: 'load' });
    await page.waitForSelector('#cx-btn');
    await page.click('#cx-btn');
    await page.waitForSelector('.msg h2');
    check(L + ': прежний текст «Возврат средств — по правилам объекта», строки возврата нет', /Возврат средств — по правилам объекта\. Если возникнут вопросы/.test(await page.textContent('.msg p')) && (await page.locator('.msg p.refund').count()) === 0);
    await ctx.close();
  }
}

(async () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'apple-touch-icon.png'))).digest('hex');
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await pw.chromium.launch({ executablePath: process.env.ZB_CHROMIUM || undefined });
  const only = process.env.ZB_VP ? [+process.env.ZB_VP] : [390, 1366];
  console.log('apple-touch-icon.png sha256:', sha);
  for (const vp of only) {
    console.log('\n=== ' + vp + ' px' + (vp === 390 ? ' (тач)' : '') + ' ===');
    await testClaim(browser, base, vp);
    await testClaimBadToken(browser, base, vp);
    await testContract(browser, base, vp);
    await testCancel(browser, base, vp);
    await testCancelRefund(browser, base, vp);
  }
  await browser.close(); srv.close();
  const fail = results.filter(r => !r.ok);
  fs.writeFileSync(path.join(__dirname, 'result_19_10.json'), JSON.stringify({ date: '2026-10-19', total: results.length, failed: fail.length, apple_touch_icon_sha256: sha, results }, null, 1));
  console.log('\nИтого: ' + (results.length - fail.length) + ' из ' + results.length + (fail.length ? ', провалено: ' + fail.length : ''));
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
