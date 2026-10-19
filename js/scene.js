/* =========================================================
   星海萤光 · 场景
   星辰 / 萤火 / 流星 / 光之涟漪
   ========================================================= */

(function () {
  'use strict';

  var canvas = document.getElementById('scene');
  if (!canvas) return;

  var ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  var stage = document.getElementById('stage');
  var intro = document.getElementById('intro');
  var enterBtn = document.getElementById('enter');
  var silentBtn = document.getElementById('enter-silent');
  var moonEl = document.getElementById('moon');
  var haloEl = document.getElementById('moon-halo');
  var discEl = moonEl ? moonEl.querySelector('.moon__disc') : null;
  var cursorEl = document.getElementById('cursor-glow');
  var soundBtn = document.getElementById('sound-toggle');
  var soundLabel = document.getElementById('sound-label');
  var clockEl = document.getElementById('clock');
  var audio = window.NocturneAudio;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia('(pointer: coarse)').matches;

  var TAU = Math.PI * 2;
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var pick = function (list) { return list[(Math.random() * list.length) | 0]; };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };

  /* ---------- 颜色与光斑 ---------- */

  var TINTS = {
    gold: '255, 205, 138',
    warm: '255, 231, 190',
    teal: '146, 235, 215',
    white: '205, 220, 255',
    violet: '196, 178, 255'
  };

  function makeSprite(rgb) {
    var size = 128;
    var c = document.createElement('canvas');
    c.width = size;
    c.height = size;

    var g = c.getContext('2d');
    var grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grd.addColorStop(0, 'rgba(' + rgb + ',1)');
    grd.addColorStop(0.1, 'rgba(' + rgb + ',0.82)');
    grd.addColorStop(0.28, 'rgba(' + rgb + ',0.26)');
    grd.addColorStop(0.58, 'rgba(' + rgb + ',0.055)');
    grd.addColorStop(1, 'rgba(' + rgb + ',0)');

    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    return c;
  }

  var sprites = {};
  Object.keys(TINTS).forEach(function (key) {
    sprites[key] = makeSprite(TINTS[key]);
  });

  function rgba(tint, alpha) {
    return 'rgba(' + TINTS[tint] + ',' + alpha + ')';
  }

  /* ---------- 状态 ---------- */

  var view = { w: 1, h: 1, dpr: 1, cx: 0.5, cy: 0.5, vmin: 1 };
  var moonGeo = { x: 0, y: 0, r: 0 };

  var pointer = {
    x: 0, y: 0, tx: 0, ty: 0,
    vx: 0, vy: 0,
    active: false, down: false, init: false,
    energy: 0,
    lastSpawn: 0, lastPaint: 0, lastX: 0, lastY: 0
  };

  var cursorX = 0;
  var cursorY = 0;
  var stars = [];
  var fireflies = [];
  var dust = [];
  var rings = [];
  var bursts = [];
  var sparks = [];
  var flashes = [];
  var meteors = [];
  var rays = [];

  var nextMeteor = 0;
  var bloomCount = 0;
  var moonPulse = 0;
  var entered = false;

  /* ---------- 构建 ---------- */

  function measureMoon() {
    if (!discEl) return;
    var rect = discEl.getBoundingClientRect();
    moonGeo.x = rect.left + rect.width / 2;
    moonGeo.y = rect.top + rect.height / 2;
    moonGeo.r = Math.max(rect.width, rect.height) / 2;
  }

  function buildStars() {
    stars.length = 0;

    var count = clamp(Math.round((view.w * view.h) / 5600), 150, 480);
    if (reduced) count = Math.round(count * 0.55);

    for (var i = 0; i < count; i++) {
      var depth = rand(0.16, 1);
      var tint = Math.random() < 0.72 ? 'white' : (Math.random() < 0.55 ? 'gold' : 'teal');
      var glow = Math.random() < 0.075;

      stars.push({
        nx: Math.random(),
        ny: Math.pow(Math.random(), 1.08) * 0.96,
        size: rand(0.32, 1.3) * (0.55 + depth * 0.75) + (glow ? 0.75 : 0),
        depth: depth,
        alpha: rand(0.25, 0.9) * (0.45 + depth * 0.55),
        speed: rand(0.35, 1.7),
        phase: rand(0, TAU),
        tint: tint,
        color: 'rgba(' + TINTS[tint] + ',1)',
        glow: glow
      });
    }
  }

  function spawnFirefly(x, y) {
    var tint = Math.random() < 0.66 ? 'gold' : (Math.random() < 0.5 ? 'teal' : 'warm');
    return {
      x: x,
      y: y,
      vx: rand(-9, 9),
      vy: rand(-9, 9),
      phase: rand(0, TAU),
      wobble: rand(0.4, 1.15),
      speed: rand(8, 22),
      r: rand(1.05, 2.4),
      halo: rand(1.2, 2.9),
      alpha: rand(0.46, 1),
      twinkle: rand(0.5, 1.7),
      tint: tint,
      seed: rand(0, 100)
    };
  }

  function buildFireflies() {
    fireflies.length = 0;
    var count = reduced ? 20 : clamp(Math.round(view.w / 30), 28, 68);

    for (var i = 0; i < count; i++) {
      fireflies.push(spawnFirefly(rand(0, view.w), rand(view.h * 0.16, view.h * 0.97)));
    }
  }

  function buildDust() {
    dust.length = 0;
    var count = reduced ? 18 : clamp(Math.round(view.w / 24), 40, 96);

    for (var i = 0; i < count; i++) {
      dust.push({
        x: rand(0, view.w),
        y: rand(0, view.h),
        r: rand(0.35, 1.15),
        vy: rand(-13, -4),
        drift: rand(3, 14),
        phase: rand(0, TAU),
        speed: rand(0.2, 0.7),
        alpha: rand(0.035, 0.16)
      });
    }
  }

  function resize() {
    view.w = Math.max(1, window.innerWidth);
    view.h = Math.max(1, window.innerHeight);
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.cx = view.w / 2;
    view.cy = view.h / 2;
    view.vmin = Math.min(view.w, view.h);

    canvas.width = Math.round(view.w * view.dpr);
    canvas.height = Math.round(view.h * view.dpr);
    canvas.style.width = view.w + 'px';
    canvas.style.height = view.h + 'px';

    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);

    buildStars();
    buildFireflies();
    buildDust();
    measureMoon();

    if (!pointer.init) {
      pointer.x = pointer.tx = view.cx;
      pointer.y = pointer.ty = view.cy * 0.9;
      cursorX = pointer.x;
      cursorY = pointer.y;
      pointer.lastX = pointer.x;
      pointer.lastY = pointer.y;
    }
  }

  /* ---------- 交互 ---------- */

  function bloom(x, y, options) {
    options = options || {};
    var now = performance.now() / 1000;
    var tint = pick(['gold', 'gold', 'warm', 'teal', 'white']);

    rings.push({
      x: x, y: y, t0: now,
      life: rand(1.7, 2.3),
      maxR: rand(140, 260),
      tint: tint
    });

    rings.push({
      x: x, y: y, t0: now + 0.11,
      life: rand(1.2, 1.7),
      maxR: rand(65, 135),
      tint: tint === 'gold' ? 'teal' : 'gold'
    });

    rings.push({
      x: x, y: y, t0: now + 0.26,
      life: rand(0.9, 1.3),
      maxR: rand(30, 64),
      tint: 'warm'
    });

    flashes.push({
      x: x, y: y, age: 0,
      life: 1,
      size: rand(230, 350),
      tint: tint
    });

    /* 星芒 */
    var rayCount = reduced ? 4 : 8;
    for (var r = 0; r < rayCount; r++) {
      rays.push({
        x: x,
        y: y,
        angle: (r / rayCount) * TAU + rand(-0.2, 0.2),
        length: rand(60, 150),
        age: 0,
        life: rand(0.45, 0.8),
        width: rand(0.6, 1.3),
        tint: pick(['gold', 'warm', 'white', 'teal'])
      });
    }

    var count = reduced ? 18 : 46;
    for (var i = 0; i < count; i++) {
      var angle = rand(0, TAU);
      var speed = rand(24, 240);
      var startR = rand(0, 26);
      bursts.push({
        x: x + Math.cos(angle) * startR,
        y: y + Math.sin(angle) * startR,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        life: rand(1.1, 2.1),
        size: rand(6, 18),
        tint: pick(['gold', 'warm', 'teal', 'white']),
        drag: rand(1.5, 2.6)
      });
    }

    /* 慢慢浮起的微光 */
    for (var j = 0; j < (reduced ? 4 : 10); j++) {
      var a2 = rand(0, TAU);
      var s2 = rand(4, 34);
      bursts.push({
        x: x + rand(-30, 30),
        y: y + rand(-30, 30),
        vx: Math.cos(a2) * s2,
        vy: Math.sin(a2) * s2 - rand(6, 18),
        age: 0,
        life: rand(2.2, 3.4),
        size: rand(10, 22),
        tint: pick(['gold', 'warm', 'teal']),
        drag: 0.5
      });
    }

    moonPulse = 1;
    bloomCount++;

    if (bloomCount % 9 === 0) {
      shower();
    }

    if (options.sound !== false && audio) {
      audio.chime(x / view.w, y / view.h);
    }
  }

  function paint(x, y) {
    var now = performance.now() / 1000;

    rings.push({
      x: x, y: y, t0: now,
      life: 1.15,
      maxR: rand(38, 76),
      tint: Math.random() < 0.5 ? 'gold' : 'teal'
    });

    for (var i = 0; i < (reduced ? 2 : 5); i++) {
      sparks.push({
        x: x + rand(-6, 6),
        y: y + rand(-6, 6),
        vx: rand(-26, 26),
        vy: rand(-26, 26),
        age: 0,
        life: rand(0.5, 1.1),
        size: rand(4, 10),
        tint: pick(['gold', 'warm', 'teal']),
        drag: 2
      });
    }

    if (audio) audio.whisper(x / view.w);
  }

  function shower() {
    for (var i = 0; i < 5; i++) {
      spawnMeteor(rand(0.08, 0.85) * view.w, rand(-0.05, 0.3) * view.h, i * 0.16);
    }
    if (audio) audio.shower();
  }

  function spawnMeteor(x, y, delay) {
    var angle = rand(0.24, 0.52);
    var speed = rand(680, 1120);

    meteors.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: -(delay || 0),
      life: rand(0.9, 1.5),
      tint: Math.random() < 0.7 ? 'white' : 'gold'
    });
  }

  /* ---------- 更新 ---------- */

  var lastTime = performance.now();

  function update(now, dt) {
    /* 指针平滑 */
    var smooth = 1 - Math.exp(-13 * dt);
    var prevX = pointer.x;
    var prevY = pointer.y;
    pointer.x += (pointer.tx - pointer.x) * smooth;
    pointer.y += (pointer.ty - pointer.y) * smooth;
    pointer.vx = (pointer.x - prevX) / Math.max(dt, 0.0001);
    pointer.vy = (pointer.y - prevY) / Math.max(dt, 0.0001);

    var speed = Math.sqrt(pointer.vx * pointer.vx + pointer.vy * pointer.vy);
    pointer.energy = clamp(pointer.energy + (speed > 40 ? 2 : -0.7) * dt, 0, 1);

    /* 指尖拖出的光屑 */
    if (pointer.active && speed > 40 && now - pointer.lastSpawn > 0.016 && sparks.length < 380) {
      pointer.lastSpawn = now;
      var n = reduced ? 1 : 2;

      for (var s = 0; s < n; s++) {
        sparks.push({
          x: pointer.x + rand(-4, 4),
          y: pointer.y + rand(-4, 4),
          vx: -pointer.vx * rand(0.015, 0.055) + rand(-14, 14),
          vy: -pointer.vy * rand(0.015, 0.055) + rand(-14, 14),
          age: 0,
          life: rand(0.55, 1.35),
          size: rand(4, 12),
          tint: pick(['gold', 'warm', 'teal', 'white']),
          drag: 2.6
        });
      }
    }

    /* 萤火 */
    for (var i = 0; i < fireflies.length; i++) {
      var f = fireflies[i];
      f.phase += dt * f.wobble;

      var ax = Math.cos(f.phase * 0.7 + f.seed) * 17 + Math.sin(f.phase * 1.7 + f.seed * 2.1) * 6;
      var ay = Math.sin(f.phase * 0.9 + f.seed * 1.3) * 15 + Math.cos(f.phase * 1.4 + f.seed) * 5;

      f.vx += ax * dt;
      f.vy += ay * dt;

      if (pointer.active) {
        var pdx = pointer.x - f.x;
        var pdy = pointer.y - f.y;
        var radius = view.vmin * 0.26 + 90;
        var dist2 = pdx * pdx + pdy * pdy;

        if (dist2 < radius * radius) {
          var dist = Math.sqrt(dist2) + 0.001;
          var force = (1 - dist / radius);
          f.vx += (pdx / dist) * force * 34 * dt;
          f.vy += (pdy / dist) * force * 34 * dt;
          f.vx += (-pdy / dist) * force * 26 * dt;
          f.vy += (pdx / dist) * force * 26 * dt;
        }
      }

      var drag = Math.exp(-1.15 * dt);
      f.vx *= drag;
      f.vy *= drag;

      var v = Math.sqrt(f.vx * f.vx + f.vy * f.vy);
      var maxV = 74;
      if (v > maxV) {
        f.vx = (f.vx / v) * maxV;
        f.vy = (f.vy / v) * maxV;
      }

      f.x += f.vx * dt;
      f.y += f.vy * dt;

      var margin = 60;
      if (f.x < -margin) f.x = view.w + margin;
      if (f.x > view.w + margin) f.x = -margin;
      if (f.y < -margin) f.y = view.h + margin;
      if (f.y > view.h + margin) f.y = -margin;
    }

    /* 尘埃 */
    for (var d = 0; d < dust.length; d++) {
      var p = dust[d];
      p.y += p.vy * dt;
      p.x += Math.sin(now * p.speed + p.phase) * p.drift * dt;

      if (p.y < -10) {
        p.y = view.h + 10;
        p.x = rand(0, view.w);
      }
      if (p.x < -10) p.x = view.w + 10;
      if (p.x > view.w + 10) p.x = -10;
    }

    /* 环形光波 */
    for (var r = rings.length - 1; r >= 0; r--) {
      var ring = rings[r];
      if (now - ring.t0 > ring.life) rings.splice(r, 1);
    }

    /* 光尘 */
    for (var b = bursts.length - 1; b >= 0; b--) {
      var bp = bursts[b];
      bp.age += dt;
      if (bp.age >= bp.life) {
        bursts.splice(b, 1);
        continue;
      }

      var bDrag = Math.exp(-bp.drag * dt);
      bp.vx *= bDrag;
      bp.vy *= bDrag;
      bp.vy -= 3.2 * dt;
      bp.x += bp.vx * dt;
      bp.y += bp.vy * dt;
    }

    /* 火花 */
    for (var k = sparks.length - 1; k >= 0; k--) {
      var sp = sparks[k];
      sp.age += dt;
      if (sp.age >= sp.life) {
        sparks.splice(k, 1);
        continue;
      }

      var sDrag = Math.exp(-sp.drag * dt);
      sp.vx *= sDrag;
      sp.vy *= sDrag;
      sp.vy -= 4 * dt;
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
    }

    /* 闪光 */
    for (var fl = flashes.length - 1; fl >= 0; fl--) {
      flashes[fl].age += dt;
      if (flashes[fl].age >= flashes[fl].life) flashes.splice(fl, 1);
    }

    /* 星芒 */
    for (var ry = rays.length - 1; ry >= 0; ry--) {
      rays[ry].age += dt;
      if (rays[ry].age >= rays[ry].life) rays.splice(ry, 1);
    }

    /* 流星 */
    for (var m = meteors.length - 1; m >= 0; m--) {
      var mt = meteors[m];
      mt.age += dt;
      if (mt.age >= mt.life) meteors.splice(m, 1);
    }

    if (now > nextMeteor) {
      spawnMeteor(rand(0.1, 0.9) * view.w, rand(-0.08, 0.26) * view.h, 0);
      nextMeteor = now + rand(7, 15);
    }

    moonPulse = Math.max(0, moonPulse - dt * 1.5);
  }

  /* ---------- 绘制 ---------- */

  function drawStars(now) {
    var parallaxX = (pointer.x - view.cx) / view.cx;
    var parallaxY = (pointer.y - view.cy) / view.cy;
    var moonSkip = moonGeo.r * 1.22;
    var moonSkip2 = moonSkip * moonSkip;
    var nearPointer = pointer.active && entered;

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var sx = s.nx * view.w - parallaxX * 20 * s.depth;
      var sy = s.ny * view.h - parallaxY * 14 * s.depth;

      if (moonGeo.r > 0) {
        var mdx = sx - moonGeo.x;
        var mdy = sy - moonGeo.y;
        if (mdx * mdx + mdy * mdy < moonSkip2) continue;
      }

      var twinkle = 0.55 + 0.45 * Math.sin(now * s.speed + s.phase);
      var alpha = s.alpha * twinkle;
      var boost = 0;

      if (nearPointer) {
        var pdx = sx - pointer.x;
        var pdy = sy - pointer.y;
        var pd2 = pdx * pdx + pdy * pdy;
        var reach = 240;

        if (pd2 < reach * reach) {
          var pd = Math.sqrt(pd2);
          boost = 1 - pd / reach;

          ctx.globalAlpha = boost * 0.22 * twinkle * (0.18 + 0.82 * pointer.energy);
          ctx.strokeStyle = rgba('gold', 1);
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(pointer.x, pointer.y);
          ctx.lineTo(sx, sy);
          ctx.stroke();
        }
      }

      alpha = Math.min(1, alpha + boost * (0.25 + 0.55 * pointer.energy));

      if (s.glow) {
        var gs = 12 + s.size * 7;
        ctx.globalAlpha = alpha * 0.42;
        ctx.drawImage(sprites[s.tint], sx - gs / 2, sy - gs / 2, gs, gs);

        if (entered) {
          var ray = s.size * 7;
          ctx.globalAlpha = alpha * 0.22 * twinkle;
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(sx - ray, sy);
          ctx.lineTo(sx + ray, sy);
          ctx.moveTo(sx, sy - ray);
          ctx.lineTo(sx, sy + ray);
          ctx.stroke();
        }
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(sx, sy, s.size, 0, TAU);
      ctx.fill();
    }
  }

  function drawDust(now) {
    ctx.globalAlpha = 1;
    for (var i = 0; i < dust.length; i++) {
      var p = dust[i];
      var alpha = p.alpha * (0.65 + 0.35 * Math.sin(now * 0.8 + p.phase));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(206, 224, 255, 1)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }
  }

  function drawGlows(now) {
    var i;

    ctx.globalCompositeOperation = 'lighter';

    /* 星芒 */
    for (i = 0; i < rays.length; i++) {
      var ray = rays[i];
      var rk = ray.age / ray.life;
      var ra = Math.sin(Math.PI * rk) * 0.62;
      var inner = 4 + 22 * easeOut(rk);
      var outer = inner + ray.length * (0.35 + 0.65 * easeOut(rk));
      var ca = Math.cos(ray.angle);
      var sa = Math.sin(ray.angle);
      var x1 = ray.x + ca * inner;
      var y1 = ray.y + sa * inner;
      var x2 = ray.x + ca * outer;
      var y2 = ray.y + sa * outer;

      var rayGrad = ctx.createLinearGradient(x1, y1, x2, y2);
      rayGrad.addColorStop(0, rgba(ray.tint, 0.8));
      rayGrad.addColorStop(0.45, rgba(ray.tint, 0.32));
      rayGrad.addColorStop(1, rgba(ray.tint, 0));

      ctx.globalAlpha = ra;
      ctx.strokeStyle = rayGrad;
      ctx.lineWidth = ray.width * (1 - rk) + 0.25;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    /* 点击闪光 */
    for (i = flashes.length - 1; i >= 0; i--) {
      var f = flashes[i];
      var fk = f.age / f.life;
      var fa = Math.pow(1 - fk, 2.2) * 0.18;
      var fs = f.size * (0.78 + fk * 0.75);
      ctx.globalAlpha = fa;
      ctx.drawImage(sprites[f.tint], f.x - fs / 2, f.y - fs / 2, fs, fs);
    }

    /* 涟漪 */
    for (i = rings.length - 1; i >= 0; i--) {
      var ring = rings[i];
      var age = now - ring.t0;
      if (age < 0) continue;

      var rk = age / ring.life;
      if (rk >= 1) continue;

      var radius = 9 + (ring.maxR - 9) * easeOut(rk);
      var ra = Math.pow(1 - rk, 1.8);

      ctx.globalAlpha = ra * 0.8;
      ctx.strokeStyle = rgba(ring.tint, 1);
      ctx.lineWidth = 0.6 + (1 - rk) * 2.1;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, radius, 0, TAU);
      ctx.stroke();

      ctx.globalAlpha = ra * 0.28;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, radius * 1.2, 0, TAU);
      ctx.stroke();
    }

    /* 萤火 */
    for (i = 0; i < fireflies.length; i++) {
      var ff = fireflies[i];
      var fa2 = ff.alpha * (0.55 + 0.45 * Math.sin(now * ff.twinkle * 1.6 + ff.phase * 2.3));
      var gs2 = ff.r * 18 * ff.halo;

      ctx.globalAlpha = Math.min(0.85, fa2 * 0.62);
      ctx.drawImage(sprites[ff.tint], ff.x - gs2 / 2, ff.y - gs2 / 2, gs2, gs2);

      ctx.globalAlpha = Math.min(1, fa2 * 1.15);
      ctx.fillStyle = 'rgba(255, 250, 235, 1)';
      ctx.beginPath();
      ctx.arc(ff.x, ff.y, ff.r * 0.9, 0, TAU);
      ctx.fill();
    }

    /* 光尘 */
    for (i = 0; i < bursts.length; i++) {
      var b = bursts[i];
      var bk = b.age / b.life;
      var ba = Math.pow(1 - bk, 1.5) * 0.95;
      var bs = b.size * (1 - bk * 0.25) * 3.6;

      ctx.globalAlpha = ba;
      ctx.drawImage(sprites[b.tint], b.x - bs / 2, b.y - bs / 2, bs, bs);
    }

    /* 指尖火花 */
    for (i = 0; i < sparks.length; i++) {
      var sp = sparks[i];
      var sk = sp.age / sp.life;
      var sa = Math.pow(1 - sk, 1.6) * 0.85;
      var ss = sp.size * 2.8 * (1 - sk * 0.3);

      ctx.globalAlpha = sa;
      ctx.drawImage(sprites[sp.tint], sp.x - ss / 2, sp.y - ss / 2, ss, ss);
    }

    /* 流星 */
    for (i = 0; i < meteors.length; i++) {
      var m = meteors[i];
      if (m.age < 0) continue;

      var mk = m.age / m.life;
      var ma = Math.sin(Math.PI * Math.min(1, mk));

      var hx = m.x + m.vx * m.age;
      var hy = m.y + m.vy * m.age;
      var tx = hx - m.vx * 0.17;
      var ty = hy - m.vy * 0.17;

      var grad = ctx.createLinearGradient(tx, ty, hx, hy);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.7, rgba(m.tint, 0.32 * ma));
      grad.addColorStop(1, rgba(m.tint, 0.9 * ma));

      ctx.globalAlpha = 1;
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
      ctx.stroke();

      ctx.globalAlpha = ma * 0.85;
      ctx.drawImage(sprites[m.tint], hx - 13, hy - 13, 26, 26);
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  function draw(now) {
    ctx.clearRect(0, 0, view.w, view.h);

    drawStars(now);
    drawDust(now);
    drawGlows(now);
  }

  /* ---------- 月亮与光标 ---------- */

  function updateMoon(dt) {
    var level = (audio && entered) ? audio.level() : 0;
    var scale = 0.97 + level * 0.16 + moonPulse * 0.13;
    var opacity = 0.56 + level * 0.28 + moonPulse * 0.16;

    if (haloEl) {
      haloEl.style.transform = 'scale(' + scale.toFixed(3) + ')';
      haloEl.style.opacity = opacity.toFixed(3);
    }
  }

  function updateCursor(dt) {
    if (!cursorEl || coarse) return;

    var k = 1 - Math.exp(-14 * dt);
    cursorX += (pointer.x - cursorX) * k;
    cursorY += (pointer.y - cursorY) * k;

    var speed = Math.sqrt(pointer.vx * pointer.vx + pointer.vy * pointer.vy);
    var scale = 0.82 + Math.min(speed / 1800, 0.46);

    cursorEl.style.transform =
      'translate3d(' + cursorX.toFixed(1) + 'px,' + cursorY.toFixed(1) + 'px,0) translate(-50%,-50%) scale(' + scale.toFixed(3) + ')';
    cursorEl.style.opacity = (pointer.active && entered) ? '1' : '0';
  }

  /* ---------- 主循环 ---------- */

  function frame(nowMs) {
    var now = nowMs / 1000;
    var dt = (nowMs - lastTime) / 1000;
    lastTime = nowMs;

    if (!isFinite(dt) || dt < 0) dt = 0;
    dt = Math.min(dt, 0.05);

    update(now, dt);
    draw(now);
    updateMoon(dt);
    updateCursor(dt);

    requestAnimationFrame(frame);
  }

  /* ---------- 界面 ---------- */

  function syncSoundUI() {
    var on = !!(audio && audio.started && !audio.muted);

    if (stage) stage.classList.toggle('sound-on', on);
    if (soundBtn) soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (soundLabel) soundLabel.textContent = on ? '声音 · 开' : '声音 · 关';
  }

  function enter(silent) {
    if (entered) return;
    entered = true;

    if (stage) stage.classList.add('is-ready');
    if (intro) {
      intro.classList.add('intro--out');
      window.setTimeout(function () {
        intro.style.display = 'none';
      }, 1600);
    }

    window.setTimeout(measureMoon, 2400);

    if (audio && !silent) {
      audio.start().then(function () {
        syncSoundUI();
        if (audio.swell) audio.swell();
      });
      if (stage) stage.classList.add('sound-on');
      if (soundLabel) soundLabel.textContent = '声音 · 开';
      if (soundBtn) soundBtn.setAttribute('aria-pressed', 'true');
    } else {
      syncSoundUI();
    }

    window.setTimeout(function () {
      bloom(view.w * 0.5, view.h * 0.4, { sound: true });
    }, 320);

    window.setTimeout(function () {
      bloom(view.w * 0.31, view.h * 0.54, { sound: true });
    }, 860);

    window.setTimeout(function () {
      bloom(view.w * 0.69, view.h * 0.5, { sound: false });
    }, 1380);
  }

  function toggleSound() {
    if (!audio) return;

    if (!audio.started) {
      audio.start().then(function () {
        syncSoundUI();
        if (audio.swell) audio.swell();
      });
      if (stage) stage.classList.add('sound-on');
      if (soundBtn) soundBtn.setAttribute('aria-pressed', 'true');
      if (soundLabel) soundLabel.textContent = '声音 · 开';
      return;
    }

    audio.setMuted(!audio.muted);
    syncSoundUI();
    if (!audio.muted) audio.click();
  }

  function onPointerDown(e) {
    if (!entered) return;

    pointer.down = true;
    pointer.active = true;
    pointer.init = true;
    pointer.tx = pointer.x = e.clientX;
    pointer.ty = pointer.y = e.clientY;
    pointer.lastX = e.clientX;
    pointer.lastY = e.clientY;
    pointer.lastPaint = 0;
    pointer.lastSpawn = 0;

    bloom(e.clientX, e.clientY, { sound: true });
  }

  function onPointerMove(e) {
    var isTouch = e.pointerType === 'touch';
    if (isTouch && !pointer.down) return;

    if (!pointer.init) {
      pointer.x = cursorX = e.clientX;
      pointer.y = cursorY = e.clientY;
      pointer.lastX = e.clientX;
      pointer.lastY = e.clientY;
      pointer.init = true;
    }

    pointer.tx = e.clientX;
    pointer.ty = e.clientY;
    pointer.active = true;

    if (isTouch) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    }

    if (pointer.down) {
      var now = performance.now() / 1000;
      var dx = e.clientX - pointer.lastX;
      var dy = e.clientY - pointer.lastY;

      if (dx * dx + dy * dy > 2600 && now - pointer.lastPaint > 0.24) {
        pointer.lastPaint = now;
        pointer.lastX = e.clientX;
        pointer.lastY = e.clientY;
        paint(e.clientX, e.clientY);
      }
    }
  }

  function onPointerUp() {
    pointer.down = false;
    if (coarse) pointer.active = false;
  }

  function updateClock() {
    if (!clockEl) return;
    var d = new Date();
    var h = ('0' + d.getHours()).slice(-2);
    var m = ('0' + d.getMinutes()).slice(-2);
    clockEl.textContent = h + ':' + m;
    clockEl.setAttribute('datetime', h + ':' + m);
  }

  /* ---------- 绑定 ---------- */

  window.addEventListener('resize', function () {
    window.clearTimeout(window.__nocturneResize);
    window.__nocturneResize = window.setTimeout(resize, 160);
  });

  window.addEventListener('orientationchange', function () {
    window.setTimeout(resize, 320);
  });

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('pointercancel', onPointerUp, { passive: true });

  window.addEventListener('blur', function () {
    pointer.active = false;
    pointer.down = false;
  });

  document.addEventListener('mouseleave', function () {
    pointer.active = false;
  });

  canvas.addEventListener('pointerdown', onPointerDown, { passive: true });

  if (intro) {
    intro.addEventListener('pointerdown', function (e) {
      if (e.target && e.target.closest && e.target.closest('button')) return;
      enter();
    });
  }

  if (enterBtn) {
    enterBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      enter();
    });
  }

  if (silentBtn) {
    silentBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      enter(true);
    });
  }

  if (soundBtn) {
    soundBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleSound();
    });
  }

  window.addEventListener('keydown', function (e) {
    if (!entered) return;

    var key = (e.key || '').toLowerCase();
    if (key === 'm') {
      e.preventDefault();
      toggleSound();
      return;
    }

    if (e.code === 'Space' && e.target === document.body) {
      e.preventDefault();
      bloom(rand(view.w * 0.2, view.w * 0.8), rand(view.h * 0.28, view.h * 0.66), { sound: true });
    }
  });

  /* ---------- 启动 ---------- */

  resize();
  updateClock();
  window.setInterval(updateClock, 20000);
  nextMeteor = performance.now() / 1000 + rand(4, 9);

  window.setTimeout(function () {
    measureMoon();
  }, 400);

  window.requestAnimationFrame(function (t) {
    lastTime = t;
    window.requestAnimationFrame(frame);
  });
})();
