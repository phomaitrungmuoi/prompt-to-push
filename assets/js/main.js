/* ==========================================================================
   Prompt to Push — interactions
   ========================================================================== */
(() => {
  'use strict';

  const doc = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pad = (n) => String(n).padStart(2, '0');
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  };

  /* ---------------------------------------------------------------- Theme */
  const themeBtn = $('#themeBtn');
  const themeMeta = $('meta[name="theme-color"]');
  const currentTheme = () =>
    doc.getAttribute('data-theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const syncThemeMeta = () => { if (themeMeta) themeMeta.content = currentTheme() === 'dark' ? '#1F1E1D' : '#FAF9F5'; };
  themeBtn.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    doc.setAttribute('data-theme', next);
    store.set('ptp-theme', next);
    syncThemeMeta();
  });
  syncThemeMeta();

  /* ----------------------------------------------------------- Fullscreen */
  const fsBtn = $('#fullscreenBtn');
  const toggleFullscreen = () => {
    if (!document.fullscreenEnabled) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else doc.requestFullscreen().catch(() => {});
  };
  if (!document.fullscreenEnabled) fsBtn.hidden = true;
  fsBtn.addEventListener('click', toggleFullscreen);

  /* ---------------------------------------------------------------- Toast */
  const toastEl = $('#toast');
  let toastTimer;
  const toast = (msg) => {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1600);
  };

  /* ------------------------------------------------- Slides & navigation */
  const slides = $$('.slide');
  const dotsNav = $('.dots');
  const topLinks = $$('.topnav a');
  const topbar = $('.topbar');
  const progress = $('.progress span');
  const slideNum = $('#slideNum');
  const slideName = $('#slideName');
  $('#slideTotal').textContent = pad(slides.length);

  const dots = slides.map((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.label = s.dataset.title;
    b.setAttribute('aria-label', `Slide ${i + 1}: ${s.dataset.title}`);
    b.addEventListener('click', () => goSlide(i));
    dotsNav.appendChild(b);
    return b;
  });

  let current = -1;
  const goSlide = (i) => {
    const idx = Math.max(0, Math.min(slides.length - 1, i));
    slides[idx].scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  const onScroll = () => {
    const max = doc.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
    topbar.classList.toggle('scrolled', scrollY > 10);

    const probe = innerHeight * 0.42;
    let idx = 0;
    slides.forEach((s, i) => { if (s.getBoundingClientRect().top <= probe) idx = i; });
    if (idx !== current) {
      current = idx;
      dots.forEach((d, i) => d.classList.toggle('active', i === idx));
      slideNum.textContent = pad(idx + 1);
      slideName.textContent = slides[idx].dataset.title;
      const ch = slides[idx].dataset.ch;
      topLinks.forEach((a) => a.classList.toggle('active', a.dataset.ch === ch));
    }
  };
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onScroll(); ticking = false; });
  }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName || '')) return;
    if (t.closest && t.closest('[role="tablist"]') && /^Arrow/.test(e.key)) return;
    switch (e.key) {
      case 'ArrowRight': case 'PageDown': e.preventDefault(); goSlide(current + 1); break;
      case 'ArrowLeft': case 'PageUp': e.preventDefault(); goSlide(current - 1); break;
      case 'Home': e.preventDefault(); goSlide(0); break;
      case 'End': e.preventDefault(); goSlide(slides.length - 1); break;
      case 'f': case 'F': toggleFullscreen(); break;
      case 't': case 'T': themeBtn.click(); break;
      default: break;
    }
  });

  /* ------------------------------------------------------ Reveal on scroll */
  const reveals = $$('.reveal, .step');
  reveals.forEach((el) => {
    if (!el.classList.contains('reveal')) return;
    const sibs = Array.from(el.parentElement.children).filter((c) => c.classList.contains('reveal'));
    const i = Math.max(0, sibs.indexOf(el));
    el.style.setProperty('--d', `${Math.min(i * 0.08, 0.48)}s`);
  });
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('in'));
  }

  /* ------------------------------------------------------------------ Tabs */
  const detectOS = () => {
    const ua = navigator.userAgent || '';
    const plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
    if (/win/i.test(plat) || /Windows/i.test(ua)) return 'win';
    if (/mac|iphone|ipad/i.test(plat) || /Mac OS X|iPhone|iPad/i.test(ua)) return 'mac';
    return 'linux';
  };
  const OS = detectOS();

  const selectTab = (group, key, focus) => {
    const tabs = $$('[role="tab"]', group);
    if (!tabs.some((t) => t.dataset.tab === key)) return;
    tabs.forEach((t) => {
      const on = t.dataset.tab === key;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    $$('.tab-panel', group).forEach((p) => { p.hidden = p.dataset.panel !== key; });
  };

  $$('.tabs').forEach((group, gi) => {
    const tabs = $$('[role="tab"]', group);
    tabs.forEach((tab, ti) => {
      const key = tab.dataset.tab;
      const panel = $(`.tab-panel[data-panel="${key}"]`, group);
      tab.type = 'button';
      tab.id = `tab-${gi}-${key}`;
      if (panel) {
        panel.id = `${tab.id}-panel`;
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tab.id);
        tab.setAttribute('aria-controls', panel.id);
      }
      if (group.dataset.sync === 'os' && key === OS) {
        tab.classList.add('detected');
        tab.title = 'Detected on this device';
      }
      tab.addEventListener('click', () => {
        if (group.dataset.sync) {
          $$(`.tabs[data-sync="${group.dataset.sync}"]`).forEach((g) => selectTab(g, key));
        } else {
          selectTab(group, key);
        }
      });
      tab.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const next = tabs[(ti + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
        next.click();
        next.focus();
      });
    });
    const initial = group.dataset.sync === 'os' ? OS : tabs[0].dataset.tab;
    selectTab(group, tabs.some((t) => t.dataset.tab === initial) ? initial : tabs[0].dataset.tab);
  });

  /* ------------------------------------------------------------------ Copy */
  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove();
      return ok;
    }
  };
  const flash = (btn, label) => {
    btn.classList.add('copied');
    const span = $('span', btn);
    const old = span ? span.textContent : null;
    if (span) span.textContent = label;
    setTimeout(() => { btn.classList.remove('copied'); if (span) span.textContent = old; }, 1600);
  };

  $$('.code').forEach((block) => {
    const btn = $('.copy', block);
    const codeEl = $('code', block);
    if (!btn || !codeEl) return;
    btn.addEventListener('click', async () => {
      const clone = codeEl.cloneNode(true);
      const isShell = !!$('.p', clone);
      $$('.p, .out, .anno', clone).forEach((n) => n.remove());
      let text = clone.textContent;
      if (isShell) {
        text = text.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim() !== '').join('\n');
      }
      const ok = await copyText(text.trim());
      flash(btn, ok ? 'Copied' : 'Press Ctrl+C');
      if (ok) toast('Copied to clipboard');
    });
  });
  $$('.copy-sm').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const code = btn.parentElement.querySelector('code');
      if (!code) return;
      const ok = await copyText(code.textContent.trim());
      if (ok) { flash(btn, ''); toast('Command copied'); }
    });
  });
  $$('.cmd').forEach((btn) => {
    btn.title = 'Click to copy';
    btn.addEventListener('click', async () => {
      const ok = await copyText(btn.textContent.trim());
      if (ok) toast(`Copied: ${btn.textContent.trim()}`);
    });
  });

  /* --------------------------------------------------------- Handshake fx */
  const hsTrack = $('.hs-track');
  const sizeHandshake = () => {
    if (!hsTrack) return;
    const nodes = $$('.hs-node', hsTrack);
    if (nodes.length < 2) return;
    const first = nodes[0].getBoundingClientRect();
    const last = nodes[nodes.length - 1].getBoundingClientRect();
    hsTrack.style.setProperty('--hs-dist', `${Math.round(last.top - first.top)}px`);
  };
  sizeHandshake();
  window.addEventListener('resize', sizeHandshake);

  /* ---------------------------------------------------------- Hero terminal */
  const heroTerm = $('#heroTerm');
  const badgeCommit = $('#badgeCommit');
  const badgeLive = $('#badgeLive');
  const HERO = [
    { t: 'cmd', text: 'claude' },
    { t: 'sys', html: '<span class="spark">✻</span> Claude Code <span class="dim">· ~/my-site</span>' },
    { t: 'ask', text: 'Add a dark-mode toggle, then commit and push it.' },
    { t: 'think', text: 'Planning the change' },
    { t: 'tool', name: 'Read', arg: 'index.html' },
    { t: 'tool', name: 'Update', arg: 'assets/style.css', extra: '+42 −3' },
    { t: 'tool', name: 'Bash', arg: 'git add index.html assets/style.css' },
    { t: 'tool', name: 'Bash', arg: 'git commit -m "feat: add dark-mode toggle"', badge: 'commit' },
    { t: 'tool', name: 'Bash', arg: 'git push origin main' },
    { t: 'ok', text: '  ⎿ main → origin/main' },
    { t: 'done', text: '● Done. Live at you.github.io/my-site', badge: 'live' },
  ];

  let heroVisible = true;
  let heroWaiters = [];
  const flushHero = () => { if (heroVisible && !document.hidden) { heroWaiters.forEach((r) => r()); heroWaiters = []; } };
  const heroReady = () => (heroVisible && !document.hidden ? Promise.resolve() : new Promise((r) => heroWaiters.push(r)));
  document.addEventListener('visibilitychange', flushHero);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((en) => { heroVisible = en[0].isIntersecting; flushHero(); }, { threshold: 0.05 }).observe(heroTerm);
  }

  const line = (cls, html) => {
    const el = document.createElement('div');
    el.className = `tl ${cls || ''}`;
    if (html != null) el.innerHTML = html;
    return el;
  };
  const caret = () => { const c = document.createElement('span'); c.className = 'caret'; return c; };
  const typeText = async (target, text, speed, isCancelled) => {
    for (const ch of text) {
      if (isCancelled && isCancelled()) return;
      target.textContent += ch;
      await sleep(speed + Math.random() * speed * 0.9);
    }
  };
  const toolHTML = (item) =>
    `<span class="dot"></span><b>${esc(item.name)}</b><span class="arg">(${esc(item.arg)})</span>${item.extra ? `<em>${esc(item.extra)}</em>` : ''}`;

  const renderHeroStatic = () => {
    heroTerm.innerHTML = '';
    HERO.forEach((item) => {
      if (item.t === 'cmd') heroTerm.appendChild(line('', `<span class="p">$</span> ${esc(item.text)}`));
      else if (item.t === 'sys') heroTerm.appendChild(line('', item.html));
      else if (item.t === 'ask') heroTerm.appendChild(line('ask', `<span class="p">&gt;</span> ${esc(item.text)}`));
      else if (item.t === 'tool') heroTerm.appendChild(line('tool', toolHTML(item)));
      else if (item.t === 'ok' || item.t === 'done') heroTerm.appendChild(line(item.t, esc(item.text)));
    });
    badgeCommit.classList.add('show');
    badgeLive.classList.add('show');
  };

  const runHero = async () => {
    const SPIN = ['·', '✢', '✳', '✶', '✻', '✽'];
    for (;;) {
      heroTerm.innerHTML = '';
      badgeCommit.classList.remove('show');
      badgeLive.classList.remove('show');
      await sleep(400);
      for (const item of HERO) {
        await heroReady();
        if (item.t === 'cmd' || item.t === 'ask') {
          const el = line(item.t === 'ask' ? 'ask enter' : 'enter', `<span class="p">${item.t === 'ask' ? '&gt;' : '$'}</span> `);
          const tx = document.createElement('span');
          el.appendChild(tx);
          const c = caret();
          el.appendChild(c);
          heroTerm.appendChild(el);
          await sleep(item.t === 'ask' ? 300 : 500);
          await typeText(tx, item.text, item.t === 'ask' ? 26 : 70);
          await sleep(380);
          c.remove();
          await sleep(item.t === 'ask' ? 300 : 200);
        } else if (item.t === 'sys') {
          heroTerm.appendChild(line('enter', item.html));
          await sleep(500);
        } else if (item.t === 'think') {
          const el = line('think enter', '');
          heroTerm.appendChild(el);
          for (let k = 0; k < 14; k++) {
            el.textContent = `${SPIN[k % SPIN.length]} ${item.text}${'.'.repeat((k % 3) + 1)}`;
            await sleep(110);
          }
          el.remove();
        } else if (item.t === 'tool') {
          heroTerm.appendChild(line('tool enter', toolHTML(item)));
          if (item.badge === 'commit') badgeCommit.classList.add('show');
          await sleep(item.name === 'Bash' ? 720 : 560);
        } else {
          heroTerm.appendChild(line(`${item.t} enter`, esc(item.text)));
          if (item.badge === 'live') badgeLive.classList.add('show');
          await sleep(420);
        }
      }
      const tail = line('enter', '<span class="p">$</span> ');
      tail.appendChild(caret());
      heroTerm.appendChild(tail);
      await sleep(5200);
      await heroReady();
      heroTerm.classList.add('fade');
      await sleep(520);
      heroTerm.classList.remove('fade');
    }
  };
  if (reduceMotion) renderHeroStatic();
  else runHero();

  /* ============================================================ Flow diagram */
  const LANES = [
    { name: 'You', icon: 'i-user', tone: 'var(--sand)' },
    { name: 'Claude Code', icon: 'i-spark', tone: 'var(--accent)' },
    { name: 'Git · local', icon: 'i-branch', tone: 'var(--olive)' },
    { name: 'GitHub · cloud', icon: 'i-cloud', tone: 'var(--sky)' },
  ];

  const STEPS = [
    {
      lane: 0, row: 1, icon: 'i-folder', title: 'Create the codebase', sub: 'mkdir · git init · gh repo create',
      desc: 'You make a project folder, turn it into a Git repository and link it to a new repo on GitHub. This is the workspace Claude will edit.',
      term: [['cmd', 'mkdir my-site && cd my-site'], ['cmd', 'git init -b main'], ['cmd', 'gh repo create my-site --public --source=. --remote=origin'], ['ok', '✓ Created repository you/my-site on GitHub']],
    },
    {
      lane: 0, row: 2, icon: 'i-msg', title: 'Write the request', sub: 'A plain-English prompt',
      desc: 'Start Claude Code inside the folder and describe the outcome you want, the way you would brief a teammate. Mention that it should commit and push when done.',
      term: [['cmd', 'claude'], ['ask', 'Build a landing page with a hero and a pricing section, then commit and push it.']],
    },
    {
      lane: 1, row: 2, icon: 'i-search', title: 'Read & plan', sub: 'Explores files and CLAUDE.md',
      desc: 'Claude reads the project and your <code>CLAUDE.md</code> rules, then works out a plan before it touches a single file.',
      term: [['tool', 'Read', 'CLAUDE.md'], ['tool', 'Search', '"pricing"'], ['out', 'Plan: 1) markup  2) styles  3) commit & push']],
    },
    {
      lane: 1, row: 3, icon: 'i-pencil', title: 'Edit the files', sub: 'Writes code, shows diffs',
      desc: 'It edits files directly and shows you every diff. Nothing leaves your machine yet: the edits sit in your working folder.',
      term: [['tool', 'Update', 'index.html', '+58 −2'], ['tool', 'Write', 'assets/pricing.css', '+74']],
    },
    {
      lane: 1, row: 4, icon: 'i-check', title: 'Verify', sub: 'Runs checks & fixes failures',
      desc: 'Claude runs your checks (tests, a linter, a local preview) and fixes anything that fails before it moves on.',
      term: [['tool', 'Bash', 'npm test'], ['ok', '  ⎿ ✓ 12 tests passed']],
    },
    {
      lane: 2, row: 4, icon: 'i-commit', title: 'Commit', sub: 'git add · git commit',
      desc: 'Because <code>git add</code> and <code>git commit</code> are on your allow list, Claude stages only the related files and commits with a clear message, with no prompt.',
      term: [['tool', 'Bash', 'git add index.html assets/pricing.css'], ['tool', 'Bash', 'git commit -m "feat: add landing hero and pricing"'], ['out', '[main 3f9c2ab] feat: add landing hero and pricing']],
    },
    {
      lane: 3, row: 4, icon: 'i-upload', title: 'Push to GitHub', sub: 'git push origin main',
      desc: 'Claude pushes the commit. Git uses the token you stored with <code>gh auth login</code>, so no password is ever typed or shown.',
      term: [['tool', 'Bash', 'git push origin main'], ['out', 'To https://github.com/you/my-site.git'], ['ok', '   a1b2c3d..3f9c2ab  main -> main']],
    },
    {
      lane: 3, row: 5, icon: 'i-globe', title: 'Deploy with Pages', sub: 'Live in about a minute',
      desc: 'GitHub Pages notices the new commit on <code>main</code> and republishes your site automatically.',
      term: [['cmd', 'gh run list --limit 1'], ['ok', '✓ pages build and deployment · main · 41s']],
    },
    {
      lane: 0, row: 5, icon: 'i-user', title: 'Review & iterate', sub: 'Check the site, ask again ↺',
      desc: 'Open the live URL, check the result and send the next request. Every change is a commit you can review, compare or revert.',
      term: [['cmd', 'gh browse'], ['out', 'Opening https://you.github.io/my-site/'], ['ask', 'Make the pricing cards stack on mobile.']],
    },
  ];

  const grid = $('#flowGrid');
  const svg = $('#flowSvg');
  const seg = $('#flowSeg');
  const playBtn = $('#flowPlay');
  const playLabel = $('span', playBtn);
  const panel = $('#flowPanel');
  const fpStep = $('#fpStep');
  const fpLane = $('#fpLane');
  const fpTitle = $('#fpTitle');
  const fpDesc = $('#fpDesc');
  const fpTerm = $('#fpTerm');
  const fpTermTitle = $('#fpTermTitle');

  grid.style.setProperty('--rows', Math.max(...STEPS.map((st) => st.row)));
  LANES.forEach((l, i) => {
    grid.insertAdjacentHTML('beforeend',
      `<div class="lane-bg" style="--lane:${i + 1};--tone:${l.tone}"></div>` +
      `<div class="lane-head" style="--lane:${i + 1};--tone:${l.tone}"><svg class="ic"><use href="#${l.icon}"/></svg>${l.name}</div>`);
  });

  const nodes = STEPS.map((s, i) => {
    const l = LANES[s.lane];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'node';
    b.style.cssText = `--lane:${s.lane + 1};--row:${s.row + 1};--tone:${l.tone}`;
    b.setAttribute('aria-label', `Step ${i + 1}: ${s.title}, by ${l.name}`);
    b.innerHTML =
      `<span class="n-num">${i + 1}</span>` +
      `<span class="n-ic"><svg class="ic"><use href="#${s.icon}"/></svg></span>` +
      `<span class="n-txt"><span class="lane-chip">${l.name}</span><span class="n-title">${s.title}</span><span class="n-sub">${s.sub}</span></span>`;
    b.addEventListener('click', () => { stopPlaying(); goTo(i, false).then(setPlayUI); });
    grid.appendChild(b);
    return b;
  });

  const segs = STEPS.map(() => { const s = document.createElement('span'); seg.appendChild(s); return s; });

  const state = { index: -1 };
  let wires = [];
  let animToken = 0;
  let panelToken = 0;
  let playing = false;
  let runId = 0;

  const NS = 'http://www.w3.org/2000/svg';
  const pathBetween = (a, b) => {
    const acx = a.x + a.w / 2;
    const bcx = b.x + b.w / 2;
    const acy = a.y + a.h / 2;
    const bcy = b.y + b.h / 2;
    if (Math.abs(acy - bcy) < 6) {
      return bcx > acx
        ? `M ${a.x + a.w} ${acy} L ${b.x - 2} ${bcy}`
        : `M ${a.x} ${acy} L ${b.x + b.w + 2} ${bcy}`;
    }
    if (Math.abs(acx - bcx) < 6) return `M ${acx} ${a.y + a.h} L ${bcx} ${b.y - 2}`;
    const by = b.y + b.h / 2;
    const dir = bcx > acx ? 1 : -1;
    const ex = dir > 0 ? b.x - 2 : b.x + b.w + 2;
    const r = Math.min(12, Math.abs(by - (a.y + a.h)) / 2);
    return `M ${acx} ${a.y + a.h} L ${acx} ${by - r} Q ${acx} ${by} ${acx + dir * r} ${by} L ${ex} ${by}`;
  };

  const drawWires = () => {
    if (!grid.offsetParent) return;
    const gr = grid.getBoundingClientRect();
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left - gr.left, y: r.top - gr.top, w: r.width, h: r.height };
    };
    const boxes = nodes.map(rect);
    let html =
      '<defs>' +
      '<marker id="mkIdle" viewBox="0 0 10 10" refX="8.5" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><path class="mk-idle" d="M2 1.5 L8.5 5 L2 8.5"/></marker>' +
      '<marker id="mkOn" viewBox="0 0 10 10" refX="8.5" refY="5" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto"><path class="mk-on" d="M2 1.5 L8.5 5 L2 8.5"/></marker>' +
      '<marker id="mkLoop" viewBox="0 0 10 10" refX="8.5" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><path class="mk-loop" d="M2 1.5 L8.5 5 L2 8.5"/></marker>' +
      '</defs>';
    for (let i = 0; i < boxes.length - 1; i++) {
      const d = pathBetween(boxes[i], boxes[i + 1]);
      html += `<path class="wire" data-i="${i}" d="${d}" marker-end="url(#mkIdle)"/><path class="wire-on" data-i="${i}" d="${d}"/>`;
    }
    // Loop: last step back to "Write the request"
    const a = boxes[boxes.length - 1];
    const b = boxes[1];
    const gx = 9;
    const ay = a.y + a.h / 2;
    const by = b.y + b.h / 2;
    const loopD = `M ${a.x - 2} ${ay} L ${gx + 10} ${ay} Q ${gx} ${ay} ${gx} ${ay - 10} L ${gx} ${by + 10} Q ${gx} ${by} ${gx + 10} ${by} L ${b.x - 3} ${by}`;
    html += `<path class="wire loop" d="${loopD}" marker-end="url(#mkLoop)"/>`;
    html += `<text class="loop-label" transform="translate(${gx - 4} ${(ay + by) / 2}) rotate(-90)" text-anchor="middle">next request</text>`;
    html += '<circle class="packet-halo" r="10" cx="-9999" cy="-9999"/><circle class="packet" r="5" cx="-9999" cy="-9999"/>';
    svg.innerHTML = html;

    wires = $$('.wire-on', svg).map((p) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = `${len} ${len}`;
      return { on: p, base: $(`.wire[data-i="${p.dataset.i}"]`, svg), len };
    });
    paintWires(state.index);
  };

  const setWire = (k, lit) => {
    const w = wires[k];
    if (!w) return;
    w.on.style.strokeDashoffset = lit ? 0 : w.len;
    w.base.classList.toggle('lit', lit);
    w.base.setAttribute('marker-end', lit ? 'url(#mkOn)' : 'url(#mkIdle)');
  };
  const paintWires = (i) => wires.forEach((_, k) => setWire(k, k < i));

  const paintNodes = (i) => {
    grid.classList.toggle('started', i >= 0);
    nodes.forEach((n, j) => {
      n.classList.toggle('done', j < i);
      n.classList.toggle('active', j === i);
      if (j === i) n.setAttribute('aria-current', 'step'); else n.removeAttribute('aria-current');
    });
    segs.forEach((s, j) => { s.classList.toggle('done', j < i); s.classList.toggle('active', j === i); });
  };

  const animateWire = (k, dur, token) => new Promise((resolve) => {
    const w = wires[k];
    if (!w || dur <= 0) { setWire(k, true); resolve(); return; }
    const packet = $('.packet', svg);
    const halo = $('.packet-halo', svg);
    const t0 = performance.now();
    const frame = (now) => {
      if (token !== animToken) { resolve(); return; }
      const t = Math.min(1, (now - t0) / dur);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      w.on.style.strokeDashoffset = w.len * (1 - e);
      const pt = w.on.getPointAtLength(w.len * e);
      packet.setAttribute('cx', pt.x); packet.setAttribute('cy', pt.y);
      halo.setAttribute('cx', pt.x); halo.setAttribute('cy', pt.y);
      if (t < 1) { requestAnimationFrame(frame); return; }
      packet.setAttribute('cx', -9999); packet.setAttribute('cy', -9999);
      halo.setAttribute('cx', -9999); halo.setAttribute('cy', -9999);
      setWire(k, true);
      resolve();
    };
    requestAnimationFrame(frame);
  });

  const termLine = (kind, a, b, c) => {
    if (kind === 'cmd') return line('enter', `<span class="p">$</span> `);
    if (kind === 'ask') return line('ask enter', `<span class="p">&gt;</span> `);
    if (kind === 'tool') return line('tool enter', toolHTML({ name: a, arg: b, extra: c }));
    return line(`${kind} enter`, esc(a));
  };

  const renderPanel = (i) => {
    const token = ++panelToken;
    const cancelled = () => token !== panelToken;
    if (i < 0) {
      fpStep.textContent = 'Ready';
      fpLane.textContent = `${STEPS.length} steps`;
      fpLane.style.removeProperty('--tone');
      fpTitle.textContent = 'Watch one request travel';
      fpDesc.innerHTML = 'Press <strong>Play</strong> to follow a single request from your keyboard to a live website, or click any step in the diagram.';
      fpTermTitle.textContent = '~/my-site';
      fpTerm.innerHTML = '<div class="tl"><span class="p">$</span> <span class="caret"></span></div>';
      return Promise.resolve();
    }
    const s = STEPS[i];
    const l = LANES[s.lane];
    fpStep.textContent = `Step ${pad(i + 1)} / ${pad(STEPS.length)}`;
    fpLane.textContent = l.name;
    fpLane.style.setProperty('--tone', l.tone);
    fpTitle.textContent = s.title;
    fpDesc.innerHTML = s.desc;
    fpTermTitle.textContent = s.lane === 0 && i === 0 ? '~' : '~/my-site — claude';
    panel.classList.remove('swap');
    void panel.offsetWidth; // restart animation
    panel.classList.add('swap');
    fpTerm.innerHTML = '';

    return (async () => {
      for (const [kind, a, b, c] of s.term) {
        if (cancelled()) return;
        const el = termLine(kind, a, b, c);
        fpTerm.appendChild(el);
        if ((kind === 'cmd' || kind === 'ask') && !reduceMotion) {
          const tx = document.createElement('span');
          const cr = caret();
          el.appendChild(tx);
          el.appendChild(cr);
          await typeText(tx, a, kind === 'ask' ? 18 : 30, cancelled);
          cr.remove();
          await sleep(160);
        } else if (kind === 'cmd' || kind === 'ask') {
          el.appendChild(document.createTextNode(a));
        } else {
          await sleep(reduceMotion ? 0 : 260);
        }
      }
    })();
  };

  const goTo = async (i, animate) => {
    const target = Math.max(-1, Math.min(STEPS.length - 1, i));
    const token = ++animToken;
    if (animate && target === state.index + 1 && target > 0 && !reduceMotion) {
      await animateWire(target - 1, 760, token);
      if (token !== animToken) return null;
    }
    state.index = target;
    paintNodes(target);
    paintWires(target);
    return renderPanel(target);
  };

  const setPlayUI = () => {
    playBtn.classList.toggle('playing', playing);
    playLabel.textContent = playing ? 'Pause' : (state.index >= STEPS.length - 1 ? 'Replay' : 'Play');
    playBtn.setAttribute('aria-label', playing ? 'Pause the flow' : 'Play the flow');
  };
  const stopPlaying = () => { playing = false; runId++; setPlayUI(); };

  const play = async () => {
    const myRun = ++runId;
    playing = true;
    setPlayUI();
    if (state.index >= STEPS.length - 1) {
      await goTo(-1, false);
      await sleep(350);
    }
    while (playing && myRun === runId) {
      const next = state.index + 1;
      if (next >= STEPS.length) break;
      const typing = await goTo(next, true);
      if (!playing || myRun !== runId) return;
      if (typing) await typing;
      await sleep(reduceMotion ? 1800 : 1400);
    }
    if (myRun === runId) { playing = false; setPlayUI(); }
  };

  playBtn.addEventListener('click', () => { if (playing) stopPlaying(); else play(); });
  $('#flowNext').addEventListener('click', () => { stopPlaying(); goTo(state.index + 1, true).then(setPlayUI); });
  $('#flowPrev').addEventListener('click', () => { stopPlaying(); goTo(Math.max(0, state.index - 1), false).then(setPlayUI); });
  $('#flowReset').addEventListener('click', () => { stopPlaying(); goTo(-1, false).then(setPlayUI); });

  drawWires();
  if ('ResizeObserver' in window) new ResizeObserver(() => drawWires()).observe(grid);
  else window.addEventListener('resize', drawWires);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { drawWires(); sizeHandshake(); });

  // Auto-play the first time the diagram scrolls into view.
  if ('IntersectionObserver' in window && !reduceMotion) {
    const flowIO = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        flowIO.disconnect();
        if (state.index === -1 && !playing) setTimeout(play, 700);
      }
    }, { threshold: 0.25 });
    flowIO.observe(grid);
  }
})();
