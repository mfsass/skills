// Scroll motion: one-shot IntersectionObserver. Under reduced motion or without IntersectionObserver it exits before adding html.js, so nothing hides.
(() => {
  const els = [...document.querySelectorAll('[data-m],[data-grow],[data-draw],[data-count]')];
  if (!els.length || !('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('[data-stagger]').forEach((g) => [...g.children].forEach((c, i) => c.style.setProperty('--i', Math.min(i, 6)))); // 6 x 60ms: last item starts by about 400ms
  const count = (el) => { // the real value stays in the HTML; the text is swapped only while counting (house default 900ms)
    const final = el.textContent, end = parseFloat(el.dataset.count), dp = +el.dataset.dp || 0, t0 = performance.now();
    el.setAttribute('role', 'img'); el.setAttribute('aria-label', final);
    const tick = (t) => {
      const p = Math.min((t - t0) / 900, 1);
      el.textContent = p < 1 ? (end * (1 - (1 - p) ** 3)).toLocaleString(undefined, { maximumFractionDigits: dp, minimumFractionDigits: dp }) : final;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const seen = (el) => { el.classList.add('is-in'); if (el.dataset.count) count(el); };
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { seen(e.target); io.unobserve(e.target); } }), { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
  els.forEach((el) => (el.getBoundingClientRect().top < innerHeight * 0.9 ? seen(el) : io.observe(el)));
  document.documentElement.classList.add('js');
})();
