# Scroll-motion starter

Zero dependencies. Copy the CSS into your stylesheet and the script to the end of `<body>`. Usage: [craft-floor.md](craft-floor.md#motion-with-purpose).

## CSS

```css
/* Scroll motion: pair with scroll-motion.js. Hidden start states exist only under html.js, so the page is complete at rest. */
/* Transitions sit on .is-in, so the hidden state is instant (no fade-out flash when js is added). */
@media (prefers-reduced-motion: no-preference) {
  [data-count] { font-variant-numeric: tabular-nums; }
  .js [data-m], .js [data-grow], .js [data-draw] { --d: calc(var(--i, 0) * var(--step, 60ms)); } /* inline --d overrides, e.g. area fill after the line */
  .js [data-m]:not(.is-in) { opacity: 0; transform: translateY(8px); }
  .js [data-m].is-in { transition: opacity 280ms cubic-bezier(.23, 1, .32, 1) var(--d), transform 280ms cubic-bezier(.23, 1, .32, 1) var(--d); }
  .js [data-grow] { transform-origin: bottom; } /* data-grow="x" grows from the left */
  .js [data-grow="x"] { transform-origin: left; }
  .js [data-grow]:not(.is-in) { transform: scaleY(0); }
  .js [data-grow="x"]:not(.is-in) { transform: scaleX(0); }
  .js [data-grow].is-in { transition: transform 600ms cubic-bezier(.23, 1, .32, 1) var(--d); } /* house default */
  .js [data-draw] { stroke-dasharray: 1; } /* path has pathLength="1" */
  .js [data-draw]:not(.is-in) { stroke-dashoffset: 1; }
  .js [data-draw].is-in { transition: stroke-dashoffset 1000ms cubic-bezier(.25, 1, .5, 1); }
}
```

## JavaScript

```js
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
```
