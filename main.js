/* ============================================================
   RECALL — main.js
   Lenis + GSAP ScrollTrigger choreography, Three.js smoke & butterflies
   ============================================================ */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isMobile = window.matchMedia("(max-width: 760px)").matches;
  var hasGSAP = typeof gsap !== "undefined";
  var hasTHREE = typeof THREE !== "undefined";

  if (hasGSAP && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  /* ---------------- Smooth scroll (Lenis) ---------------- */
  var lenis = null;
  if (!reduce && typeof Lenis !== "undefined" && hasGSAP) {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    window.__lenis = lenis;
  }

  /* ===========================================================
     SMOKE — soft drifting haze around the wordmark
     =========================================================== */
  function softSprite() {
    var c = document.createElement("canvas");
    c.width = c.height = 128;
    var g = c.getContext("2d");
    var rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, "rgba(214,219,228,0.55)");
    rg.addColorStop(0.4, "rgba(190,196,206,0.22)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
    var t = new THREE.Texture(c); t.needsUpdate = true; return t;
  }

  var smoke = null;
  function initSmoke() {
    var canvas = document.getElementById("smoke");
    if (!canvas || !hasTHREE || reduce) return;
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
    var scene = new THREE.Scene();
    var cam = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
    cam.position.z = 14;

    var N = isMobile ? 300 : 560;
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(N * 3);
    var seed = new Float32Array(N);
    var scl = new Float32Array(N);
    for (var i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 26;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 18;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
      seed[i] = Math.random() * 6.28;
      scl[i] = 2.2 + Math.random() * 5.5;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));

    var mat = new THREE.PointsMaterial({
      size: 8.5, map: softSprite(), transparent: true, opacity: 0.34,
      depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(0x565b63),
      sizeAttenuation: true
    });
    var pts = new THREE.Points(geo, mat);
    scene.add(pts);

    var mouse = { x: 0, y: 0 };
    addEventListener("pointermove", function (e) {
      mouse.x = (e.clientX / innerWidth - 0.5);
      mouse.y = (e.clientY / innerHeight - 0.5);
    }, { passive: true });

    function resize() {
      renderer.setSize(innerWidth, innerHeight, false);
      cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
    }
    resize(); addEventListener("resize", resize);

    smoke = { renderer: renderer, mat: mat, group: pts, opacity: 1 };
    var t0 = performance.now();
    (function loop(now) {
      requestAnimationFrame(loop);
      if (smoke.opacity <= 0.01) { renderer.clear(); return; }
      var t = (now - t0) / 1000;
      var p = geo.attributes.position.array;
      for (var i = 0; i < N; i++) {
        p[i * 3 + 1] += 0.004 + (scl[i] * 0.0008);
        p[i * 3] += Math.sin(t * 0.3 + seed[i]) * 0.004;
        if (p[i * 3 + 1] > 9) p[i * 3 + 1] = -9;
      }
      geo.attributes.position.needsUpdate = true;
      pts.rotation.z = Math.sin(t * 0.05) * 0.08;
      cam.position.x += (mouse.x * 1.6 - cam.position.x) * 0.03;
      cam.position.y += (-mouse.y * 1.2 - cam.position.y) * 0.03;
      cam.lookAt(0, 0, 0);
      mat.opacity = 0.34 * smoke.opacity;
      renderer.render(scene, cam);
    })(t0);
  }

  /* ===========================================================
     BUTTERFLIES — 3D swarm, flapping wings, depth parallax
     =========================================================== */
  var fx = null;
  function makeButterfly(tex, half) {
    // two wings, hinged at the body (x = 0)
    function wing(side) {
      var g = new THREE.PlaneGeometry(1, 1, 1, 1);
      // pivot at inner edge: shift geometry so x in [0,1] (right) or [-1,0] (left)
      g.translate(side * 0.5, 0, 0);
      // UV: right wing -> right half of texture, left wing -> left half
      var uv = g.attributes.uv.array;
      for (var i = 0; i < uv.length; i += 2) {
        uv[i] = side > 0 ? 0.5 + uv[i] * 0.5 : uv[i] * 0.5;
      }
      g.attributes.uv.needsUpdate = true;
      var m = new THREE.Mesh(g, half.clone());
      m.material.uniforms = THREE.UniformsUtils.clone(half.uniforms);
      m.material.uniforms.map.value = tex;
      return m;
    }
    var grp = new THREE.Group();
    var L = wing(-1), R = wing(1);
    grp.add(L); grp.add(R);
    grp.userData = { L: L, R: R };
    return grp;
  }

  function wingMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: { map: { value: null } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader:
        "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ",
      fragmentShader:
        "uniform sampler2D map; varying vec2 vUv; void main(){ vec4 c=texture2D(map,vUv);" +
        "float a=max(c.r,max(c.g,c.b)); a=smoothstep(0.06,0.22,a);" +
        "if(a<0.02) discard; gl_FragColor=vec4(c.rgb,a);} "
    });
  }

  function initButterflies() {
    var canvas = document.getElementById("fx");
    if (!canvas || !hasTHREE || reduce) return;
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
    var scene = new THREE.Scene();
    var cam = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 200);
    cam.position.z = 22;

    var loader = new THREE.TextureLoader();
    var srcs = ["assets/butterfly_monarch.png", "assets/butterfly_blue.png"];
    var texes = [];
    var half = wingMaterial();
    var flock = [];
    var N = isMobile ? 7 : 16;

    function build() {
      if (!texes.length) return;
      for (var i = 0; i < N; i++) {
        var tex = texes[i % texes.length];
        var b = makeButterfly(tex, half);
        var s = 1.4 + Math.random() * 2.6;
        b.scale.set(s, s, s);
        b.position.set((Math.random() - 0.5) * 46, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30 - 6);
        b.userData.seed = Math.random() * 6.28;
        b.userData.speed = 0.4 + Math.random() * 0.7;
        b.userData.flap = 0.7 + Math.random() * 0.6;
        b.userData.baseX = b.position.x; b.userData.baseY = b.position.y;
        scene.add(b); flock.push(b);
      }
    }
    var loaded = 0;
    srcs.forEach(function (src) {
      loader.load(src, function (t) {
        t.minFilter = THREE.LinearFilter; texes.push(t);
        if (++loaded === 1) build(); // build as soon as first texture is ready
      }, undefined, function () { /* missing texture is fine */ });
    });

    var mouse = { x: 0, y: 0 };
    addEventListener("pointermove", function (e) {
      mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5;
    }, { passive: true });

    function resize() {
      renderer.setSize(innerWidth, innerHeight, false);
      cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
    }
    resize(); addEventListener("resize", resize);

    fx = { canvas: canvas, opacity: 0, scrollY: 0, renderer: renderer };
    var t0 = performance.now();
    (function loop(now) {
      requestAnimationFrame(loop);
      canvas.style.opacity = fx.opacity.toFixed(3);
      if (fx.opacity <= 0.01 || document.hidden) return;
      var t = (now - t0) / 1000;
      for (var i = 0; i < flock.length; i++) {
        var b = flock[i], u = b.userData;
        var flap = Math.sin(t * 6 * u.speed + u.seed) * u.flap;
        u.L.rotation.y = flap; u.R.rotation.y = -flap;
        b.position.y = u.baseY + Math.sin(t * 0.5 * u.speed + u.seed) * 1.6 + fx.scrollY * (6 + (i % 4) * 4);
        b.position.x = u.baseX + Math.cos(t * 0.32 * u.speed + u.seed) * 1.8;
        b.rotation.z = Math.sin(t * 0.4 + u.seed) * 0.25;
        b.rotation.x = -0.35 + Math.sin(t * 0.3 + u.seed) * 0.12;
      }
      cam.position.x += (mouse.x * 3 - cam.position.x) * 0.04;
      cam.position.y += (-mouse.y * 2 - cam.position.y) * 0.04;
      cam.lookAt(0, 0, 0);
      renderer.render(scene, cam);
    })(t0);
  }

  /* ===========================================================
     INTRO TIMELINE — the grey, the portrait, the eye, the portal
     =========================================================== */
  function buildIntro() {
    var q = function (s) { return document.querySelector(s); };
    var wordmark = q(".wordmark-wrap");
    var portraitWrap = q(".portrait-wrap");
    var portrait = q(".portrait");
    var iris = q(".iris");
    var line = q(".portrait-line");
    var flash = q(".flash");
    var hint = q(".scroll-hint");

    gsap.set(portrait, { transformOrigin: "62% 42%" });
    gsap.set(iris, { transformOrigin: "62% 42%" });

    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: ".intro", start: "top top", end: "bottom bottom",
        scrub: 0.6,
        onUpdate: function (self) { if (smoke) smoke.opacity = Math.max(0, 1 - self.progress * 3.2); }
      }
    });

    // wordmark presence -> drift away
    tl.to(hint, { opacity: 0, duration: 0.4 }, 0.04);
    tl.to(wordmark, { scale: 1.18, filter: "blur(2px)", opacity: 0, duration: 1.2, ease: "power2.in" }, 0.06);

    // grandmother arrives
    tl.fromTo(portraitWrap, { opacity: 0, scale: 1.08 }, { opacity: 1, scale: 1, duration: 1.2, ease: "power2.out" }, 0.18);
    tl.fromTo(line, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.8 }, 0.42);
    tl.to(line, { opacity: 0, y: -20, duration: 0.6 }, 0.78);

    // zoom into the eye
    tl.to(portrait, { scale: 8.2, ease: "power1.in", duration: 2.4 }, 0.62);
    tl.to(portraitWrap, { "--x": 0 }, 0.62); // keep wrap settled

    // iris portal crossfade
    tl.fromTo(iris, { opacity: 0, scale: 1.25, x: "11%", y: "-7%" },
      { opacity: 1, scale: 3.6, duration: 1.6, ease: "power1.in" }, 1.35);
    tl.to(portrait, { opacity: 0, duration: 0.6 }, 1.7);

    // the flash — memory ignites
    tl.to(flash, { opacity: 1, duration: 0.7, ease: "power2.in" }, 2.05);
    tl.to(flash, { opacity: 0, duration: 0.9, ease: "power2.out" }, 2.75);
  }

  function staticIntro() {
    // reduced-motion: everything is just visible & legible (handled in CSS)
  }

  /* ===========================================================
     COLOR WORLD — unveil, butterflies fade-in, reveals
     =========================================================== */
  function buildReveals() {
    if (!hasGSAP || !window.ScrollTrigger) return;

    // bring the butterflies + flowers into the world at the unveil
    ScrollTrigger.create({
      trigger: ".unveil", start: "top 80%",
      onEnter: function () {
        gsap.to(".world-bg", { opacity: 1, duration: 1.6, ease: "power2.out" });
        if (fx) gsap.to(fx, { opacity: 1, duration: 2.4, ease: "power2.out" });
        gsap.to(".bloom-field", { opacity: 1, y: 0, scale: 1, duration: 1.8, ease: "power2.out" });
      }
    });

    // phone: grey -> color
    var phone = document.querySelector(".phone");
    if (phone) {
      ScrollTrigger.create({
        trigger: phone, start: "top 78%", once: true,
        onEnter: function () {
          gsap.to(phone, { filter: "grayscale(0) brightness(1)", duration: 1.8, ease: "power2.inOut" });
        }
      });
    }

    if (reduce) return;

    // generic reveals
    gsap.utils.toArray(".reveal").forEach(function (el) {
      gsap.to(el, {
        opacity: 1, y: 0, duration: 1, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 85%" }
      });
    });

    // feature rows: slide + tint the accent
    gsap.utils.toArray(".feature").forEach(function (row) {
      var accent = row.getAttribute("data-accent");
      if (accent) row.style.setProperty("--accent", accent);
      var media = row.querySelector(".feature-media");
      var text = row.querySelector(".feature-text");
      gsap.from([text, media], {
        opacity: 0, y: 46, duration: 1.05, ease: "power3.out", stagger: 0.12,
        scrollTrigger: { trigger: row, start: "top 78%" }
      });
      gsap.from(row.querySelector(".feature-glyph"), {
        scale: 0.82, rotate: -6, duration: 1.2, ease: "back.out(1.6)",
        scrollTrigger: { trigger: row, start: "top 78%" }
      });
    });

    // couple the butterfly parallax to scroll progress
    ScrollTrigger.create({
      trigger: ".color-world", start: "top bottom", end: "bottom top",
      onUpdate: function (self) { if (fx) fx.scrollY = (self.progress - 0.5) * 0.6; }
    });
  }

  /* ---------------- Skip intro ---------------- */
  function initSkip() {
    var btn = document.getElementById("skip-intro");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var target = document.querySelector(".unveil");
      if (!target) return;
      if (lenis) lenis.scrollTo(target, { offset: -10, duration: 1.6 });
      else target.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    });
    // fade the button away once we're past the intro
    if (hasGSAP && window.ScrollTrigger) {
      ScrollTrigger.create({
        trigger: ".unveil", start: "top 60%",
        onEnter: function () { btn.classList.add("gone"); },
        onLeaveBack: function () { btn.classList.remove("gone"); }
      });
    }
  }

  /* ---------------- boot ---------------- */
  function boot() {
    initSmoke();
    initButterflies();
    if (!reduce) buildIntro();
    buildReveals();
    initSkip();
    if (hasGSAP && window.ScrollTrigger) ScrollTrigger.refresh();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
