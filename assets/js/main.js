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

  const toggleFullscreen = () => {
    if (!document.fullscreenEnabled) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else doc.requestFullscreen().catch(() => {});
  };

  /* ---------------------------------------------------------------- Toast */
  const toastEl = $('#toast');
  let toastTimer;
  const toast = (msg) => {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1600);
  };

  /* ------------------------------------------------- Sections & navigation */
  const slides = $$('.slide');
  const topLinks = $$('.topnav a');
  const topbar = $('.topbar');
  const progress = $('.progress span');
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

  /* ------------------------------------------------------------ Fade-in */
  const reveals = $$('.reveal');
  reveals.forEach((el) => {
    const sibs = Array.from(el.parentElement.children).filter((c) => c.classList.contains('reveal'));
    el.style.setProperty('--d', `${Math.min(Math.max(0, sibs.indexOf(el)) * 0.08, 0.4)}s`);
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

  /* ------------------------------------------------------------- OS switch */
  const detectOS = () => {
    const ua = navigator.userAgent || '';
    const plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
    if (/win/i.test(plat) || /Windows/i.test(ua)) return 'win';
    if (/mac|iphone|ipad/i.test(plat) || /Mac OS X|iPhone|iPad/i.test(ua)) return 'mac';
    return 'linux';
  };
  const osButtons = $$('.os-switch button');
  const setOS = (os) => {
    doc.dataset.os = os;
    osButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.os === os)));
  };
  osButtons.forEach((b) => b.addEventListener('click', () => { setOS(b.dataset.os); store.set('ptp-os', b.dataset.os); }));
  const savedOS = store.get('ptp-os');
  setOS(['mac', 'win', 'linux'].includes(savedOS) ? savedOS : detectOS());

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

  $$('.code').forEach((block) => {
    const btn = $('.copy', block);
    const codeEl = $('code', block);
    if (!btn || !codeEl) return;
    const label = $('span', btn);
    btn.addEventListener('click', async () => {
      const clone = codeEl.cloneNode(true);
      const isShell = !!$('.p', clone);
      const os = doc.dataset.os;
      $$('[data-show]', clone).forEach((n) => { if (!n.dataset.show.split(' ').includes(os)) n.remove(); });
      $$('.p, .out', clone).forEach((n) => n.remove());
      let text = clone.textContent;
      if (isShell) text = text.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim() !== '').join('\n');
      const ok = await copyText(text.trim());
      btn.classList.add('copied');
      label.textContent = ok ? 'Copied' : 'Press Ctrl+C';
      if (ok) toast('Copied to clipboard');
      setTimeout(() => { btn.classList.remove('copied'); label.textContent = 'Copy'; }, 1600);
    });
  });

  /* --------------------------------------------------------- Push streak */
  const hs = $('.hs');
  const sizeStreak = () => { if (hs) hs.style.setProperty('--hs-h', `${hs.offsetHeight - 40}px`); };
  sizeStreak();
  window.addEventListener('resize', sizeStreak);

  /* ------------------------------------------------------- Terminal helpers */
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

  /* ---------------------------------------------------------- Hero terminal */
  const heroTerm = $('#heroTerm');
  const HERO = [
    { t: 'cmd', text: 'claude' },
    { t: 'sys', html: '<span class="spark">✻</span> Claude Code <span class="dim">· ~/my-site</span>' },
    { t: 'ask', text: 'Add a dark-mode toggle, then commit and push it.' },
    { t: 'think', text: 'Planning the change' },
    { t: 'tool', name: 'Read', arg: 'index.html' },
    { t: 'tool', name: 'Update', arg: 'assets/style.css', extra: '+42 −3' },
    { t: 'tool', name: 'Bash', arg: 'git add index.html assets/style.css' },
    { t: 'tool', name: 'Bash', arg: 'git commit -m "feat: add dark-mode toggle"' },
    { t: 'tool', name: 'Bash', arg: 'git push origin main' },
    { t: 'ok', text: '  ⎿ main → origin/main' },
    { t: 'done', text: '● Done. Live at you.github.io/my-site' },
  ];

  let heroVisible = true;
  let heroWaiters = [];
  const flushHero = () => { if (heroVisible && !document.hidden) { heroWaiters.forEach((r) => r()); heroWaiters = []; } };
  const heroReady = () => (heroVisible && !document.hidden ? Promise.resolve() : new Promise((r) => heroWaiters.push(r)));
  document.addEventListener('visibilitychange', flushHero);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((en) => { heroVisible = en[0].isIntersecting; flushHero(); }, { threshold: 0.05 }).observe(heroTerm);
  }

  const renderHeroStatic = () => {
    heroTerm.innerHTML = '';
    HERO.forEach((item) => {
      if (item.t === 'cmd') heroTerm.appendChild(line('', `<span class="p">$</span> ${esc(item.text)}`));
      else if (item.t === 'sys') heroTerm.appendChild(line('', item.html));
      else if (item.t === 'ask') heroTerm.appendChild(line('ask', `<span class="p">&gt;</span> ${esc(item.text)}`));
      else if (item.t === 'tool') heroTerm.appendChild(line('tool', toolHTML(item)));
      else if (item.t === 'ok' || item.t === 'done') heroTerm.appendChild(line(item.t, esc(item.text)));
    });
  };

  const runHero = async () => {
    const SPIN = ['·', '✢', '✳', '✶', '✻', '✽'];
    for (;;) {
      heroTerm.innerHTML = '';
      await sleep(400);
      for (const item of HERO) {
        await heroReady();
        if (item.t === 'cmd' || item.t === 'ask') {
          const isAsk = item.t === 'ask';
          const el = line(isAsk ? 'ask enter' : 'enter', `<span class="p">${isAsk ? '&gt;' : '$'}</span> `);
          const tx = document.createElement('span');
          const c = caret();
          el.appendChild(tx);
          el.appendChild(c);
          heroTerm.appendChild(el);
          await sleep(isAsk ? 300 : 500);
          await typeText(tx, item.text, isAsk ? 26 : 70);
          await sleep(380);
          c.remove();
          await sleep(isAsk ? 300 : 200);
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
          await sleep(item.name === 'Bash' ? 720 : 560);
        } else {
          heroTerm.appendChild(line(`${item.t} enter`, esc(item.text)));
          await sleep(420);
        }
      }
      const tail = line('enter', '<span class="p">$</span> ');
      tail.appendChild(caret());
      heroTerm.appendChild(tail);
      await sleep(5200);
      await heroReady();
      heroTerm.classList.add('fade');
      await sleep(450);
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
      desc: 'Start Claude Code inside the folder and describe the outcome you want, the way you would brief a teammate.',
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
      desc: 'With GitHub Pages turned on (Settings → Pages), every new commit on <code>main</code> republishes your site automatically.',
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

  const state = { index: -1 };
  let wires = [];
  let animToken = 0;
  let panelToken = 0;
  let playing = false;
  let runId = 0;

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

  const pathBetween = (a, b) => {
    const acx = a.x + a.w / 2;
    const bcx = b.x + b.w / 2;
    const acy = a.y + a.h / 2;
    const bcy = b.y + b.h / 2;
    if (Math.abs(acy - bcy) < 6) {
      return bcx > acx ? `M ${a.x + a.w} ${acy} L ${b.x - 2} ${bcy}` : `M ${a.x} ${acy} L ${b.x + b.w + 2} ${bcy}`;
    }
    if (Math.abs(acx - bcx) < 6) return `M ${acx} ${a.y + a.h} L ${bcx} ${b.y - 2}`;
    const dir = bcx > acx ? 1 : -1;
    const ex = dir > 0 ? b.x - 2 : b.x + b.w + 2;
    const r = Math.min(12, Math.abs(bcy - (a.y + a.h)) / 2);
    return `M ${acx} ${a.y + a.h} L ${acx} ${bcy - r} Q ${acx} ${bcy} ${acx + dir * r} ${bcy} L ${ex} ${bcy}`;
  };

  const setWire = (k, lit) => {
    const w = wires[k];
    if (!w) return;
    w.on.style.strokeDashoffset = lit ? 0 : w.len;
    w.base.setAttribute('marker-end', lit ? 'url(#mkOn)' : 'url(#mkIdle)');
  };
  const paintWires = (i) => wires.forEach((_, k) => setWire(k, k < i));

  const drawWires = () => {
    if (!grid.offsetParent) return;
    const gr = grid.getBoundingClientRect();
    const boxes = nodes.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left - gr.left, y: r.top - gr.top, w: r.width, h: r.height };
    });
    const marker = (id, cls) =>
      `<marker id="${id}" viewBox="0 0 10 10" refX="8.5" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><path class="${cls}" d="M2 1.5 L8.5 5 L2 8.5"/></marker>`;
    let html = `<defs>${marker('mkIdle', 'mk-idle')}${marker('mkOn', 'mk-on')}${marker('mkLoop', 'mk-loop')}</defs>`;
    for (let i = 0; i < boxes.length - 1; i++) {
      const d = pathBetween(boxes[i], boxes[i + 1]);
      html += `<path class="wire" data-i="${i}" d="${d}" marker-end="url(#mkIdle)"/><path class="wire-on" data-i="${i}" d="${d}"/>`;
    }
    const a = boxes[boxes.length - 1];
    const b = boxes[1];
    const gx = 9;
    const ay = a.y + a.h / 2;
    const by = b.y + b.h / 2;
    html += `<path class="wire loop" d="M ${a.x - 2} ${ay} L ${gx + 10} ${ay} Q ${gx} ${ay} ${gx} ${ay - 10} L ${gx} ${by + 10} Q ${gx} ${by} ${gx + 10} ${by} L ${b.x - 3} ${by}" marker-end="url(#mkLoop)"/>`;
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
    const park = () => { [packet, halo].forEach((c) => { c.setAttribute('cx', -9999); c.setAttribute('cy', -9999); }); };
    const t0 = performance.now();
    const frame = (now) => {
      if (token !== animToken) { park(); resolve(); return; }
      const t = Math.min(1, (now - t0) / dur);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      w.on.style.strokeDashoffset = w.len * (1 - e);
      const pt = w.on.getPointAtLength(w.len * e);
      [packet, halo].forEach((c) => { c.setAttribute('cx', pt.x); c.setAttribute('cy', pt.y); });
      if (t < 1) { requestAnimationFrame(frame); return; }
      park();
      setWire(k, true);
      resolve();
    };
    requestAnimationFrame(frame);
  });

  const termLine = (kind, a, b, c) => {
    if (kind === 'cmd') return line('enter', '<span class="p">$</span> ');
    if (kind === 'ask') return line('ask enter', '<span class="p">&gt;</span> ');
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
    fpTermTitle.textContent = i === 0 ? '~' : '~/my-site — claude';
    panel.classList.remove('swap');
    void panel.offsetWidth;
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

  function setPlayUI() {
    playBtn.classList.toggle('playing', playing);
    playLabel.textContent = playing ? 'Pause' : (state.index >= STEPS.length - 1 ? 'Replay' : 'Play');
    playBtn.setAttribute('aria-label', playing ? 'Pause the flow' : 'Play the flow');
  }
  function stopPlaying() { playing = false; runId++; setPlayUI(); }

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
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { drawWires(); sizeStreak(); });

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
