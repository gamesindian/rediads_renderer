/*!
 * RediAds native renderer for Prebid.js — v1.0.0
 * Loaded by Prebid via mediaTypes.native.rendererUrl. Defines window.renderAd(assets) -> HTML.
 * One native imp, twelve display sizes: the layout is chosen from the creative iframe's size.
 *
 * Asset ids (must match mediaTypes.native.ortb.assets):
 *   1 title | 2 main image (img type 3) | 3 icon (img type 1)
 *   4 body (data type 2) | 5 CTA (data type 12) | 6 sponsoredBy (data type 1)
 *
 * Clicks: every clickable surface is <a class="pb-click">; Prebid attaches its click-tracker
 * listener to .pb-click and the href navigates to the clickUrl. Impression trackers are fired by Prebid.
 * Force a size (testing / non-matching iframe): set window.rediadsSize = '728x90' before load.
 */
(function (w) {
  'use strict';

  var SIZES = [[300,250],[320,50],[320,480],[300,600],[728,90],[970,250],[970,90],[728,250],[160,600],[120,600],[336,280],[320,100]];
  var INK = '#1A1D22', PAPER = '#FBFBFA', LINE = '#EDEDEA', MUTED = '#6B717A', BODY = '#4A5059', ACCENT = '#FF6B1A';
  var FONT = "'Instrument Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
  var FONT_CSS = 'https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&display=swap';
  var ID = { 1: 'title', 2: 'image', 3: 'icon', 4: 'body', 5: 'cta', 6: 'sponsoredBy' };

  /* ---------------------------------------------------------------- utils */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function str(v) { return v == null ? '' : String(v).trim(); }
  function url(v) {
    var u = str(v && typeof v === 'object' ? v.url : v);
    return /^(https?:)?\/\//i.test(u) || /^data:image\//i.test(u) ? u : '';
  }
  function cssUrl(u) { return u.replace(/["'\\()\s<>]/g, function (c) { return '%' + ('0' + c.charCodeAt(0).toString(16)).slice(-2).toUpperCase(); }); }
  function host(u) { var m = /^(?:https?:)?\/\/([^\/?#:]+)/i.exec(u || ''); return m ? m[1].replace(/^www\./, '') : ''; }

  /* ------------------------------------------------- normalize the payload */
  // Accepts Prebid's legacy [{key,value}] list (optionally carrying .ortb), an ORTB native response,
  // or a plain {title, image, ...} object.
  function normalize(input, ortbArg) {
    var a = {}, i;
    function put(k, v) { if (v != null && v !== '' && a[k] == null) a[k] = v; }
    var list = Array.isArray(input) ? input
      : (input && Array.isArray(input.assets) && input.assets[0] && 'key' in input.assets[0]) ? input.assets : null;
    if (list) for (i = 0; i < list.length; i++) if (list[i] && list[i].key) put(list[i].key, list[i].value);
    var o = ortbArg || (input && input.ortb) || (!list && input && Array.isArray(input.assets) ? input : null);
    if (o && o.assets) {
      for (i = 0; i < o.assets.length; i++) {
        var x = o.assets[i] || {}, k = ID[x.id];
        if (x.title) put('title', x.title.text);
        else if (x.img) put(k || (x.img.type === 1 ? 'icon' : 'image'), x.img);
        else if (x.data && k) put(k, x.data.value);
      }
      if (o.link) put('clickUrl', o.link.url);
      put('privacyLink', o.privacy);
    }
    if (!list && !o && input && typeof input === 'object') for (var key in input) put(key, input[key]);
    var click = url(a.clickUrl);
    return {
      title: str(a.title), body: str(a.body), cta: str(a.cta),
      sponsor: str(a.sponsoredBy) || host(click),
      image: url(a.image), icon: url(a.icon), click: click, privacy: url(a.privacyLink)
    };
  }

  /* ---------------------------------------------------------- size picking */
  function pick(W, H) {
    var i, s, best = null;
    for (i = 0; i < SIZES.length; i++) { s = SIZES[i]; if (Math.abs(s[0] - W) <= 2 && Math.abs(s[1] - H) <= 2) return s; }
    for (i = 0; i < SIZES.length; i++) { s = SIZES[i]; if (s[0] <= W && s[1] <= H && (!best || s[0] * s[1] > best[0] * best[1])) best = s; }
    if (best) return best;
    if (!W || !H) return SIZES[0];
    var d = 1e9, r = W / H;
    for (i = 0; i < SIZES.length; i++) { s = SIZES[i]; var dd = Math.abs(Math.log(s[0] / s[1] / r)); if (dd < d) { d = dd; best = s; } }
    return best;
  }
  function family(W, H) {
    if (H <= 100) return 'strip';
    if (W <= 160) return 'sky';
    if (H === 250 && W >= 728) return 'billboard';
    if (H >= 480) return 'tall';
    return 'box';
  }

  /* -------------------------------------------------------------- atoms */
  function div(css, inner) { return '<div style="' + css + '">' + (inner || '') + '</div>'; }
  function txt(tag, css, s) { return '<' + tag + ' style="' + css + '">' + esc(s) + '</' + tag + '>'; }
  function font(wt, px, lh) { return 'font:' + wt + ' ' + px + 'px/' + lh + ' ' + FONT + ';'; }
  function clamp(n) { return 'overflow:hidden;display:-webkit-box;-webkit-line-clamp:' + n + ';-webkit-box-orient:vertical;'; }
  function pic(u, css) {
    return '<div style="' + css + ';background-color:#EFEFEC;' + (u
      ? "background-image:url('" + cssUrl(u) + "');background-size:cover;background-position:center"
      : 'background-image:repeating-linear-gradient(135deg,#EFEFEC 0 8px,#E7E7E3 8px 16px)') + '"></div>';
  }
  function mark(a, px) {
    var r = Math.round(px * 0.28);
    if (a.icon) return pic(a.icon, 'flex:none;width:' + px + 'px;height:' + px + 'px;border-radius:' + r + 'px');
    var L = a.sponsor.charAt(0).toUpperCase();
    return L ? div('flex:none;width:' + px + 'px;height:' + px + 'px;border-radius:' + r + 'px;background:' + INK + ';color:' + PAPER +
      ';display:flex;align-items:center;justify-content:center;' + font(600, Math.round(px * 0.5), 1), esc(L)) : '';
  }
  function brand(a, px, fs) {
    if (!a.sponsor && !a.icon) return '';
    return div('display:flex;align-items:center;gap:' + Math.max(6, Math.round(px * 0.4)) + 'px;min-width:0',
      mark(a, px) + (a.sponsor ? txt('span', font(500, fs, 1.2) + 'color:' + INK + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0', a.sponsor) : ''));
  }
  function badge(fs, extra) { return txt('span', font(500, fs, 1) + 'flex:none;letter-spacing:.13em;text-transform:uppercase;color:' + MUTED + ';' + (extra || ''), 'Sponsored'); }
  function rule(wd, extra) { return div('flex:none;width:' + wd + 'px;height:2px;background:' + ACCENT + ';' + (extra || '')); }
  function title(a, fs, lh, n, extra) {
    return txt('p', 'margin:0;' + font(500, fs, lh) + 'letter-spacing:' + (fs >= 18 ? '-.018em' : '-.01em') + ';color:' + INK + ';text-wrap:pretty;' + clamp(n) + (extra || ''), a.title);
  }
  function body(a, fs, n, extra) { return a.body ? txt('p', 'margin:0;' + font(400, fs, 1.45) + 'color:' + BODY + ';text-wrap:pretty;' + clamp(n) + (extra || ''), a.body) : ''; }
  function ctaLabel(a) { return a.cta || 'Learn more'; }
  function arrow(a, fs, extra) {
    return div('flex:none;display:flex;align-items:center;gap:7px;' + (extra || ''),
      txt('span', font(600, fs, 1) + 'color:' + INK, ctaLabel(a)) + txt('span', font(600, fs, 1) + 'color:' + ACCENT, '\u2192'));
  }
  function pill(a, fs, pad, extra) {
    return div('flex:none;display:flex;align-items:center;justify-content:center;gap:7px;padding:' + pad + ';border-radius:999px;background:' + INK + ';white-space:nowrap;' + (extra || ''),
      txt('span', font(600, fs, 1) + 'color:' + PAPER, ctaLabel(a)) + txt('span', font(600, fs, 1) + 'color:' + ACCENT, '\u2192'));
  }
  function col(css, inner) { return div('flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;' + css, inner); }
  function row(css, inner) { return div('display:flex;align-items:center;min-width:0;' + css, inner); }

  /* ------------------------------------------------------------ layouts */
  // Each returns { css: root flex css, html, ac: AdChoices position }
  var L = {};

  // 320x50 · 320x100 · 728x90 · 970x90
  L.strip = function (a, W, H) {
    var k = W + 'x' + H;
    if (k === '320x50') {
      var thumb = a.icon ? mark(a, 34) : pic(a.image, 'flex:none;width:34px;height:34px;border-radius:8px');
      return { css: 'align-items:center;', ac: 'top:2px;right:2px;', html:
        div('flex:none;align-self:stretch;width:4px;background:' + ACCENT) +
        div('flex:none;display:flex;margin:0 9px', thumb) +
        col('gap:3px;padding-right:8px', badge(7.5) + title(a, 11.5, 1.25, 2)) +
        pill(a, 10, '6px 10px', 'margin-right:9px') };
    }
    var c = {
      '320x100': { tw: 100, fs: 13, lh: 1.3, n: 2, b: [14, 10.5], gap: 7, pad: '0 12px' },
      '728x90':  { tw: 120, fs: 16, lh: 1.28, n: 2, b: [16, 11.5], gap: 6, pad: '0 20px', pill: [12, '11px 20px', 'margin-right:18px'] },
      '970x90':  { tw: 160, fs: 18, lh: 1.25, n: 1, b: [16, 11.5], gap: 6, pad: '0 24px', desc: 13, pill: [13, '13px 24px', 'margin-right:22px'] }
    }[k];
    var inner = row('gap:10px', brand(a, c.b[0], c.b[1]) + badge(8.5, 'margin-left:auto')) +
      title(a, c.fs, c.lh, c.n) + (c.desc ? body(a, c.desc, 1) : '') + (c.pill ? '' : arrow(a, 11));
    return { css: 'align-items:center;', ac: 'top:4px;left:4px;', html:
      pic(a.image, 'flex:none;align-self:stretch;width:' + c.tw + 'px') +
      col('justify-content:center;gap:' + c.gap + 'px;padding:' + c.pad, inner) +
      (c.pill ? pill(a, c.pill[0], c.pill[1], c.pill[2]) : '') };
  };

  // 300x250 · 336x280
  L.box = function (a, W) {
    if (W === 300) return { css: '', ac: 'top:4px;left:4px;', html:
      pic(a.image, 'flex:none;width:112px') +
      col('padding:15px 14px 14px',
        brand(a, 17, 10.5) + rule(24, 'margin:13px 0 11px') + title(a, 15, 1.32, 4) + body(a, 12, 3, 'margin-top:8px') +
        row('margin-top:auto;padding-top:10px;gap:8px', arrow(a, 12) + badge(8, 'margin-left:auto'))) };
    return { css: 'flex-direction:column;', ac: 'top:4px;left:4px;', html:
      pic(a.image, 'flex:1 1 auto;min-height:0') +
      div('flex:none;padding:14px 16px 16px;display:flex;flex-direction:column;gap:10px',
        row('gap:10px', brand(a, 17, 10.5) + badge(8.5, 'margin-left:auto')) +
        title(a, 16, 1.28, 2) + arrow(a, 12)) };
  };

  // 320x480 · 300x600
  L.tall = function (a, W, H) {
    var big = H >= 600;
    return { css: 'flex-direction:column;', ac: 'top:52px;left:4px;', html:
      row('flex:none;box-sizing:border-box;height:48px;padding:0 16px;gap:10px;border-bottom:1px solid ' + LINE, brand(a, 20, 12) + badge(8.5, 'margin-left:auto')) +
      pic(a.image, 'flex:1 1 auto;min-height:0') +
      div('flex:none;padding:18px 18px 20px;display:flex;flex-direction:column;gap:' + (big ? 12 : 14) + 'px',
        rule(30) + title(a, big ? 22 : 21, 1.26, 3) + body(a, 13, big ? 3 : 2) +
        (big ? pill(a, 13, '14px 0', 'margin-top:4px') : arrow(a, 13))) };
  };

  // 160x600 · 120x600
  L.sky = function (a, W) {
    var wide = W >= 160;
    return { css: 'flex-direction:column;', ac: 'top:40px;left:4px;', html:
      row('flex:none;box-sizing:border-box;height:36px;padding:0 ' + (wide ? 12 : 10) + 'px;border-bottom:1px solid ' + LINE, brand(a, wide ? 16 : 14, wide ? 11 : 10)) +
      pic(a.image, 'flex:none;height:' + W + 'px') +
      col('padding:14px ' + (wide ? 12 : 10) + 'px 12px;gap:10px',
        rule(22) + title(a, wide ? 16 : 14, 1.3, wide ? 6 : 7) + body(a, wide ? 12 : 11.5, wide ? 6 : 5) +
        div('margin-top:auto;display:flex;flex-direction:column;align-items:center;gap:9px',
          pill(a, wide ? 11.5 : 11, wide ? '11px 0' : '10px 0', 'align-self:stretch') + badge(wide ? 8 : 7.5))) };
  };

  // 728x250 · 970x250
  L.billboard = function (a, W) {
    var xl = W >= 970;
    var copy = row('gap:12px', brand(a, xl ? 22 : 20, xl ? 13 : 12.5) + badge(9, 'margin-left:auto')) +
      rule(xl ? 34 : 30, xl ? 'margin:16px 0 13px' : 'margin:13px 0 11px') +
      title(a, xl ? 28 : 22, xl ? 1.2 : 1.24, 2) + body(a, xl ? 14.5 : 13.5, 2, 'margin-top:8px');
    if (xl) return { css: 'align-items:stretch;', ac: 'top:4px;left:4px;', html:
      pic(a.image, 'flex:none;width:380px') +
      col('justify-content:center;padding:24px 28px 24px 32px', copy) +
      div('flex:none;display:flex;align-items:center;padding:0 32px 0 4px', pill(a, 14, '15px 28px')) };
    return { css: 'align-items:stretch;', ac: 'top:4px;left:4px;', html:
      pic(a.image, 'flex:none;width:300px') +
      col('padding:22px 26px', copy + div('margin-top:auto;padding-top:12px;display:flex', pill(a, 12.5, '11px 20px'))) };
  };

  /* -------------------------------------------------------------- render */
  function viewport() {
    var de = w.document && w.document.documentElement, fe = null;
    try { fe = w.frameElement; } catch (e) {}
    return [
      w.innerWidth || (de && de.clientWidth) || (fe && +fe.width) || 0,
      w.innerHeight || (de && de.clientHeight) || (fe && +fe.height) || 0
    ];
  }

  function render(input, opts) {
    opts = opts || {};
    var a = normalize(input, opts.ortb);
    var forced = /^(\d+)x(\d+)$/.exec(opts.size || '');
    var vp = forced ? [+forced[1], +forced[2]] : [opts.w, opts.h];
    if (!vp[0] || !vp[1]) vp = viewport();
    var s = pick(vp[0], vp[1]), W = s[0], H = s[1];
    var r = L[family(W, H)](a, W, H);
    var radius = H <= 50 ? 8 : H <= 100 ? 10 : W <= 160 ? 12 : 14;
    var root = '<a class="pb-click rd-native" data-size="' + W + 'x' + H + '" href="' + esc(a.click || '#') + '" target="_blank" rel="noopener sponsored"' +
      ' style="box-sizing:border-box;position:absolute;inset:0;display:flex;' + r.css + 'overflow:hidden;background:' + PAPER + ';border:1px solid ' + LINE +
      ';border-radius:' + radius + 'px;color:' + INK + ';text-decoration:none;font-family:' + FONT + ';-webkit-font-smoothing:antialiased">' + r.html + '</a>';
    var ac = a.privacy ? '<a href="' + esc(a.privacy) + '" target="_blank" rel="noopener" title="AdChoices" style="position:absolute;' + r.ac +
      'z-index:2;box-sizing:border-box;width:' + (H <= 50 ? 12 : 15) + 'px;height:' + (H <= 50 ? 12 : 15) + 'px;border-radius:50%;background:#FFFFFFE6;border:1px solid ' + LINE +
      ';display:flex;align-items:center;justify-content:center;' + font(600, H <= 50 ? 7.5 : 9, 1) + 'color:' + MUTED + ';text-decoration:none">i</a>' : '';
    return '<link rel="stylesheet" href="' + FONT_CSS + '"><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}</style>' +
      '<div class="rd-wrap" style="position:relative;width:' + W + 'px;height:' + H + 'px;margin:0 auto">' + root + ac + '</div>';
  }

  // Prebid entry point (rendererUrl contract)
  w.renderAd = function (assets, ortb) { return render(assets, { ortb: ortb, size: w.rediadsSize }); };

  w.RediAdsNative = {
    version: '1.0.0',
    sizes: SIZES.map(function (s) { return s[0] + 'x' + s[1]; }),
    render: render,
    normalize: normalize,
    pick: pick,
    page: function (assets, opts) { return '<!doctype html><html><head><meta charset="utf-8"></head><body>' + render(assets, opts) + '</body></html>'; }
  };
})(window);
