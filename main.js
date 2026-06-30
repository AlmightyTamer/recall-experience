/* ============================================================
   RECALL — main.js  (studio-black edition)
   Lenis + GSAP ScrollTrigger, Three.js ink-smoke & butterflies
   ============================================================ */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isMobile = window.matchMedia("(max-width: 760px)").matches;
  var hasGSAP = typeof gsap !== "undefined";
  var hasTHREE = typeof THREE !== "undefined";

  if (hasGSAP && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  /* ---------------- Nav: scroll state + mobile menu ---------------- */
  function initNav() {
    var nav = document.querySelector(".nav");
    var toggle = document.querySelector(".nav-toggle");
    var menu = document.getElementById("nav-menu");
    if (!nav) return;

    function onScroll() {
      nav.classList.toggle("is-scrolled", window.scrollY > 48);
    }
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });

    if (toggle && menu) {
      toggle.addEventListener("click", function () {
        var open = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", open ? "false" : "true");
        menu.classList.toggle("is-open", !open);
        document.body.style.overflow = open ? "" : "hidden";
      });
      menu.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () {
          toggle.setAttribute("aria-expanded", "false");
          menu.classList.remove("is-open");
          document.body.style.overflow = "";
        });
      });
    }
  }

  /* ---------------- Smooth scroll ---------------- */
  var lenis = null;
  if (!reduce && typeof Lenis !== "undefined" && hasGSAP) {
    lenis = new Lenis({ lerp: 0.07, wheelMultiplier: 0.85, smoothWheel: true, syncTouch: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    window.__lenis = lenis;
  }

  /* ===========================================================
     SMOKE — layered textured planes, additive (black drops out)
     =========================================================== */
  function softSprite() {
    var c = document.createElement("canvas"); c.width = c.height = 256;
    var g = c.getContext("2d");
    var rg = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    rg.addColorStop(0, "rgba(255,255,255,0.8)");
    rg.addColorStop(0.35, "rgba(220,224,232,0.28)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
    var t = new THREE.Texture(c); t.needsUpdate = true; return t;
  }

  var smoke = null;
  function initSmoke() {
    var canvas = document.getElementById("smoke");
    if (!canvas || !hasTHREE || reduce) return;
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
    var scene = new THREE.Scene();
    var cam = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
    cam.position.z = 16;

    var N = isMobile ? 7 : 13;
    var planes = [];
    var fallbackTex = softSprite();

    function smokeMat(tex, op) {
      return new THREE.ShaderMaterial({
        uniforms: { map: { value: tex }, opacity: { value: op } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ",
        fragmentShader:
          "uniform sampler2D map; uniform float opacity; varying vec2 vUv;" +
          "void main(){ vec4 c=texture2D(map,vUv);" +
          "float d=distance(vUv,vec2(0.5));" +              // radial edge fade
          "float fall=smoothstep(0.5,0.12,d);" +
          "gl_FragColor=vec4(c.rgb*fall*opacity,1.0);} "    // additive: alpha unused
      });
    }
    function buildPlanes(tex, isReal) {
      for (var i = 0; i < N; i++) {
        var size = (isReal ? 17 : 11) + Math.random() * (isReal ? 18 : 10);
        var geo = new THREE.PlaneGeometry(size, size);
        var op = (isReal ? 0.5 : 0.32) + Math.random() * 0.25;
        var mat = smokeMat(tex, op);
        var m = new THREE.Mesh(geo, mat);
        // keep smoke on the right so the wordmark stays clear on the left
        m.position.set(6 + Math.random() * 18, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 8);
        m.rotation.z = Math.random() * 6.28;
        m.userData = {
          seed: Math.random() * 6.28,
          spin: (Math.random() - 0.5) * 0.03,
          riseV: 0.006 + Math.random() * 0.01,
          baseOp: op
        };
        scene.add(m); planes.push(m);
      }
    }
    // try the real ink-smoke texture; fall back to the soft sprite
    new THREE.TextureLoader().load(
      "assets/smoke.png",
      function (tex) { tex.minFilter = THREE.LinearFilter; buildPlanes(tex, true); },
      undefined,
      function () { buildPlanes(fallbackTex, false); }
    );

    var mouse = { x: 0, y: 0 };
    addEventListener("pointermove", function (e) {
      mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5;
    }, { passive: true });

    function resize() {
      renderer.setSize(innerWidth, innerHeight, false);
      cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
    }
    resize(); addEventListener("resize", resize);

    smoke = { opacity: 0, intro: 1 };  // opacity = entrance fade, intro = scroll fade
    var t0 = performance.now();
    (function loop(now) {
      requestAnimationFrame(loop);
      var vis = smoke.opacity * smoke.intro;
      if (vis <= 0.01) { renderer.clear(); return; }
      var t = (now - t0) / 1000;
      for (var i = 0; i < planes.length; i++) {
        var m = planes[i], u = m.userData;
        m.position.y += u.riseV;
        m.position.x += Math.sin(t * 0.18 + u.seed) * 0.006;
        if (m.position.y > 12) m.position.y = -12;
        m.rotation.z += u.spin * 0.4;
        m.material.uniforms.opacity.value = u.baseOp * vis;
      }
      cam.position.x += (mouse.x * 2.2 - cam.position.x) * 0.03;
      cam.position.y += (-mouse.y * 1.6 - cam.position.y) * 0.03;
      cam.lookAt(0, 0, 0);
      renderer.render(scene, cam);
    })(t0);
  }

  /* ===========================================================
     BUTTERFLIES — 3D swarm, bigger, flapping, depth parallax
     =========================================================== */
  var fx = null;
  function wingMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: { map: { value: null } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ",
      fragmentShader:
        "uniform sampler2D map; varying vec2 vUv; void main(){ vec4 c=texture2D(map,vUv);" +
        "float a=max(c.r,max(c.g,c.b)); a=smoothstep(0.05,0.20,a);" +
        "if(a<0.02) discard; gl_FragColor=vec4(c.rgb,a);} "
    });
  }
  function makeButterfly(tex, half) {
    function wing(side) {
      var g = new THREE.PlaneGeometry(1, 1, 1, 1);
      g.translate(side * 0.5, 0, 0);
      var uv = g.attributes.uv.array;
      for (var i = 0; i < uv.length; i += 2) uv[i] = side > 0 ? 0.5 + uv[i] * 0.5 : uv[i] * 0.5;
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
    var texes = [], half = wingMaterial(), flock = [];
    var N = isMobile ? 8 : 17;

    function build() {
      if (!texes.length) return;
      for (var i = 0; i < N; i++) {
        var b = makeButterfly(texes[i % texes.length], half);
        var s = 2.8 + Math.random() * 4.0;            // BIGGER
        b.scale.set(s, s, s);
        b.position.set((Math.random() - 0.5) * 48, (Math.random() - 0.5) * 32, (Math.random() - 0.5) * 30 - 4);
        b.userData.seed = Math.random() * 6.28;
        b.userData.speed = 0.4 + Math.random() * 0.7;
        b.userData.flap = 0.8 + Math.random() * 0.6;
        b.userData.baseX = b.position.x; b.userData.baseY = b.position.y;
        scene.add(b); flock.push(b);
      }
    }
    var loaded = 0;
    srcs.forEach(function (src) {
      loader.load(src, function (t) { t.minFilter = THREE.LinearFilter; texes.push(t); if (++loaded === 1) build(); },
        undefined, function () {});
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

    fx = { opacity: 0, scrollY: 0 };
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
        b.position.y = u.baseY + Math.sin(t * 0.5 * u.speed + u.seed) * 1.8 + fx.scrollY * (6 + (i % 4) * 4);
        b.position.x = u.baseX + Math.cos(t * 0.32 * u.speed + u.seed) * 2.0;
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
     INTRO ENTRANCE — plays on every load
     =========================================================== */
  function playEntrance() {
    if (reduce || !hasGSAP) { if (smoke) smoke.opacity = 1; return; }
    var eyebrow = document.querySelector(".wordmark-eyebrow");
    var wm = document.querySelector(".wordmark");
    var sub = document.querySelector(".wordmark-sub");
    var rule = document.querySelector(".wordmark-sub .rule");
    var navEls = gsap.utils.toArray(".nav-brand, .nav-links a");
    var social = gsap.utils.toArray(".social li");
    var cue = document.querySelector(".scroll-cue");
    var actions = document.querySelector(".hero-actions");

    if (eyebrow) gsap.set(eyebrow, { opacity: 0, y: 10 });
    gsap.set(wm, { opacity: 0, scale: 0.92, filter: "blur(20px)" });
    gsap.set(sub, { opacity: 0 });
    if (rule) gsap.set(rule, { width: 0 });
    if (actions) gsap.set(actions, { opacity: 0, y: 16 });
    gsap.set(navEls, { opacity: 0, y: -16 });
    gsap.set(social, { opacity: 0, x: -14 });
    gsap.set(cue, { opacity: 0, y: 12 });

    var tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    if (smoke) tl.to(smoke, { opacity: 1, duration: 2.2, ease: "power2.out" }, 0);
    if (eyebrow) tl.to(eyebrow, { opacity: 1, y: 0, duration: 0.9 }, 0.2);
    tl.to(wm, { opacity: 1, scale: 1, filter: "blur(0px)", duration: 1.8, ease: "power3.out" }, 0.25)
      .to(rule, { width: 54, duration: 1.0 }, 1.0)
      .to(sub, { opacity: 1, duration: 1.0 }, 1.05)
      .to(actions, { opacity: 1, y: 0, duration: 0.85 }, 1.2)
      .to(navEls, { opacity: 1, y: 0, duration: 0.8, stagger: 0.07 }, 0.55)
      .to(social, { opacity: 1, x: 0, duration: 0.7, stagger: 0.08 }, 1.15)
      .to(cue, { opacity: 1, y: 0, duration: 0.8 }, 1.35);
  }

  /* ===========================================================
     INTRO SCRUB — hero dissolves straight into the butterfly world
     =========================================================== */
  function buildIntro() {
    var q = function (s) { return document.querySelector(s); };
    var wordmark = q(".wordmark-wrap"), haze = q(".haze"),
        beam = q(".intro-beam"), glow = q(".intro-glow"), cue = q(".scroll-cue"),
        actions = q(".hero-actions");

    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: ".intro", start: "top top", end: "bottom top", scrub: 0.9,
        onUpdate: function (self) {
          if (smoke) smoke.intro = Math.max(0, 1 - self.progress * 2.8);
          if (fx) fx.opacity = Math.min(1, Math.max(0, (self.progress - 0.35) / 0.45));
        }
      }
    });

    tl.to(wordmark, { y: -72, scale: 1.04, filter: "blur(6px)", opacity: 0, ease: "power2.in", duration: 1 }, 0);
    if (haze) tl.to(haze, { opacity: 0, duration: 0.85, ease: "power1.in" }, 0);
    if (beam) tl.to(beam, { opacity: 0, duration: 0.85 }, 0);
    if (glow) tl.to(glow, { opacity: 0.4, duration: 0.85 }, 0);
    if (cue) tl.to(cue, { opacity: 0, y: 20, duration: 0.5, ease: "power2.in" }, 0);
    if (actions) tl.to(actions, { opacity: 0, y: 12, duration: 0.45, ease: "power2.in" }, 0);
  }

  /* ===========================================================
     COLOR WORLD reveals
     =========================================================== */
  function buildReveals() {
    if (!hasGSAP || !window.ScrollTrigger) return;

    if (!reduce && fx) {
      ScrollTrigger.create({
        trigger: ".color-world", start: "top 85%", once: true,
        onEnter: function () { gsap.to(fx, { opacity: 1, duration: 2.0, ease: "power2.out" }); }
      });
    }

    var flowers = document.querySelector(".color-world__flowers");
    if (flowers && !reduce) {
      gsap.to(flowers, {
        y: -80, ease: "none",
        scrollTrigger: { trigger: ".color-world", start: "top bottom", end: "bottom top", scrub: 1.2 }
      });
    }

    if (reduce) return;

    gsap.utils.toArray(".step, .impact-stat").forEach(function (el, i) {
      gsap.from(el, {
        opacity: 0, y: 40, duration: 0.95, ease: "power3.out", delay: i * 0.04,
        scrollTrigger: { trigger: el, start: "top 88%" }
      });
    });

    gsap.utils.toArray(".reveal").forEach(function (el) {
      gsap.to(el, { opacity: 1, y: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 85%" } });
    });

    gsap.utils.toArray(".feature").forEach(function (row) {
      var accent = row.getAttribute("data-accent");
      if (accent) row.style.setProperty("--accent", accent);
      gsap.from([row.querySelector(".feature-text"), row.querySelector(".feature-media")], {
        opacity: 0, y: 46, duration: 1.05, ease: "power3.out", stagger: 0.12,
        scrollTrigger: { trigger: row, start: "top 78%" }
      });
      gsap.from(row.querySelector(".feature-glyph"), {
        scale: 0.82, rotate: -6, duration: 1.2, ease: "back.out(1.6)",
        scrollTrigger: { trigger: row, start: "top 78%" }
      });
    });

    ScrollTrigger.create({
      trigger: ".color-world", start: "top bottom", end: "bottom top",
      onUpdate: function (self) { if (fx) fx.scrollY = (self.progress - 0.5) * 0.6; }
    });
  }

  /* ---------------- boot ---------------- */
  function boot() {
    initNav();
    initSmoke();
    initButterflies();
    if (!reduce) buildIntro();
    buildReveals();
    playEntrance();
    if (hasGSAP && window.ScrollTrigger) ScrollTrigger.refresh();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
