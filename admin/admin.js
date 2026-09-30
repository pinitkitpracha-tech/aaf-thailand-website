/* =========================================================================
   AAF Thailand — ระบบ Admin แก้ไขเนื้อหาเว็บไซต์
   -------------------------------------------------------------------------
   เปิดใช้งาน: เข้าเว็บด้วย  https://โดเมนของคุณ/?admin
   - เข้าสู่ระบบด้วยรหัสผ่าน (GitHub token ถูกเข้ารหัสเก็บไว้ใน admin/auth.json)
   - คลิกข้อความใดก็ได้เพื่อแก้ภาษาไทย → ระบบแปลอังกฤษ/จีนตัวเต็มให้อัตโนมัติ
   - คลิกรูปใดก็ได้ (หรือเมนู "รูปภาพทั้งหมด") เพื่อเปลี่ยนรูป
   - กด "เผยแพร่" → บันทึก content.json และรูปใหม่ลง GitHub → เว็บอัปเดตใน 1–2 นาที
   ========================================================================= */
(function () {
  'use strict';
  const SITE = window.SITE;
  if (!SITE) return;

  const DEFAULT_REPO = 'pinitkitpracha-tech/aaf-thailand-website';
  const DEFAULT_BRANCH = 'main';
  const AUTH_PATH = 'admin/auth.json';
  const CONTENT_PATH = 'content.json';

  let session = null;                 // { token, repo, branch }
  const pendingTexts = {};            // key -> {th,en,zh}
  const pendingImages = {};           // orig src -> {blob, ext, url}
  let workingContent = { texts: {}, images: {} };

  /* ------------------------------ สไตล์ ------------------------------ */
  const css = `
  .adm-ui, .adm-ui * { box-sizing: border-box; font-family: 'Anuphan','Inter',sans-serif; }
  .adm-ui { --g9:#111111; --g7:#1f1f22; --g5:#a16207; --g1:#fde68a; --g0:#fffbeb; color:#1e293b; }
  .adm-overlay { position:fixed; inset:0; z-index:9998; background:rgba(12,33,25,.55); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; padding:16px; }
  .adm-card { width:100%; max-width:420px; background:#fff; border-radius:24px; padding:28px; box-shadow:0 30px 80px -20px rgba(0,0,0,.4); max-height:92vh; overflow:auto; }
  .adm-card h2 { margin:0 0 4px; font-size:22px; color:var(--g9); }
  .adm-card p.sub { margin:0 0 20px; color:#64748b; font-size:14px; line-height:1.6; }
  .adm-ui label { display:block; font-size:13px; font-weight:600; color:var(--g9); margin:14px 0 6px; }
  .adm-ui input, .adm-ui textarea { width:100%; border:1px solid var(--g1); background:#fbfdfc; border-radius:12px; padding:11px 13px; font-size:15px; outline:none; color:#0f172a; }
  .adm-ui textarea { resize:vertical; min-height:72px; line-height:1.55; }
  .adm-ui input:focus, .adm-ui textarea:focus { border-color:var(--g5); box-shadow:0 0 0 4px var(--g1); background:#fff; }
  .adm-btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; border:0; border-radius:999px; padding:10px 18px; font-size:14px; font-weight:600; cursor:pointer; transition:.2s; white-space:nowrap; }
  .adm-btn.pri { background:var(--g7); color:#fff; } .adm-btn.pri:hover { background:var(--g9); }
  .adm-btn.sec { background:var(--g0); color:var(--g7); } .adm-btn.sec:hover { background:var(--g1); }
  .adm-btn.ghost { background:transparent; color:#64748b; } .adm-btn.ghost:hover { color:var(--g7); }
  .adm-btn[disabled] { opacity:.5; cursor:default; }
  .adm-row { display:flex; gap:10px; margin-top:20px; justify-content:flex-end; flex-wrap:wrap; }
  .adm-msg { margin-top:12px; font-size:13px; line-height:1.5; }
  .adm-msg.err { color:#dc2626; } .adm-msg.ok { color:var(--g5); }
  .adm-link { background:none; border:0; color:var(--g5); font-size:13px; cursor:pointer; padding:0; text-decoration:underline; }
  .adm-help { font-size:12px; color:#64748b; margin-top:6px; line-height:1.5; }
  .adm-help a { color:var(--g5); }

  .adm-bar { position:fixed; left:50%; bottom:16px; transform:translateX(-50%); z-index:9990; display:flex; align-items:center; gap:6px; background:var(--g9); color:#fff; border-radius:999px; padding:6px; box-shadow:0 20px 50px -15px rgba(0,0,0,.5); max-width:calc(100vw - 16px); overflow-x:auto; }
  .adm-bar .tag { padding:0 12px 0 14px; font-size:13px; opacity:.85; white-space:nowrap; }
  .adm-bar .adm-btn.sec { background:rgba(255,255,255,.1); color:#fff; } .adm-bar .adm-btn.sec:hover { background:rgba(255,255,255,.2); }
  .adm-bar .adm-btn.pri { background:#fff; color:var(--g9); } .adm-bar .adm-btn.pri:hover { background:var(--g1); }
  .adm-badge { background:#f5b301; color:#111; color:#fff; border-radius:999px; padding:1px 7px; font-size:12px; }

  .adm-hl { position:fixed; z-index:9980; pointer-events:none; border:2px solid #f5b301; border-radius:8px; background:rgba(245,179,1,.10); transition:all .08s; display:none; }
  .adm-hl span { position:absolute; top:-24px; left:-2px; background:#111; color:#fbbf24; font-size:11px; padding:3px 8px; border-radius:6px; white-space:nowrap; font-family:'Anuphan',sans-serif; }
  body.adm-on { padding-bottom:80px; }
  body.adm-on a, body.adm-on button:not(.adm-btn):not([data-lang]) { cursor:pointer; }

  .adm-panel { position:fixed; z-index:9995; top:0; right:0; height:100%; width:420px; max-width:100%; background:#fff; box-shadow:-20px 0 60px -20px rgba(0,0,0,.35); display:flex; flex-direction:column; transform:translateX(105%); transition:transform .3s ease; }
  .adm-panel.open { transform:none; }
  .adm-panel header { padding:20px 22px 12px; border-bottom:1px solid #eef2f0; display:flex; align-items:center; justify-content:space-between; }
  .adm-panel header h3 { margin:0; font-size:18px; color:var(--g9); }
  .adm-panel .body { padding:6px 22px 22px; overflow:auto; flex:1; }
  .adm-panel footer { padding:14px 22px; border-top:1px solid #eef2f0; display:flex; gap:10px; justify-content:space-between; align-items:center; }
  .adm-x { border:0; background:var(--g0); width:34px; height:34px; border-radius:50%; cursor:pointer; font-size:18px; color:var(--g7); }
  .adm-lang { display:flex; align-items:center; gap:8px; }
  .adm-lang small { font-weight:500; color:#94a3b8; }
  .adm-status { font-size:12px; color:#64748b; min-height:18px; margin-top:6px; }
  .adm-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:12px; }
  .adm-thumb { border:1px solid #eef2f0; border-radius:14px; overflow:hidden; background:var(--g0); }
  .adm-thumb .im { aspect-ratio:4/3; background:#f1f5f9 center/cover no-repeat; position:relative; }
  .adm-thumb .im i { position:absolute; top:6px; left:6px; background:#c8a96a; color:#fff; font-style:normal; font-size:10px; padding:2px 6px; border-radius:6px; }
  .adm-thumb .ac { display:flex; gap:4px; padding:6px; }
  .adm-thumb .ac .adm-btn { flex:1; padding:7px 8px; font-size:12px; }
  .adm-img-preview { width:100%; aspect-ratio:4/3; border-radius:14px; background:#f1f5f9 center/contain no-repeat; border:1px solid #eef2f0; margin-top:10px; }
  @media (max-width:640px) { .adm-panel { top:auto; bottom:0; height:88%; width:100%; border-radius:22px 22px 0 0; transform:translateY(105%); } .adm-bar .tag { display:none; } }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  /* ------------------------------ ตัวช่วย ------------------------------ */
  const $ = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const b64FromBytes = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
  const bytesFromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const utf8ToB64 = (str) => b64FromBytes(new TextEncoder().encode(str));
  const b64ToUtf8 = (b64) => new TextDecoder().decode(bytesFromB64(b64.replace(/\n/g, '')));

  /* ---------------------- เข้ารหัส token ด้วยรหัสผ่าน ---------------------- */
  async function deriveKey(password, salt) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encryptToken(token, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(token)));
    return { salt: b64FromBytes(salt), iv: b64FromBytes(iv), data: b64FromBytes(data) };
  }
  async function decryptToken(enc, password) {
    const key = await deriveKey(password, bytesFromB64(enc.salt));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytesFromB64(enc.iv) }, key, bytesFromB64(enc.data));
    return new TextDecoder().decode(plain);
  }

  /* ------------------------------ GitHub API ------------------------------ */
  async function gh(path, opts = {}, s = session) {
    const res = await fetch('https://api.github.com' + path, {
      ...opts,
      headers: { Authorization: 'Bearer ' + s.token, Accept: 'application/vnd.github+json', ...(opts.headers || {}) },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      let msg = res.status + ' ' + res.statusText;
      try { msg = (await res.json()).message || msg; } catch (e) {}
      throw new Error(msg);
    }
    return res.json();
  }
  const getFile = (path, s = session) => gh(`/repos/${s.repo}/contents/${encodeURI(path)}?ref=${s.branch}`, {}, s);
  async function putFile(path, b64, message, s = session) {
    const cur = await getFile(path, s);
    return gh(`/repos/${s.repo}/contents/${encodeURI(path)}`, {
      method: 'PUT',
      body: JSON.stringify({ message, content: b64, branch: s.branch, ...(cur && cur.sha ? { sha: cur.sha } : {}) }),
    }, s);
  }

  /* ------------------------------ แปลภาษาอัตโนมัติ ------------------------------ */
  async function translate(text, target) {
    if (!text.trim()) return '';
    const g = target === 'zh' ? 'zh-TW' : 'en';
    // 1) Google Translate (endpoint สาธารณะ)
    try {
      const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=th&tl=${g}&dt=t&q=${encodeURIComponent(text)}`);
      if (r.ok) {
        const j = await r.json();
        const out = (j[0] || []).map((x) => x[0]).join('');
        if (out) return out;
      }
    } catch (e) {}
    // 2) สำรอง: MyMemory
    const m = target === 'zh' ? 'zh-TW' : 'en-GB';
    const r2 = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=th|${m}`);
    const j2 = await r2.json();
    if (j2 && j2.responseData && j2.responseData.translatedText) return j2.responseData.translatedText;
    throw new Error('translate failed');
  }

  /* ------------------------------ รูปภาพ ------------------------------ */
  async function compressImage(file) {
    const bmp = await createImageBitmap(file);
    const max = 1800;
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const toBlob = (type, q) => new Promise((res) => c.toBlob(res, type, q));
    let blob = await toBlob('image/webp', 0.85), ext = 'webp';
    if (!blob || blob.type !== 'image/webp') { blob = await toBlob('image/jpeg', 0.86); ext = 'jpg'; }
    return { blob, ext };
  }
  const currentSrc = (orig) => (pendingImages[orig] ? pendingImages[orig].url : (workingContent.images[orig] || orig));
  function previewImages() {
    SITE.images.forEach((img) => {
      const src = currentSrc(img.dataset.orig);
      if (img.getAttribute('src') !== src) { img.style.display = ''; img.src = src; }
    });
  }
  function pickImage(orig, done) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      toast('กำลังปรับขนาดรูป…');
      try {
        const { blob, ext } = await compressImage(f);
        if (pendingImages[orig]) URL.revokeObjectURL(pendingImages[orig].url);
        pendingImages[orig] = { blob, ext, url: URL.createObjectURL(blob) };
        previewImages(); updateBar(); toast('เปลี่ยนรูปแล้ว (ยังไม่เผยแพร่)');
        done && done();
      } catch (e) { toast('เปิดรูปนี้ไม่ได้ ลองไฟล์ JPG/PNG'); }
    };
    inp.click();
  }

  /* ------------------------------ UI: Toast ------------------------------ */
  let toastEl;
  function toast(msg) {
    if (!toastEl) {
      toastEl = $('<div class="adm-ui" style="position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:9999;background:#111;color:#fbbf24;padding:10px 18px;border-radius:999px;font-size:14px;box-shadow:0 10px 30px -10px rgba(0,0,0,.4);transition:opacity .3s;opacity:0;pointer-events:none"></div>');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg; toastEl.style.opacity = 1;
    clearTimeout(toastEl._t); toastEl._t = setTimeout(() => (toastEl.style.opacity = 0), 2600);
  }

  /* ------------------------------ UI: เข้าสู่ระบบ ------------------------------ */
  let authFile = null;
  async function showLogin() {
    try { const r = await fetch(AUTH_PATH + '?v=' + Date.now(), { cache: 'no-store' }); authFile = r.ok ? await r.json() : null; } catch (e) { authFile = null; }
    if (!authFile) return showSetup(true);
    const ov = $(`<div class="adm-ui adm-overlay"><form class="adm-card">
      <h2>เข้าสู่ระบบผู้ดูแล</h2><p class="sub">AAF Thailand — ระบบแก้ไขเนื้อหาเว็บไซต์</p>
      <label>รหัสผ่าน</label><input type="password" name="pw" autocomplete="current-password" required autofocus>
      <div class="adm-msg err" hidden></div>
      <div class="adm-row" style="justify-content:space-between;align-items:center">
        <button type="button" class="adm-link" data-a="setup">ตั้งค่าใหม่ / ลืมรหัสผ่าน</button>
        <div style="display:flex;gap:8px"><button type="button" class="adm-btn ghost" data-a="close">ปิด</button><button class="adm-btn pri">เข้าสู่ระบบ</button></div>
      </div></form></div>`);
    document.body.appendChild(ov);
    const f = ov.querySelector('form'), err = ov.querySelector('.adm-msg');
    ov.querySelector('[data-a=setup]').onclick = () => { ov.remove(); showSetup(false); };
    ov.querySelector('[data-a=close]').onclick = () => { ov.remove(); location.href = location.pathname; };
    f.onsubmit = async (e) => {
      e.preventDefault(); err.hidden = true;
      const btn = f.querySelector('.pri'); btn.disabled = true; btn.textContent = 'กำลังตรวจสอบ…';
      try {
        const token = await decryptToken(authFile, f.pw.value);
        const s = { token, repo: authFile.repo, branch: authFile.branch || DEFAULT_BRANCH };
        await gh(`/repos/${s.repo}`, {}, s);
        startSession(s); ov.remove();
      } catch (ex) {
        err.textContent = ex && ex.name === 'OperationError' ? 'รหัสผ่านไม่ถูกต้อง' : 'เข้าสู่ระบบไม่สำเร็จ: ' + (ex.message || ex);
        err.hidden = false; btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ';
      }
    };
  }

  function showSetup(first) {
    const ov = $(`<div class="adm-ui adm-overlay"><form class="adm-card">
      <h2>${first ? 'ตั้งค่าระบบ Admin ครั้งแรก' : 'ตั้งค่าใหม่'}</h2>
      <p class="sub">ใช้ GitHub token เพื่อให้ระบบบันทึกการแก้ไขลง repo ได้ แล้วตั้งรหัสผ่านสำหรับเข้าสู่ระบบครั้งต่อไป (token จะถูกเข้ารหัสด้วยรหัสผ่านก่อนบันทึก)</p>
      <label>GitHub repository</label><input name="repo" value="${esc((authFile && authFile.repo) || DEFAULT_REPO)}" required>
      <label>Branch</label><input name="branch" value="${esc((authFile && authFile.branch) || DEFAULT_BRANCH)}" required>
      <label>GitHub token</label><input name="token" type="password" placeholder="github_pat_…" required>
      <div class="adm-help">สร้างที่ <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → Fine-grained token</a> เลือกเฉพาะ repo นี้ และให้สิทธิ์ <b>Contents: Read and write</b></div>
      <label>ตั้งรหัสผ่าน (อย่างน้อย 8 ตัว)</label><input name="pw" type="password" minlength="8" autocomplete="new-password" required>
      <label>ยืนยันรหัสผ่าน</label><input name="pw2" type="password" minlength="8" autocomplete="new-password" required>
      <div class="adm-msg err" hidden></div>
      <div class="adm-row">${first ? '' : '<button type="button" class="adm-btn ghost" data-a="back">กลับ</button>'}<button type="button" class="adm-btn ghost" data-a="close">ปิด</button><button class="adm-btn pri">บันทึกและเข้าสู่ระบบ</button></div>
    </form></div>`);
    document.body.appendChild(ov);
    const f = ov.querySelector('form'), err = ov.querySelector('.adm-msg');
    const back = ov.querySelector('[data-a=back]'); if (back) back.onclick = () => { ov.remove(); showLogin(); };
    ov.querySelector('[data-a=close]').onclick = () => { ov.remove(); location.href = location.pathname; };
    f.onsubmit = async (e) => {
      e.preventDefault(); err.hidden = true;
      if (f.pw.value !== f.pw2.value) { err.textContent = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน'; err.hidden = false; return; }
      const btn = f.querySelector('.pri'); btn.disabled = true; btn.textContent = 'กำลังบันทึก…';
      const s = { token: f.token.value.trim(), repo: f.repo.value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, ''), branch: f.branch.value.trim() };
      try {
        const repo = await gh(`/repos/${s.repo}`, {}, s);
        if (!repo) throw new Error('ไม่พบ repo นี้ หรือ token ไม่มีสิทธิ์เข้าถึง');
        const enc = await encryptToken(s.token, f.pw.value);
        const file = { v: 1, repo: s.repo, branch: s.branch, ...enc };
        await putFile(AUTH_PATH, utf8ToB64(JSON.stringify(file, null, 2)), 'Admin: ตั้งค่ารหัสผ่านผู้ดูแล', s);
        authFile = file; startSession(s); ov.remove();
        toast('ตั้งค่าเรียบร้อย ครั้งต่อไปใช้แค่รหัสผ่าน');
      } catch (ex) {
        err.textContent = 'ไม่สำเร็จ: ' + (ex.message || ex); err.hidden = false;
        btn.disabled = false; btn.textContent = 'บันทึกและเข้าสู่ระบบ';
      }
    };
  }

  /* ------------------------------ เริ่มโหมดแก้ไข ------------------------------ */
  async function startSession(s) {
    session = s;
    try { sessionStorage.setItem('adm-session', JSON.stringify(s)); } catch (e) {}
    // โหลด content.json ล่าสุดจาก GitHub โดยตรง (ไม่ต้องรอเว็บ deploy)
    try {
      const f = await getFile(CONTENT_PATH);
      if (f) workingContent = JSON.parse(b64ToUtf8(f.content));
    } catch (e) { workingContent = JSON.parse(JSON.stringify(SITE.content)); }
    workingContent.texts = workingContent.texts || {}; workingContent.images = workingContent.images || {};
    SITE.applyContent(workingContent);
    enableEditing();
  }

  let bar, hl, panel, editing = false;
  function enableEditing() {
    editing = true;
    document.body.classList.add('adm-on');
    hl = $('<div class="adm-ui adm-hl"><span></span></div>'); document.body.appendChild(hl);
    bar = $(`<div class="adm-ui adm-bar">
      <span class="tag">✎ โหมดแก้ไข · คลิกเพื่อแก้</span>
      <button class="adm-btn sec" data-a="images">รูปภาพทั้งหมด</button>
      <button class="adm-btn pri" data-a="publish">เผยแพร่ <span class="adm-badge" hidden>0</span></button>
      <button class="adm-btn sec" data-a="logout">ออกจากระบบ</button></div>`);
    document.body.appendChild(bar);
    bar.querySelector('[data-a=images]').onclick = openImagesPanel;
    bar.querySelector('[data-a=publish]').onclick = publish;
    bar.querySelector('[data-a=logout]').onclick = logout;
    panel = $('<aside class="adm-ui adm-panel"></aside>'); document.body.appendChild(panel);
    updateBar();
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    window.addEventListener('scroll', () => (hl.style.display = 'none'), { passive: true });
    window.addEventListener('beforeunload', (e) => { if (pendingCount()) { e.preventDefault(); e.returnValue = ''; } });
    toast('เข้าสู่โหมดแก้ไขแล้ว');
  }
  function logout() {
    if (pendingCount() && !confirm('ยังมีการแก้ไขที่ยังไม่เผยแพร่ ต้องการออกจากระบบหรือไม่?')) return;
    try { sessionStorage.removeItem('adm-session'); } catch (e) {}
    Object.keys(pendingTexts).forEach((k) => delete pendingTexts[k]);
    Object.keys(pendingImages).forEach((k) => delete pendingImages[k]);
    location.href = location.pathname;
  }
  const pendingCount = () => Object.keys(pendingTexts).length + Object.keys(pendingImages).length;
  function updateBar() {
    const n = pendingCount(), b = bar.querySelector('.adm-badge');
    b.hidden = !n; b.textContent = n;
  }

  /* --------- หาเป้าหมายใต้เมาส์: ข้อความ (text node) หรือรูป --------- */
  function targetAt(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el || el.closest('.adm-ui')) return null;
    if (el.closest('#slideCaption')) {
      const active = document.querySelector('#aboutSlider .slide.is-active');
      return active ? { type: 'caption', el: el.closest('#slideCaption'), key: active.dataset.captionKey } : null;
    }
    let node = null;
    if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); node = r && r.startContainer; }
    else if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); node = p && p.offsetNode; }
    if (node && node.nodeType === 3 && node._key) {
      // ยืนยันว่าเมาส์อยู่บนตัวอักษรจริง ไม่ใช่พื้นที่ว่างข้างๆ
      const range = document.createRange(); range.selectNodeContents(node);
      const hit = [...range.getClientRects()].some((rc) => x >= rc.left - 2 && x <= rc.right + 2 && y >= rc.top - 2 && y <= rc.bottom + 2);
      if (hit) return { type: 'text', node, key: node._key, el: node.parentElement, rect: range.getBoundingClientRect() };
    }
    // รูปในสไลด์ที่ซ่อนอยู่ (ไม่ active) ต้องข้ามไป
    const img = document.elementsFromPoint(x, y).find((e) => e.tagName === 'IMG' && e.dataset.orig && !e.closest('.adm-ui')
      && (!e.closest('.slide') || e.closest('.slide').classList.contains('is-active')));
    if (img && img.offsetWidth > 20) return { type: 'image', el: img, orig: img.dataset.orig };
    return null;
  }
  let moveRaf = 0;
  function onMove(e) {
    if (moveRaf) return;
    moveRaf = requestAnimationFrame(() => {
      moveRaf = 0;
      if (panel.classList.contains('open') && e.target.closest && e.target.closest('.adm-panel')) { hl.style.display = 'none'; return; }
      const tg = targetAt(e.clientX, e.clientY);
      if (!tg) { hl.style.display = 'none'; return; }
      const r = tg.type === 'text' ? tg.rect : tg.el.getBoundingClientRect();
      const rr = tg.type === 'image' ? clipToVisible(tg.el, r) : r;
      Object.assign(hl.style, { display: 'block', left: rr.left - 4 + 'px', top: rr.top - 4 + 'px', width: rr.width + 8 + 'px', height: rr.height + 8 + 'px' });
      hl.firstChild.textContent = tg.type === 'image' ? '🖼 เปลี่ยนรูป' : '✎ แก้ข้อความ';
    });
  }
  function clipToVisible(el, r) {
    // รูปที่อยู่ในกรอบ overflow:hidden ให้แสดงกรอบเท่าพื้นที่ที่มองเห็น
    let p = el.parentElement, box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    while (p && p !== document.body) {
      const cs = getComputedStyle(p);
      if (cs.overflow !== 'visible') {
        const pr = p.getBoundingClientRect();
        box = { left: Math.max(box.left, pr.left), top: Math.max(box.top, pr.top), right: Math.min(box.right, pr.right), bottom: Math.min(box.bottom, pr.bottom) };
      }
      p = p.parentElement;
    }
    return { left: box.left, top: box.top, width: box.right - box.left, height: box.bottom - box.top };
  }
  function onClick(e) {
    if (!editing || e.target.closest('.adm-ui')) return;
    if (e.target.closest('[data-lang], #menuBtn, #slidePrev, #slideNext, #slideDots')) return; // ปุ่มระบบใช้งานได้ตามปกติ
    const tg = targetAt(e.clientX, e.clientY);
    if (!tg) { if (e.target.closest('a')) e.preventDefault(); return; }
    e.preventDefault(); e.stopPropagation();
    if (tg.type === 'image') openImagePanel(tg.orig);
    else openTextPanel(tg.key);
  }

  /* ------------------------------ แผงแก้ข้อความ ------------------------------ */
  function currentValues(key) {
    const o = pendingTexts[key] || workingContent.texts[key];
    const I = SITE.I18N[key];
    return {
      th: (o && o.th) || key,
      en: (o && o.en) || (I ? I[0] : key),
      zh: (o && o.zh) || (I ? I[1] : key),
    };
  }
  function openTextPanel(key) {
    const v = currentValues(key);
    panel.innerHTML = `<header><h3>แก้ไขข้อความ</h3><button class="adm-x" data-a="x">×</button></header>
      <div class="body">
        <label class="adm-lang">ภาษาไทย <small>(แก้ที่นี่ อีกสองภาษาจะแปลให้อัตโนมัติ)</small></label>
        <textarea name="th" rows="4">${esc(v.th)}</textarea>
        <div class="adm-status" data-s></div>
        <label class="adm-lang">English <small>แก้เพิ่มได้</small></label>
        <textarea name="en" rows="4">${esc(v.en)}</textarea>
        <label class="adm-lang">繁體中文 <small>แก้เพิ่มได้</small></label>
        <textarea name="zh" rows="4">${esc(v.zh)}</textarea>
        <div style="margin-top:12px"><button class="adm-btn sec" data-a="tr">แปลใหม่อีกครั้ง</button></div>
      </div>
      <footer><button class="adm-link" data-a="reset">คืนค่าเดิม</button>
        <div style="display:flex;gap:8px"><button class="adm-btn ghost" data-a="x">ยกเลิก</button><button class="adm-btn pri" data-a="ok">ใช้การแก้ไข</button></div></footer>`;
    panel.classList.add('open');
    const th = panel.querySelector('[name=th]'), en = panel.querySelector('[name=en]'), zh = panel.querySelector('[name=zh]'), st = panel.querySelector('[data-s]');
    th.focus(); th.setSelectionRange(th.value.length, th.value.length);
    let seq = 0, tmr;
    const runTranslate = async () => {
      const my = ++seq, text = th.value;
      st.textContent = 'กำลังแปล…';
      try {
        const [a, b] = await Promise.all([translate(text, 'en'), translate(text, 'zh')]);
        if (my !== seq) return;
        en.value = a; zh.value = b; st.textContent = 'แปลอัตโนมัติแล้ว — ตรวจทานและแก้เพิ่มได้';
      } catch (e) { if (my === seq) st.textContent = 'แปลอัตโนมัติไม่สำเร็จ กรุณาแก้ภาษาอังกฤษ/จีนเอง'; }
    };
    th.addEventListener('input', () => { clearTimeout(tmr); st.textContent = '…'; tmr = setTimeout(runTranslate, 700); });
    panel.querySelector('[data-a=tr]').onclick = runTranslate;
    panel.querySelectorAll('[data-a=x]').forEach((b) => (b.onclick = closePanel));
    panel.querySelector('[data-a=reset]').onclick = () => {
      const I = SITE.I18N[key];
      th.value = key; en.value = I ? I[0] : key; zh.value = I ? I[1] : key;
      pendingTexts[key] = null; applyText(key, null); closePanel();
    };
    panel.querySelector('[data-a=ok]').onclick = () => {
      applyText(key, { th: th.value.trim(), en: en.value.trim(), zh: zh.value.trim() });
      closePanel(); toast('แก้ไขแล้ว (ยังไม่เผยแพร่)');
    };
  }
  function applyText(key, val) {
    pendingTexts[key] = val;               // null = คืนค่าเดิม
    if (val) workingContent.texts[key] = val; else delete workingContent.texts[key];
    SITE.applyContent(workingContent); previewImages(); updateBar();
  }

  /* ------------------------------ แผงเปลี่ยนรูป ------------------------------ */
  function openImagePanel(orig) {
    panel.innerHTML = `<header><h3>เปลี่ยนรูปภาพ</h3><button class="adm-x" data-a="x">×</button></header>
      <div class="body"><div class="adm-img-preview" style="background-image:url('${esc(currentSrc(orig))}')"></div>
      <p class="adm-help">แนะนำรูปแนวเดียวกับรูปเดิม ระบบจะย่อขนาดให้อัตโนมัติ (กว้างไม่เกิน 1800px) สำหรับรูปสินค้าแบบไม่มีพื้นหลัง ใช้ไฟล์ PNG โปร่งใส</p>
      <p class="adm-help" style="word-break:break-all">ต้นฉบับ: ${esc(orig)}</p></div>
      <footer><button class="adm-link" data-a="reset">คืนรูปเดิม</button>
      <div style="display:flex;gap:8px"><button class="adm-btn ghost" data-a="x">ปิด</button><button class="adm-btn pri" data-a="pick">เลือกรูปใหม่</button></div></footer>`;
    panel.classList.add('open');
    panel.querySelectorAll('[data-a=x]').forEach((b) => (b.onclick = closePanel));
    panel.querySelector('[data-a=pick]').onclick = () => pickImage(orig, () => openImagePanel(orig));
    panel.querySelector('[data-a=reset]').onclick = () => resetImage(orig, () => openImagePanel(orig));
  }
  function resetImage(orig, done) {
    if (pendingImages[orig]) { URL.revokeObjectURL(pendingImages[orig].url); delete pendingImages[orig]; }
    if (workingContent.images[orig]) { delete workingContent.images[orig]; pendingTexts['__img__' + orig] = true; }
    previewImages(); updateBar(); done && done();
  }
  function openImagesPanel() {
    const list = [...new Set(SITE.images.map((i) => i.dataset.orig))];
    panel.innerHTML = `<header><h3>รูปภาพทั้งหมด (${list.length})</h3><button class="adm-x" data-a="x">×</button></header>
      <div class="body"><p class="adm-help">รวมรูปที่อยู่ในสไลด์และส่วนที่คลิกได้ยาก</p><div class="adm-grid">${list.map((o, i) => `
        <div class="adm-thumb"><div class="im" style="background-image:url('${esc(currentSrc(o))}')">${pendingImages[o] || workingContent.images[o] ? '<i>เปลี่ยนแล้ว</i>' : ''}</div>
        <div class="ac"><button class="adm-btn sec" data-pick="${i}">เปลี่ยน</button>${pendingImages[o] || workingContent.images[o] ? `<button class="adm-btn ghost" data-reset="${i}">คืนเดิม</button>` : ''}</div></div>`).join('')}
      </div></div>`;
    panel.classList.add('open');
    panel.querySelector('[data-a=x]').onclick = closePanel;
    panel.querySelectorAll('[data-pick]').forEach((b) => (b.onclick = () => pickImage(list[b.dataset.pick], openImagesPanel)));
    panel.querySelectorAll('[data-reset]').forEach((b) => (b.onclick = () => resetImage(list[b.dataset.reset], openImagesPanel)));
  }
  function closePanel() { panel.classList.remove('open'); }

  /* ------------------------------ เผยแพร่ ------------------------------ */
  async function publish() {
    if (!pendingCount()) return toast('ยังไม่มีการแก้ไข');
    const btn = bar.querySelector('[data-a=publish]');
    btn.disabled = true; btn.firstChild.textContent = 'กำลังเผยแพร่… ';
    try {
      // 1) อัปโหลดรูปใหม่
      const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      let i = 0;
      for (const [orig, p] of Object.entries(pendingImages)) {
        const base = orig.split('/').pop().replace(/\?.*$/, '').replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9-]+/gi, '-').slice(0, 40) || 'image';
        const path = `assets/uploads/${stamp}-${++i}-${base}.${p.ext}`;
        const bytes = new Uint8Array(await p.blob.arrayBuffer());
        await putFile(path, b64FromBytes(bytes), `Admin: เปลี่ยนรูป ${base}`);
        workingContent.images[orig] = path;
      }
      // 2) รวมกับ content.json ล่าสุดบน GitHub แล้วบันทึก
      const cur = await getFile(CONTENT_PATH);
      const remote = cur ? JSON.parse(b64ToUtf8(cur.content)) : { texts: {}, images: {} };
      remote.texts = remote.texts || {}; remote.images = remote.images || {};
      for (const [k, v] of Object.entries(pendingTexts)) {
        if (k.startsWith('__img__')) { delete remote.images[k.slice(7)]; continue; }
        if (v) remote.texts[k] = v; else delete remote.texts[k];
      }
      for (const orig of Object.keys(pendingImages)) remote.images[orig] = workingContent.images[orig];
      remote.updatedAt = new Date().toISOString();
      await putFile(CONTENT_PATH, utf8ToB64(JSON.stringify(remote, null, 2)), 'Admin: อัปเดตเนื้อหาเว็บไซต์');
      workingContent = remote;
      Object.keys(pendingTexts).forEach((k) => delete pendingTexts[k]);
      Object.keys(pendingImages).forEach((k) => { URL.revokeObjectURL(pendingImages[k].url); delete pendingImages[k]; });
      SITE.applyContent(workingContent);
      toast('เผยแพร่แล้ว ✓ เว็บจริงจะอัปเดตภายใน 1–2 นาที');
    } catch (e) {
      alert('เผยแพร่ไม่สำเร็จ: ' + (e.message || e) + '\nการแก้ไขยังอยู่ ลองกดเผยแพร่อีกครั้ง');
    } finally {
      btn.disabled = false; btn.firstChild.textContent = 'เผยแพร่ '; updateBar();
    }
  }

  /* ------------------------------ เริ่มทำงาน ------------------------------ */
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem('adm-session') || 'null'); } catch (e) {}
  if (saved && saved.token) {
    gh(`/repos/${saved.repo}`, {}, saved).then(() => startSession(saved)).catch(() => showLogin());
  } else showLogin();
})();
