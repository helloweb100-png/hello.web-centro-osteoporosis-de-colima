/* ==========================================================================
   ORTOPEDIA LAS PALMAS · Interacciones y animaciones
   Dependencias (cargadas en index.html): GSAP + ScrollTrigger, Lenis.
   Si no cargan, o si el usuario pide menos movimiento, la página funciona
   igual: se activa la clase "no-anim" y todo queda estático y legible.
   Índice: 01 Utilidades · 02 Funciones comunes · 03 Efectos (canvas) · 04 Loader
           05 Hero · 06 Secciones con scroll · 07 Cursor y botones · 08 Arranque
   ========================================================================== */
(() => {
  'use strict';

  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const root = document.documentElement;

  const WA_NUMBER    = '523121500753';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer  = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const canAnimate   = !reduceMotion && !!(window.gsap && window.ScrollTrigger);
  let lenis = null;
  let menuApi = { close() {} };
  let odoRef = null;
  const heroState = { progress: 0 };

  /* ======================================================================
     01 · UTILIDADES
     ====================================================================== */
  const safe = (fn, name) => { try { fn(); } catch (err) { console.error('[' + (name || fn.name) + ']', err); } };

  const whenVisible = (el, cb) => {
    if (!('IntersectionObserver' in window)) { cb(true); return; }
    new IntersectionObserver(es => es.forEach(e => cb(e.isIntersecting))).observe(el);
  };

  /** Divide el texto de un elemento en letras (cada una con su máscara). */
  function splitChars(el, extraClass) {
    const nodes = Array.from(el.childNodes), out = [];
    el.textContent = '';
    nodes.forEach(n => {
      if (n.nodeType === 3) {
        Array.from(n.textContent).forEach(ch => {
          const mask = document.createElement('span'); mask.className = 'mask';
          const c = document.createElement('span'); c.className = 'char' + (extraClass ? ' ' + extraClass : '');
          c.textContent = ch === ' ' ? '\u00A0' : ch; mask.appendChild(c); el.appendChild(mask); out.push(c);
        });
      } else if (n.nodeType === 1) {
        const mask = document.createElement('span'); mask.className = 'mask';
        n.classList.add('char'); if (extraClass) n.classList.add(extraClass);
        mask.appendChild(n); el.appendChild(mask); out.push(n);
      }
    });
    return out;
  }

  /** Divide en palabras conservando etiquetas internas (<em>). mode: 'mask' | 'plain'. */
  function splitWords(el, mode) {
    const words = [], out = document.createDocumentFragment();
    const walk = (src, dst) => src.childNodes.forEach(n => {
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach(tok => {
          if (!tok) return;
          if (/^\s+$/.test(tok)) { dst.appendChild(document.createTextNode(' ')); return; }
          if (mode === 'mask') {
            const w = document.createElement('span'); w.className = 'w';
            const i = document.createElement('span'); i.className = 'wi'; i.textContent = tok;
            w.appendChild(i); dst.appendChild(w); words.push(i);
          } else {
            const s = document.createElement('span'); s.className = 'word'; s.textContent = tok;
            dst.appendChild(s); words.push(s);
          }
        });
      } else if (n.nodeType === 1) {
        const c = n.cloneNode(false); dst.appendChild(c); walk(n, c);
      }
    });
    walk(el, out); el.textContent = ''; el.appendChild(out);
    return words;
  }

  /* ======================================================================
     02 · FUNCIONES COMUNES (siempre activas, con o sin animación)
     ====================================================================== */
  function initMenu() {
    const burger = $('.burger'), menu = $('#menu');
    if (!burger || !menu) return;
    const set = open => {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', String(!open));
      root.classList.toggle('menu-open', open);
      if (lenis) open ? lenis.stop() : lenis.start();
    };
    burger.addEventListener('click', () => set(burger.getAttribute('aria-expanded') !== 'true'));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
    matchMedia('(min-width: 900px)').addEventListener('change', e => { if (e.matches) set(false); });
    menuApi = { close: () => set(false) };
  }

  function initFaq() {
    const items = $$('.qa');
    items.forEach(qa => {
      const btn = $('.qa__q', qa);
      if (btn.getAttribute('aria-expanded') === 'true') qa.classList.add('is-open');
      btn.addEventListener('click', () => {
        const open = !qa.classList.contains('is-open');
        items.forEach(o => { o.classList.remove('is-open'); $('.qa__q', o).setAttribute('aria-expanded', 'false'); });
        if (open) { qa.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); }
        if (window.ScrollTrigger) setTimeout(() => ScrollTrigger.refresh(), 750);
      });
    });
  }

  /** Formulario: chips de producto + vista previa en vivo + envío a WhatsApp. */
  function initForm() {
    const form = $('#contactForm'); if (!form) return;
    const chips = $$('.chip', form), preview = $('#preview'), status = $('#formStatus');
    const nameI = $('#f-name'), telI = $('#f-tel'), msgI = $('#f-msg'), err = $('#f-name-err');
    const selected = () => chips.filter(c => c.getAttribute('aria-pressed') === 'true').map(c => c.textContent.trim());
    const list = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1];

    const build = () => {
      const items = selected(), name = nameI.value.trim(), tel = telI.value.trim(), msg = msgI.value.trim();
      let t = 'Hola Ortopedia Las Palmas' + (name ? ', soy ' + name : '') + '.';
      t += items.length ? ' Quiero información sobre: ' + list(items) + '.' : ' Quiero información sobre sus productos.';
      if (msg) t += ' ' + msg;
      if (tel) t += ' Mi número: ' + tel + '.';
      return t;
    };
    const refresh = (bump = true) => {
      const t = build();
      if (preview.textContent === t) return;
      preview.textContent = t;
      if (bump) { preview.classList.remove('is-bump'); void preview.offsetWidth; preview.classList.add('is-bump'); }
    };
    const setChips = names => { chips.forEach(c => c.setAttribute('aria-pressed', String(names.includes(c.textContent.trim())))); refresh(); };

    chips.forEach(c => c.addEventListener('click', () => {
      c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true')); refresh();
    }));
    [nameI, telI, msgI].forEach(i => i.addEventListener('input', () => {
      if (i === nameI && nameI.value.trim()) { nameI.closest('.field').classList.remove('is-error'); nameI.removeAttribute('aria-invalid'); err.textContent = ''; }
      refresh();
    }));
    // Las tarjetas de producto preseleccionan el formulario
    document.addEventListener('click', e => {
      const a = e.target.closest('[data-pick]');
      if (a) setChips(a.dataset.pick.split(',').map(s => s.trim()));
    });

    form.addEventListener('submit', e => {
      e.preventDefault();
      if ($('#f-web').value) return;                          // trampa anti-spam
      if (!nameI.value.trim()) {
        nameI.closest('.field').classList.add('is-error');
        nameI.setAttribute('aria-invalid', 'true');
        err.textContent = 'Cuéntanos tu nombre para saludarte.';
        nameI.focus();
        return;
      }
      status.textContent = 'Abriendo WhatsApp…';
      const a = document.createElement('a');
      a.href = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(build());
      a.target = '_blank'; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => { status.textContent = ''; }, 5000);
    });
    refresh(false);
  }

  /** Calendario decorativo de la tarjeta "consulta previa cita". */
  function initCalendar() {
    const box = $('.cal__d'); if (!box) return;
    const now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(today); start.setDate(today.getDate() - ((today.getDay() + 6) % 7));   // lunes
    const cells = [];
    for (let i = 0; i < 28; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const s = document.createElement('span'); s.textContent = d.getDate();
      const past = d < today; if (past) s.style.opacity = '.35';
      box.appendChild(s);
      if (!past && d.getDay() !== 0) cells.push(s);
    }
    if (!cells.length) return;
    let k = Math.min(2, cells.length - 1); cells[k].classList.add('on');
    if (!canAnimate) return;
    let visible = false; whenVisible(box, v => { visible = v; });
    setInterval(() => {
      if (!visible) return;
      cells[k].classList.remove('on');
      k = (k + 1 + Math.floor(Math.random() * 3)) % cells.length;
      cells[k].classList.add('on');
    }, 1600);
  }

  function buildDots() {
    const box = $('[data-dots]'); if (!box) return;
    for (let i = 0; i < 14; i++) { const d = document.createElement('i'); if (!canAnimate) d.className = 'on'; box.appendChild(d); }
  }

  /** Odómetro del teléfono de urgencias. Devuelve las columnas y los dígitos finales. */
  function buildOdo() {
    const el = $('[data-odo]'); if (!el) return null;
    const digits = el.dataset.odo.split('').map(Number), stacks = [];
    el.textContent = '';
    digits.forEach((d, i) => {
      if (i === 3 || i === 6 || i === 8) { const g = document.createElement('span'); g.className = 'odo__gap'; el.appendChild(g); }
      const col = document.createElement('span'); col.className = 'odo__d';
      const stack = document.createElement('span'); stack.className = 'odo__s';
      for (let n = 0; n < 10; n++) { const b = document.createElement('b'); b.textContent = n; stack.appendChild(b); }
      col.appendChild(stack); el.appendChild(col); stacks.push(stack);
      if (!canAnimate) stack.style.transform = 'translateY(' + (-d * 10) + '%)';
    });
    return { el, stacks, digits };
  }

  function initWaFloat() {
    const wa = $('#waFloat'); if (!wa) return;
    let shown = false;
    const onScroll = () => {
      if (shown || scrollY < innerHeight * 1.6) return;
      shown = true; removeEventListener('scroll', onScroll);
      wa.classList.add('show-label'); setTimeout(() => wa.classList.remove('show-label'), 6000);
    };
    addEventListener('scroll', onScroll, { passive: true });
  }

  function initAnchors() {
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      menuApi.close();
      if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.8, force: true, easing: t => 1 - Math.pow(1 - t, 4) });
      else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', id);
    });
  }

  /* ======================================================================
     03 · EFECTOS CON CANVAS
     ====================================================================== */
  /** Partículas del hero: cruces, anillos y puntos que suben y huyen del cursor. */
  function initHeroFx(stage) {
    const cv = $('#heroFx'); if (!cv) return { setActive() {} };
    const ctx = cv.getContext('2d');
    const PAL = ['rgba(10,15,61,.5)', 'rgba(232,38,44,.7)', 'rgba(255,255,255,.95)', 'rgba(27,42,143,.45)'];
    const mouse = { x: -999, y: -999 };
    let w = 0, h = 0, parts = [], active = true;
    const make = () => ({
      x: Math.random() * w, y: Math.random() * h, s: 3 + Math.random() * 8, vy: .12 + Math.random() * .42,
      ph: Math.random() * 6.28, sp: .4 + Math.random(), c: PAL[(Math.random() * PAL.length) | 0], k: (Math.random() * 3) | 0
    });
    const resize = () => {
      const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      parts = Array.from({ length: Math.round(Math.min(72, Math.max(26, w * h / 24000))) }, make);
    };
    resize(); new ResizeObserver(resize).observe(cv);
    stage.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
    stage.addEventListener('pointerleave', () => { mouse.x = mouse.y = -999; });

    gsap.ticker.add(time => {
      if (!active) return;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.y -= p.vy; p.x += Math.sin(time * p.sp + p.ph) * .22;
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < 16900) { const d = Math.sqrt(d2) || 1, f = (130 - d) / 130 * 3; p.x += dx / d * f; p.y += dy / d * f; }
        if (p.y < -20) { p.y = h + 20; p.x = Math.random() * w; }
        if (p.x < -20) p.x = w + 20; else if (p.x > w + 20) p.x = -20;
        ctx.strokeStyle = ctx.fillStyle = p.c;
        ctx.beginPath();
        if (p.k === 0) { ctx.arc(p.x, p.y, p.s * .45, 0, 6.283); ctx.fill(); }
        else if (p.k === 1) { ctx.lineWidth = 2; ctx.moveTo(p.x - p.s, p.y); ctx.lineTo(p.x + p.s, p.y); ctx.moveTo(p.x, p.y - p.s); ctx.lineTo(p.x, p.y + p.s); ctx.stroke(); }
        else { ctx.lineWidth = 1.5; ctx.arc(p.x, p.y, p.s, 0, 6.283); ctx.stroke(); }
      }
    });
    return { setActive: v => { active = v; } };
  }

  /** Huellas que dejan los pasos del cursor (en táctil, caminan solas). */
  function initSteps() {
    const cv = $('#stepsFx'), sec = $('#cierre'); if (!cv || !sec) return;
    const ctx = cv.getContext('2d'), auto = !finePointer, LIFE = 3600;
    const prints = [];
    let w = 0, h = 0, active = false, last = null, side = 1, lastAuto = null;
    const resize = () => {
      const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      w = r.width; h = r.height; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize(); new ResizeObserver(resize).observe(cv);

    const stamp = (x, y, ang) => {
      const nx = ang + Math.PI / 2;
      prints.push({ x: x + Math.cos(nx) * side * 20, y: y + Math.sin(nx) * side * 20, ang, side, t: performance.now() });
      side *= -1;
    };
    sec.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (!last) { last = { x, y }; return; }
      const dx = x - last.x, dy = y - last.y;
      if (Math.hypot(dx, dy) > 70) { stamp(x, y, Math.atan2(dy, dx)); last = { x, y }; }
    });
    sec.addEventListener('pointerleave', () => { last = null; });

    const foot = (p, a) => {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang + Math.PI / 2); ctx.scale(1.5, 1.5);
      ctx.fillStyle = p.side > 0 ? 'rgba(10,15,61,' + a + ')' : 'rgba(232,38,44,' + a + ')';
      ctx.beginPath(); ctx.ellipse(0, -7, 6.5, 9, 0, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, 10, 4.4, 4.8, 0, 0, 6.283); ctx.fill();
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * 3.2, -18.5 + Math.abs(i) * 1.2, 1.8 - Math.abs(i) * .15, 0, 6.283); ctx.fill(); }
      ctx.restore();
    };
    gsap.ticker.add(time => {
      if (!active) return;
      if (auto) {                                           // caminante automático para táctil
        const s = (time * 95) % (w + 160), x = s - 80, y = h * .5 + Math.sin(s / 110) * h * .2;
        const ang = Math.atan2(Math.cos(s / 110) * h * .2 / 110, 1);
        if (!lastAuto || Math.hypot(x - lastAuto.x, y - lastAuto.y) > 62) { if (!lastAuto || x > lastAuto.x) stamp(x, y, ang); lastAuto = { x, y }; }
      }
      if (!prints.length) return;
      ctx.clearRect(0, 0, w, h);
      const now = performance.now();
      for (let i = prints.length - 1; i >= 0; i--) {
        const age = (now - prints[i].t) / LIFE;
        if (age >= 1) { prints.splice(i, 1); continue; }
        foot(prints[i], (.9 * (1 - age) * (1 - age)).toFixed(3));
      }
      if (!prints.length) ctx.clearRect(0, 0, w, h);
    });
    ScrollTrigger.create({ trigger: sec, start: 'top bottom', end: 'bottom top', onToggle: s => { active = s.isActive; } });
  }

  /* ======================================================================
     04 · LOADER
     ====================================================================== */
  function startLoader(buildScroll, onReveal) {
    const loader = $('#loader'), num = $('#loaderNum'), feet = $$('.foot', loader);
    const st = { p: 0 };
    const paint = () => {
      num.textContent = Math.round(st.p);
      const lit = Math.floor(st.p / 100 * feet.length + .001);
      feet.forEach((f, i) => f.classList.toggle('on', i < lit));
    };
    const crawl = gsap.to(st, { p: 92, duration: 2.6, ease: 'power1.out', onUpdate: paint });

    const img = $('.hero__photo img');
    const decode = img && img.decode ? img.decode().catch(() => {}) : Promise.resolve();
    const loaded = document.readyState === 'complete' ? Promise.resolve() : new Promise(r => addEventListener('load', r, { once: true }));
    const fonts  = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    const guard  = new Promise(r => setTimeout(r, 7000));
    const minimum = new Promise(r => setTimeout(r, 2200));

    return Promise.all([Promise.race([Promise.all([fonts, decode, loaded]), guard]), minimum])
      .then(() => {
        crawl.kill();
        safe(buildScroll, 'buildScroll');
        return new Promise(res => gsap.to(st, { p: 100, duration: .5, ease: 'power2.out', onUpdate: paint, onComplete: res }));
      })
      .then(() => new Promise(res => {
        const tl = gsap.timeline({
          onComplete: () => {
            loader.remove(); root.classList.remove('is-loading'); root.classList.add('is-ready');
            if (lenis) lenis.start();
            ScrollTrigger.refresh(); res();
          }
        });
        tl.to('.loader__inner', { opacity: 0, scale: .92, y: -24, duration: .5, ease: 'power2.in' })
          .to('.loader__panel--t', { yPercent: -100, duration: 1.1, ease: 'expo.inOut' }, .3)
          .to('.loader__panel--b', { yPercent: 100, duration: 1.1, ease: 'expo.inOut' }, .3)
          .add(onReveal, .7);
      }))
      .catch(err => { console.error(err); loader.remove(); root.classList.remove('is-loading'); onReveal(); });
  }

  /* ======================================================================
     05 · HERO
     ====================================================================== */
  /** Prepara los estados iniciales y devuelve la línea de tiempo de entrada (en pausa). */
  function prepareHero() {
    const chars = [];
    $('.hero__title').setAttribute('aria-label', 'Cada paso cuenta.');
    $$('[data-chars]').forEach(w => { w.setAttribute('aria-hidden', 'true'); chars.push(...splitChars(w)); });

    gsap.set(chars, { yPercent: 118 });
    gsap.set('.hero__photo', { clipPath: 'inset(100% 0% 0% 0%)' });
    gsap.set('.hero__photo img', { scale: 1.5 });
    gsap.set('.hero__chip', { autoAlpha: 0, filter: 'blur(12px)' });
    gsap.set('.hero__badge', { scale: 0, rotation: -120 });
    gsap.set('.hero__foot > *', { y: 34, autoAlpha: 0 });
    gsap.set('.hero__brand', { y: 34, autoAlpha: 0 });
    gsap.set('.hdr__bar', { yPercent: -170 });

    return gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } })
      .to('.hero__photo', { clipPath: 'inset(-5% -5% -5% -5%)', duration: 1.5, ease: 'power4.inOut' }, 0)
      .to('.hero__photo img', { scale: 1.04, duration: 2.2 }, 0)
      .to(chars, { yPercent: 0, duration: 1.3, stagger: .05 }, .2)
      .to('.hero__chip', { autoAlpha: 1, filter: 'blur(0px)', duration: 1, stagger: .15 }, .9)
      .to('.hero__badge', { scale: 1, rotation: 0, duration: 1.2, ease: 'back.out(1.6)' }, .8)
      .to('.hero__foot > *', { y: 0, autoAlpha: 1, duration: 1, stagger: .12 }, .8)
      .to('.hero__brand', { y: 0, autoAlpha: 1, duration: 1 }, 1)
      .to('.hdr__bar', { yPercent: 0, duration: 1 }, 1);
  }

  /** Escena fijada: el arco de la foto se expande hasta llenar la pantalla. */
  function heroScroll() {
    const stage = $('.hero__stage'), photo = $('.hero__photo');
    const fx = initHeroFx(stage);

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: stage, start: 'top top', end: () => '+=' + Math.round(innerHeight * 1.2),
        pin: true, scrub: .7, anticipatePin: 1, invalidateOnRefresh: true, refreshPriority: 10,
        onUpdate: self => { heroState.progress = self.progress; },
        onToggle: self => fx.setActive(self.isActive || self.progress === 0)
      }
    });
    tl.to(photo, {
        width: () => stage.clientWidth, height: () => stage.clientHeight, top: 0,
        borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
        duration: 1, ease: 'power2.inOut'
      }, 0)
      .to('.hero__ring', { opacity: 0, duration: .25 }, 0)
      .to('.hero__word--a', { xPercent: -70, autoAlpha: 0, duration: .7 }, 0)
      .to('.hero__word--b', { xPercent: 70, autoAlpha: 0, duration: .7 }, 0)
      .to('.hero__word--c', { xPercent: -45, autoAlpha: 0, duration: .65 }, .05)
      .to('.hero__chips', { autoAlpha: 0, duration: .25 }, 0)
      .to('.hero__badge', { autoAlpha: 0, duration: .3 }, 0)
      .to('.hero__foot', { autoAlpha: 0, y: -60, duration: .35 }, 0)
      .to('.hero__brand', { autoAlpha: 0, y: -60, duration: .35 }, 0)
      .to('.hero__veil', { opacity: 1, duration: .55 }, .45);

    // Parallax del puntero (solo ratón, solo al inicio de la escena)
    if (finePointer) {
      const a = gsap.quickTo('.hero__word--a', 'x', { duration: .9, ease: 'power3' });
      const b = gsap.quickTo('.hero__word--b', 'x', { duration: .9, ease: 'power3' });
      const c = gsap.quickTo('.hero__word--c', 'x', { duration: .9, ease: 'power3' });
      const ry = gsap.quickTo('.hero__photo-in', 'rotationY', { duration: .8, ease: 'power3' });
      const rx = gsap.quickTo('.hero__photo-in', 'rotationX', { duration: .8, ease: 'power3' });
      gsap.set('.hero__photo-in', { transformPerspective: 1100 });
      stage.addEventListener('pointermove', e => {
        const on = heroState.progress < .03;
        const nx = (e.clientX / innerWidth - .5) * 2, ny = (e.clientY / innerHeight - .5) * 2;
        a(on ? nx * -26 : 0); b(on ? nx * 26 : 0); c(on ? nx * -18 : 0);
        ry(on ? nx * 7 : 0); rx(on ? ny * -6 : 0);
      });
    }
  }

  /* ======================================================================
     06 · SECCIONES CON SCROLL
     ====================================================================== */
  function manifestoScroll() {
    const text = $('[data-words]'); if (!text) return;
    const words = splitWords(text, 'plain');
    gsap.set(words, { opacity: .16 });
    gsap.to(words, {
      opacity: 1, ease: 'none', duration: 1, stagger: .5,
      scrollTrigger: { trigger: '.manifesto', start: 'top 25%', end: 'bottom 85%', scrub: true }
    });
    gsap.from('[data-facts] li', {
      y: 40, opacity: 0, duration: .9, stagger: .12, ease: 'expo.out',
      scrollTrigger: { trigger: '.manifesto', start: 'top 35%', once: true }
    });
  }

  /** Cinta de productos: se mueve sola y se acelera con la velocidad del scroll. */
  function ribbonScroll() {
    const track = $('[data-ribbon]'); if (!track) return;
    Array.from(track.children).forEach(el => { const c = el.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.appendChild(c); });
    const anim = gsap.to(track, { xPercent: -50, ease: 'none', duration: 40, repeat: -1 });
    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: self => {
        const dir = self.direction || 1, boost = 1 + Math.min(Math.abs(self.getVelocity()) / 260, 6);
        gsap.to(anim, { timeScale: dir * boost, duration: .25, overwrite: true, onComplete: () => gsap.to(anim, { timeScale: dir, duration: 1.2 }) });
      }
    });
  }

  /** Productos: en escritorio la sección se fija y avanza en horizontal; en móvil es un carrusel. */
  function productsScroll() {
    const mm = gsap.matchMedia();
    const now = $('#prodNow'), bar = $('#prodBar');

    mm.add('(min-width: 900px)', () => {
      const pin = $('.prod__pin'), track = $('[data-track]');
      const dist = () => Math.max(0, track.scrollWidth - pin.clientWidth);
      const total = $$('.pcard').length;
      const tween = gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: {
          trigger: pin, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: .6, anticipatePin: 1,
          invalidateOnRefresh: true, refreshPriority: 5,
          onUpdate: self => {
            if (bar) bar.style.transform = 'scaleX(' + self.progress.toFixed(4) + ')';
            if (now) now.textContent = String(Math.min(total, Math.floor(self.progress * total) + 1)).padStart(2, '0');
          }
        }
      });
      $$('.pcard').forEach(card => {
        const img = $('img', card);
        gsap.fromTo(img, { xPercent: -7 }, {
          xPercent: 7, ease: 'none',
          scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true }
        });
      });
    });

    mm.add('(max-width: 899px)', () => {
      gsap.from('.pcard', { y: 60, opacity: 0, duration: 1, stagger: .1, ease: 'expo.out', scrollTrigger: { trigger: '.prod__track', start: 'top 85%', once: true } });
    });
  }

  /** Títulos: las palabras suben desde una máscara y el subrayado amarillo se dibuja. */
  function headingReveals() {
    $$('[data-words-in]').forEach(h => {
      const words = splitWords(h, 'mask');
      gsap.set(words, { yPercent: 115 });
      const inPin = !!h.closest('.prod');
      ScrollTrigger.create({
        trigger: inPin ? '.prod' : h, start: inPin ? 'top 55%' : 'top 88%', once: true,
        onEnter: () => { h.classList.add('is-in'); gsap.to(words, { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: .045 }); }
      });
    });
  }

  function bentoScroll() {
    gsap.set('[data-reveal]', { opacity: 0, y: 70, scale: .97 });
    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 88%', once: true,
      onEnter: b => gsap.to(b, { opacity: 1, y: 0, scale: 1, duration: 1.1, ease: 'expo.out', stagger: .12, clearProps: 'transform' })
    });

    // Conversación de WhatsApp que se escribe sola, en bucle
    const body = $('[data-chat]');
    if (body) {
      const msgs = $$('.msg:not(.msg--typing)', body), typing = $('.msg--typing', body), all = [...msgs, typing];
      msgs.forEach(m => { m.style.transformOrigin = m.classList.contains('msg--out') ? 'right bottom' : 'left bottom'; });
      gsap.set(all, { autoAlpha: 0, y: 14, scale: .96 });
      const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: .6 });
      msgs.forEach((m, i) => tl.to(m, { autoAlpha: 1, y: 0, scale: 1, duration: .5, ease: 'back.out(1.5)' }, .3 + i * 1.3));
      tl.to(typing, { autoAlpha: 1, y: 0, scale: 1, duration: .4 }, .3 + msgs.length * 1.3)
        .to({}, { duration: 1.8 })
        .to(all, { autoAlpha: 0, y: -8, duration: .5, stagger: .04 });
      ScrollTrigger.create({ trigger: body, start: 'top 90%', end: 'bottom 5%', onToggle: s => s.isActive ? tl.play() : tl.pause() });
    }

    // Contador 0 → 14 con puntos que se encienden
    const num = $('[data-count]'), dots = $$('[data-dots] i');
    if (num) {
      const target = +num.dataset.count, o = { v: 0 };
      num.textContent = '0';
      ScrollTrigger.create({
        trigger: num, start: 'top 88%', once: true,
        onEnter: () => gsap.to(o, {
          v: target, duration: 2, ease: 'power2.out',
          onUpdate: () => { const n = Math.round(o.v); num.textContent = n; dots.forEach((d, i) => d.classList.toggle('on', i < n)); }
        })
      });
    }
  }

  function processScroll() {
    const wrap = $('[data-steps]'); if (!wrap) return;
    gsap.fromTo('[data-line]', { scaleY: 0 }, {
      scaleY: 1, ease: 'none',
      scrollTrigger: { trigger: wrap, start: 'top 65%', end: 'bottom 55%', scrub: .4 }
    });
    $$('[data-step]').forEach(s => {
      gsap.from(s, { opacity: 0, y: 60, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: s, start: 'top 90%', once: true } });
      ScrollTrigger.create({
        trigger: s, start: 'top 62%',
        onEnter: () => s.classList.add('is-on'), onLeaveBack: () => s.classList.remove('is-on')
      });
    });
  }

  function galleryScroll() {
    $$('.gal__col').forEach(col => {
      const speed = parseFloat(col.dataset.speed || '0');
      gsap.to(col, {
        yPercent: () => speed * (innerWidth < 900 ? .8 : 2.2), ease: 'none',
        scrollTrigger: { trigger: '.gal__cols', start: 'top bottom', end: 'bottom top', scrub: .5, invalidateOnRefresh: true }
      });
    });
    $$('[data-reveal-img]').forEach(fig => {
      const img = $('img', fig);
      gsap.set(fig, { clipPath: 'inset(100% 0% 0% 0%)' });
      gsap.set(img, { scale: 1.45 });
      ScrollTrigger.create({
        trigger: fig, start: 'top 90%', once: true,
        onEnter: () => {
          gsap.to(fig, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'power4.inOut' });
          gsap.to(img, { scale: 1.15, duration: 2, ease: 'expo.out' });
        }
      });
    });
  }

  function urgencyScroll() {
    const t = $('[data-urg-text]');
    if (t) gsap.fromTo(t, { x: 0 }, {
      x: () => -Math.max(0, t.scrollWidth - innerWidth * .6), ease: 'none',
      scrollTrigger: { trigger: '.urg', start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true }
    });

    const odo = odoRef;           // construido en initCommon; aquí solo se anima
    if (odo) {
      gsap.set(odo.stacks, { yPercent: (i) => -(((odo.digits[i] + 5 + i * 3) % 10) * 10) });
      ScrollTrigger.create({
        trigger: odo.el, start: 'top 85%', once: true,
        onEnter: () => gsap.to(odo.stacks, { yPercent: i => -odo.digits[i] * 10, duration: i => 1.6 + i * .13, ease: 'power3.out' })
      });
    }
  }

  function footerScroll() {
    const word = $('[data-word]'); if (!word) return;
    const chars = [];
    Array.from(word.children).forEach(s => chars.push(...splitChars(s, 'ch')));
    gsap.set(chars, { yPercent: 110 });
    ScrollTrigger.create({
      trigger: word, start: 'top 95%', once: true,
      onEnter: () => gsap.to(chars, { yPercent: 0, duration: 1.4, ease: 'expo.out', stagger: .035 })
    });
  }

  function chromeScroll() {
    const hdr = $('#hdr'), links = $$('[data-nav]'), bar = $('#progressBar');
    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: self => {
        hdr.classList.toggle('is-hidden', self.direction === 1 && self.scroll() > 600 && !root.classList.contains('menu-open'));
        bar.style.transform = 'scaleX(' + self.progress.toFixed(4) + ')';
      }
    });
    ['productos', 'atencion', 'proceso', 'urgencias', 'preguntas', 'contacto'].forEach(id => {
      const sec = document.getElementById(id); if (!sec) return;
      ScrollTrigger.create({
        trigger: sec, start: 'top 50%', end: 'bottom 50%',
        onToggle: self => links.forEach(l => { if (l.getAttribute('href') === '#' + id) l.classList.toggle('is-active', self.isActive); })
      });
    });
  }

  /* ======================================================================
     07 · CURSOR Y BOTONES MAGNÉTICOS
     ====================================================================== */
  function initCursor() {
    if (!finePointer) return;
    root.classList.add('has-cursor');
    const cur = $('#cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring'), label = $('b', ring);
    const dx = gsap.quickTo(dot, 'x', { duration: .1, ease: 'none' }), dy = gsap.quickTo(dot, 'y', { duration: .1, ease: 'none' });
    const rx = gsap.quickTo(ring, 'x', { duration: .55, ease: 'power3' }), ry = gsap.quickTo(ring, 'y', { duration: .55, ease: 'power3' });
    gsap.set(cur, { opacity: 0 });
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
      gsap.to(cur, { opacity: 1, duration: .3, overwrite: 'auto' });
    });
    document.addEventListener('pointerover', e => {
      const t = e.target.closest('a, button, [data-cursor], input, textarea');
      const txt = t && t.dataset ? t.dataset.cursor : '';
      cur.classList.toggle('is-link', !!t && !txt);
      cur.classList.toggle('is-label', !!txt);
      label.textContent = txt || '';
    });
    document.addEventListener('pointerdown', () => cur.classList.add('is-down'));
    document.addEventListener('pointerup', () => cur.classList.remove('is-down'));
    root.addEventListener('mouseleave', () => gsap.to(cur, { opacity: 0, duration: .3 }));
  }

  function initMagnetic() {
    if (!finePointer) return;
    $$('[data-magnetic]').forEach(el => {
      const xTo = gsap.quickTo(el, 'x', { duration: .6, ease: 'power3' }), yTo = gsap.quickTo(el, 'y', { duration: .6, ease: 'power3' });
      el.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * .28); yTo((e.clientY - (r.top + r.height / 2)) * .35);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  /** Inclinación 3D y brillo que sigue al puntero en las tarjetas de producto. */
  function initTilt() {
    if (!finePointer) return;
    $$('[data-tilt]').forEach(card => {
      gsap.set(card, { transformPerspective: 900 });
      const rx = gsap.quickTo(card, 'rotationX', { duration: .6, ease: 'power3' }), ry = gsap.quickTo(card, 'rotationY', { duration: .6, ease: 'power3' });
      card.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        const r = card.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        ry((px - .5) * 10); rx((.5 - py) * 10);
        card.style.setProperty('--gx', (px * 100).toFixed(1) + '%'); card.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
      });
      card.addEventListener('pointerleave', () => { rx(0); ry(0); });
    });
  }

  /* ======================================================================
     08 · ARRANQUE
     ====================================================================== */
  function initCommon() {
    const year = $('#year'); if (year) year.textContent = new Date().getFullYear();
    safe(initMenu); safe(initFaq); safe(initForm); safe(initCalendar); safe(buildDots); safe(initWaFloat); safe(initAnchors);
    safe(() => { odoRef = buildOdo(); }, 'buildOdo');
  }

  function buildScroll() {
    // Orden = orden del documento (importante para las secciones fijadas)
    safe(chromeScroll);
    safe(heroScroll);
    safe(manifestoScroll);
    safe(ribbonScroll);
    safe(productsScroll);
    safe(headingReveals);
    safe(bentoScroll);
    safe(processScroll);
    safe(galleryScroll);
    safe(urgencyScroll);
    safe(footerScroll);
    safe(initSteps);
    safe(initTilt);
    safe(initMagnetic);
  }

  function boot() {
    initCommon();

    if (!canAnimate) {                       // sin GSAP o con "reducir movimiento": versión estática
      root.classList.add('no-anim');
      root.classList.remove('is-loading');
      const l = $('#loader'); if (l) l.remove();
      return;
    }

    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    root.classList.add('is-anim');
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    scrollTo(0, 0);

    if (window.Lenis && finePointer) {
      lenis = new Lenis({ lerp: .085, smoothWheel: true, wheelMultiplier: .95 });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
      lenis.stop();
    }

    initCursor();
    const intro = prepareHero();
    startLoader(buildScroll, () => intro.play());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
