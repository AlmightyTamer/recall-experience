# Recall — cinematic landing experience

A standalone, mind-blowing marketing site for **Recall**, a cognitive-care
companion for people living with dementia.

> **Grey = memory fading. Color = identity restored.**

The page opens in monochrome — the *Recall* wordmark wreathed in drifting smoke —
draws to a grayscale portrait, zooms through her eye as a portal, and the moment
the app is unveiled the world bursts into 4K color: 3D butterflies flapping
through depth and flowers blooming everywhere, as scroll-driven sections tell the
story of what Recall does.

## Tech (all free, no build step)
- **GSAP + ScrollTrigger** — the master scroll choreography
- **Lenis** — smooth inertia scrolling
- **Three.js** — procedural smoke + the 3D butterfly swarm
- **Fraunces / Inter** (Google Fonts)
- Static HTML/CSS/JS — deploys straight to GitHub Pages

## Run locally
Any static server, e.g.:
```bash
npx serve .
```

## Structure
```
index.html   scene markup + CDN libs
styles.css   layout, type, the grey→color world
main.js      Lenis + GSAP timeline + Three.js smoke & butterflies
assets/      generated 4K imagery (portrait, iris, butterflies, flowers)
```

Hero imagery generated with Higgsfield (soul_2). Honors `prefers-reduced-motion`
with a calm, static fallback.
