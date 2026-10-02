# RediAds native renderer for Prebid.js

Custom renderer (`mediaTypes.native.rendererUrl`) per [Prebid native implementation](https://docs.prebid.org/prebid/native-implementation.html).

One native ad unit → one native imp per request → rendered at any of 12 display sizes.

## Files

- `../../dist/rediads-native-renderer.js` — host on your CDN; defines `window.renderAd(assets)` → HTML
- `adunit.example.js` — Prebid ad unit (ORTB native 1.2) + GPT slot with all 12 sizes
- `gam-creative.html` — GAM creative (PUC `native-render.js`, `requestAllAssets: true`)
- `demo.html` — local preview of sample layouts

## Local dev

```bash
npm run build
ln -sf ../../dist/rediads-native-renderer.js examples/public/rediads-native-renderer.js
npm run dev
# → http://localhost:5173/native/demo.html
```

## Asset ids (must match `mediaTypes.native.ortb.assets`)

| id | Asset |
|----|--------|
| 1 | title (required) |
| 2 | main image (required) |
| 3 | icon |
| 4 | body |
| 5 | CTA |
| 6 | sponsoredBy |

Use `buildNativeMediaType(rendererUrl)` from `@rediads/renderer` for the default ORTB block.
