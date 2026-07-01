/* ============================================================
   RECALL — main.js  (the descent)
   A glowing Recall phone falls cliff to cliff as you scroll.
   ============================================================ */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isMobile = window.matchMedia("(max-width: 760px)").matches;
  var hasGSAP = typeof gsap !== "undefined";
  var hasTHREE = typeof THREE !== "undefined";
  if (hasGSAP && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  var lenis = null;
  if (!reduce && typeof Lenis !== "undefined" && hasGSAP) {
    lenis = new Lenis({ lerp: 0.075, wheelMultiplier: 0.9, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    window.__lenis = lenis;
  }

  /* ===========================================================
     FOG — drifting mist in the canyon (textured planes, additive)
     =========================================================== */
  function initFog() {
    var canvas = document.getElementById("fog");
    if (!canvas || !hasTHREE || reduce) return;
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    var scene = new THREE.Scene();
    var cam = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
    cam.position.z = 16;
    var N = isMobile ? 6 : 11, planes = [];

    function mat(tex, op) {
      return new THREE.ShaderMaterial({
        uniforms: { map: { value: tex }, opacity: { value: op } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ",
        fragmentShader: "uniform sampler2D map; uniform float opacity; varying vec2 vUv;" +
          "void main(){ vec4 c=texture2D(map,vUv); float d=distance(vUv,vec2(0.5));" +
          "float fall=smoothstep(0.5,0.1,d); gl_FragColor=vec4(c.rgb*fall*opacity,1.0);} "
      });
    }
    function build(tex) {
      for (var i = 0; i < N; i++) {
        var size = 16 + Math.random() * 18;
        var m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat(tex, 0.12 + Math.random() * 0.12));
        m.position.set((Math.random() - 0.5) * 28, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 8);
        m.rotation.z = Math.random() * 6.28;
        m.userData = { seed: Math.random() * 6.28, rise: 0.004 + Math.random() * 0.006, spin: (Math.random() - 0.5) * 0.02, op: m.material.uniforms.opacity.value };
        scene.add(m); planes.push(m);
      }
    }
    new THREE.TextureLoader().load("assets/smoke.png", function (t) { t.minFilter = THREE.LinearFilter; build(t); }, undefined, function () {});
    function resize() { renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
    resize(); addEventListener("resize", resize);
    var t0 = performance.now();
    (function loop(now) {
      requestAnimationFrame(loop);
      if (document.hidden) return;
      var t = (now - t0) / 1000;
      for (var i = 0; i < planes.length; i++) {
        var m = planes[i], u = m.userData;
        m.position.y += u.rise; if (m.position.y > 12) m.position.y = -12;
        m.rotation.z += u.spin * 0.4;
      }
      renderer.render(scene, cam);
    })(t0);
  }

  /* ===========================================================
     BUTTERFLIES — the safe-landing payoff
     =========================================================== */
  var fx = null;
  function initButterflies() {
    var canvas = document.getElementById("fx");
    if (!canvas || !hasTHREE || reduce) return;
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    var scene = new THREE.Scene();
    var cam = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 200);
    cam.position.z = 22;
    var half = new THREE.ShaderMaterial({
      uniforms: { map: { value: null } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ",
      fragmentShader: "uniform sampler2D map; varying vec2 vUv; void main(){ vec4 c=texture2D(map,vUv);" +
        "float a=max(c.r,max(c.g,c.b)); a=smoothstep(0.05,0.20,a); if(a<0.02) discard; gl_FragColor=vec4(c.rgb,a);} "
    });
    function wing(tex, side) {
      var g = new THREE.PlaneGeometry(1, 1); g.translate(side * 0.5, 0, 0);
      var uv = g.attributes.uv.array;
      for (var i = 0; i < uv.length; i += 2) uv[i] = side > 0 ? 0.5 + uv[i] * 0.5 : uv[i] * 0.5;
      var m = new THREE.Mesh(g, half.clone()); m.material.uniforms = THREE.UniformsUtils.clone(half.uniforms); m.material.uniforms.map.value = tex; return m;
    }
    var flock = [], texes = [], N = isMobile ? 7 : 15, loader = new THREE.TextureLoader();
    function build() {
      for (var i = 0; i < N; i++) {
        var tex = texes[i % texes.length], grp = new THREE.Group(), L = wing(tex, -1), R = wing(tex, 1);
        grp.add(L); grp.add(R);
        var s = 2.8 + Math.random() * 4.0; grp.scale.set(s, s, s);
        grp.position.set((Math.random() - 0.5) * 48, (Math.random() - 0.5) * 32, (Math.random() - 0.5) * 30 - 4);
        grp.userData = { L: L, R: R, seed: Math.random() * 6.28, speed: 0.4 + Math.random() * 0.7, flap: 0.8 + Math.random() * 0.6, bx: grp.position.x, by: grp.position.y };
        scene.add(grp); flock.push(grp);
      }
    }
    var loaded = 0;
    ["assets/butterfly_monarch.png", "assets/butterfly_blue.png"].forEach(function (src) {
      loader.load(src, function (t) { t.minFilter = THREE.LinearFilter; texes.push(t); if (++loaded === 1) build(); }, undefined, function () {});
    });
    var mouse = { x: 0, y: 0 };
    addEventListener("pointermove", function (e) { mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5; }, { passive: true });
    function resize() { renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
    resize(); addEventListener("resize", resize);
    fx = { opacity: 0 };
    var t0 = performance.now();
    (function loop(now) {
      requestAnimationFrame(loop);
      canvas.style.opacity = fx.opacity.toFixed(3);
      if (fx.opacity <= 0.01 || document.hidden) return;
      var t = (now - t0) / 1000;
      for (var i = 0; i < flock.length; i++) {
        var b = flock[i], u = b.userData, flap = Math.sin(t * 6 * u.speed + u.seed) * u.flap;
        u.L.rotation.y = flap; u.R.rotation.y = -flap;
        b.position.y = u.by + Math.sin(t * 0.5 * u.speed + u.seed) * 1.8;
        b.position.x = u.bx + Math.cos(t * 0.32 * u.speed + u.seed) * 2.0;
        b.rotation.z = Math.sin(t * 0.4 + u.seed) * 0.25; b.rotation.x = -0.35 + Math.sin(t * 0.3 + u.seed) * 0.12;
      }
      cam.position.x += (mouse.x * 3 - cam.position.x) * 0.04;
      cam.position.y += (-mouse.y * 2 - cam.position.y) * 0.04;
      cam.lookAt(0, 0, 0);
      renderer.render(scene, cam);
    })(t0);
  }

  /* ===========================================================
     THE DESCENT — canyon, parallax, and the falling phone
     =========================================================== */
  function buildDescent() {
    if (!hasGSAP || !window.ScrollTrigger) return;
    var canyon = document.querySelector(".canyon");
    var faller = document.querySelector(".faller");
    var phone = document.querySelector(".faller .phone");
    var cliffs = gsap.utils.toArray(".cliff");
    if (!phone) return;

    // canyon + phone appear while the descent is in view
    var vis = { v: 0 };
    ScrollTrigger.create({
      trigger: ".descent", start: "top 80%", end: "bottom 20%",
      onEnter: show, onEnterBack: show,
      onLeave: hide, onLeaveBack: hide
    });
    function show() { gsap.to([canyon, faller], { opacity: 1, duration: 1.0, ease: "power2.out" }); }
    function hide() { gsap.to([canyon, faller], { opacity: 0, duration: 0.8, ease: "power2.out" }); }
    gsap.set([canyon, faller], { opacity: 0 });

    if (reduce) { gsap.set([canyon, faller], { opacity: 1 }); return; }

    // parallax: the canyon drifts slower than the scroll
    gsap.to(".canyon-img", { yPercent: 16, ease: "none",
      scrollTrigger: { trigger: ".descent", start: "top top", end: "bottom bottom", scrub: true } });

    // each cliff: reveal its text + tell the phone which side to land on
    var state = { x: 0, tx: 0, land: 0, active: 0 };
    function sideX(side) {
      var amt = innerWidth * (isMobile ? 0.0 : 0.19);
      return side === "left" ? -amt : side === "right" ? amt : 0;
    }
    cliffs.forEach(function (cliff, i) {
      var text = cliff.querySelector(".cliff-text");
      var side = cliff.getAttribute("data-side");
      gsap.from(text, {
        opacity: 0, y: 40, duration: 1.0, ease: "power3.out",
        scrollTrigger: { trigger: cliff, start: "top 72%" }
      });
      ScrollTrigger.create({
        trigger: cliff, start: "top center", end: "bottom center",
        onEnter: function () { land(side); }, onEnterBack: function () { land(side); }
      });
    });
    function land(side) { state.tx = sideX(side); state.land = 1; }

    // the phone's life: ease toward the active side, bob like a fall, bounce on landing
    var t0 = performance.now();
    (function loop(now) {
      requestAnimationFrame(loop);
      var t = (now - t0) / 1000;
      state.x += (state.tx - state.x) * 0.06;
      state.land *= 0.93;
      var bob = Math.sin(t * 1.1) * 9;
      var fallTilt = (state.tx - state.x) * 0.03;          // lean toward travel
      var sway = Math.sin(t * 0.8) * 2.2;
      var squash = 1 - state.land * 0.10;                   // land squash
      var drop = state.land * 10;                            // settle dip
      phone.style.transform =
        "translate(" + state.x.toFixed(1) + "px," + (bob + drop).toFixed(1) + "px) " +
        "rotate(" + (fallTilt + sway).toFixed(2) + "deg) scaleY(" + squash.toFixed(3) + ")";
    })(t0);
  }

  /* ===========================================================
     FINAL — butterflies bloom as the phone lands safely
     =========================================================== */
  function buildFinal() {
    if (!hasGSAP || !window.ScrollTrigger) return;
    ScrollTrigger.create({
      trigger: ".color-world", start: "top 70%",
      onEnter: function () { if (fx) gsap.to(fx, { opacity: 1, duration: 2.4, ease: "power2.out" }); }
    });
    if (reduce) { document.querySelectorAll(".reveal").forEach(function (el) { el.style.opacity = 1; el.style.transform = "none"; }); return; }
    gsap.utils.toArray(".reveal").forEach(function (el) {
      gsap.to(el, { opacity: 1, y: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 88%" } });
    });
  }

  function boot() {
    initFog();
    initButterflies();
    buildDescent();
    buildFinal();
    if (hasGSAP && window.ScrollTrigger) ScrollTrigger.refresh();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
