# Hand checks (this edition ships no scripts)

The Claude plugin directory accepts only text, JSON, YAML and image files, so this edition has no `verify.mjs`. Run these checks by hand instead. The full edition (`npx skills add mfsass/skills --skill slop-diet`) runs all of them with one command.

Build the page first, open it in a browser, then check each line. Fix every failure. Stop after 3 fix rounds.

| # | Check | How |
|---|---|---|
| 1 | No sideways scroll at 320, 390 and 1440 px | Resize the window, or use device mode. The console line below returns `false` when the page fits. |
| 2 | Text contrast: 4.5:1 (3:1 for large text) | Devtools colour picker shows the ratio. Check rest, hover, focus, pressed and selected states. Use `:hov` to force a state. |
| 3 | Focus ring on every control | Press Tab through the page. Each stop shows a ring 2px or wider at 3:1 or more against its background. |
| 4 | Targets 44x44 px at 390 px | The console line below lists controls under 44 px. Inline links in a paragraph are exempt. |
| 5 | Content shows without JavaScript | Disable JavaScript in devtools and reload. Turn on "prefers-reduced-motion: reduce" under Rendering. Text, numbers, bars and lines must still show. |
| 6 | No console errors | Reload with the console open. It must be empty. |
| 7 | No decorative dots | Look for small round marks next to status, tags, rows or legends. Replace each with a text label or icon. |
| 8 | Page structure | One `h1`, headings in order, every input has a label, every button is a `button` element. |

## Console lines

Paste one line at a time in the devtools console.

Overflow (`false` means the page fits):

```js
document.documentElement.scrollWidth > innerWidth
```

Targets under 44 px (width 390; the list shows each control and its size):

```js
[...document.querySelectorAll('a,button,input,select,textarea,summary,[role=button],[tabindex]')].map(e=>[e,Math.round(e.getBoundingClientRect().width),Math.round(e.getBoundingClientRect().height)]).filter(([e,w,h])=>w&&h&&(w<44||h<44))
```

Small round elements that may be decorative dots:

```js
[...document.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>=5&&r.width<=14&&Math.abs(r.width-r.height)<1&&parseFloat(s.borderTopLeftRadius)>=r.width/2-1&&s.backgroundColor!=='rgba(0, 0, 0, 0)'})
```

## Then

Read [law-checklist.md](law-checklist.md) in full, mark each check C1 to Cn applies or N/A, and fix each one that applies and fails. Repeat the hand checks until every one passes.
