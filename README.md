# Upmanyu-Portfolio

My portfolio: code, research and design work.

Static site, no build step. Open `html/index.html` through any local server
(VS Code Live Server works) or host the folder as is.

## Layout

```
html/    index, projects, design, about, contact
css/     style.css   tokens, reset, type
         shared.css  nav, buttons, cursor, loader, curtain, footer
         <page>.css  one file per page
js/      boot.js     runs in <head>: first-visit vs. returning, failsafe
         forms.js    the point-cloud figures (orrery, ocean, helix, moon, ...)
         swarm.js    WebGL renderer that morphs between figures
         main.js     scroll, reveals, gallery, cursor, page transitions
assets/  images
```

## The dotted figures

Each section that should show a figure carries a `data-swarm` attribute:

```html
<section data-swarm='{"form":"moon","x":0.46,"y":0.02,"size":0.62,"m":{"x":0,"y":0.5,"size":0.4}}'>
```

- `form`: `orrery`, `wave`, `helix`, `moon`, `pages`, `bezier`, `dust`,
  `portrait` (needs `src`), or `glyph:<text>` for lettering
- `x`, `y`: position, from -1 to 1 across the viewport; `size`: scale
- `yaw`, `pitch`, `tilt`, `spin`, `sway`, `alpha`, `dot`: optional
- `m`: overrides for screens narrower than 820px

The swarm morphs from one section's figure to the next as you scroll.

## Libraries (CDN, free)

GSAP + ScrollTrigger + SplitText, Lenis. Fonts: Host Grotesk, DM Mono.
