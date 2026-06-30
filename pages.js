/* ============================================================
   RECALL — pages.js  (shared script for content pages)
   Lenis smooth scroll + GSAP reveals + brand butterflies
   ============================================================ */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isMobile = window.matchMedia("(max-width: 760px)").matches;
  var hasGSAP = typeof gsap !== "undefined";
  var hasTHREE = typeof THREE !== "undefined";
  if (hasGSAP && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  if (!reduce && typeof Lenis !== "undefined" && hasGSAP) {
    var lenis = new Lenis({ lerp: 0.08, wheelMultiplier: 0.9, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  /* reveals */
  if (hasGSAP && window.ScrollTrigger && !reduce) {
    gsap.utils.toArray(".reveal").forEach(function (el) {
      gsap.fromTo(el, { opacity: 0, y: 36 },
        { opacity: 1, y: 0, duration: 1, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%" } });
    });
  } else {
    document.querySelectorAll(".reveal").forEach(function (el) { el.style.opacity = 1; });
  }

  /* butterflies (subtle, brand-consistent) */
  function initButterflies() {
    var canvas = document.getElementById("fx");
    if (!canvas || !hasTHREE || reduce) return;
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
    var scene = new THREE.Scene();
    var cam = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 200);
    cam.position.z = 24;

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
      var m = new THREE.Mesh(g, half.clone());
      m.material.uniforms = THREE.UniformsUtils.clone(half.uniforms); m.material.uniforms.map.value = tex;
      return m;
    }
    var flock = [], texes = [], N = isMobile ? 5 : 9, loader = new THREE.TextureLoader();
    function build() {
      for (var i = 0; i < N; i++) {
        var tex = texes[i % texes.length];
        var grp = new THREE.Group(); var L = wing(tex, -1), R = wing(tex, 1);
        grp.add(L); grp.add(R);
        var s = 2.4 + Math.random() * 3.4; grp.scale.set(s, s, s);
        grp.position.set((Math.random() - 0.5) * 52, (Math.random() - 0.5) * 34, (Math.random() - 0.5) * 26 - 6);
        grp.userData = { L: L, R: R, seed: Math.random() * 6.28, speed: 0.4 + Math.random() * 0.6,
          flap: 0.8 + Math.random() * 0.5, bx: grp.position.x, by: grp.position.y };
        scene.add(grp); flock.push(grp);
      }
      gsap && gsap.to(canvas, { opacity: 0.6, duration: 2.4, ease: "power2.out" });
    }
    var loaded = 0;
    ["assets/butterfly_monarch.png", "assets/butterfly_blue.png"].forEach(function (src) {
      loader.load(src, function (t) { t.minFilter = THREE.LinearFilter; texes.push(t); if (++loaded === 1) build(); }, undefined, function () {});
    });

    var mouse = { x: 0, y: 0 };
    addEventListener("pointermove", function (e) { mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5; }, { passive: true });
    function resize() { renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
    resize(); addEventListener("resize", resize);

    var sy = 0;
    if (typeof lenis !== "undefined") lenis.on("scroll", function (e) { sy = (e.scroll || window.scrollY) * 0.0006; });
    else addEventListener("scroll", function () { sy = window.scrollY * 0.0006; }, { passive: true });

    var t0 = performance.now();
    (function loop(now) {
      requestAnimationFrame(loop);
      if (document.hidden) return;
      var t = (now - t0) / 1000;
      for (var i = 0; i < flock.length; i++) {
        var b = flock[i], u = b.userData, flap = Math.sin(t * 6 * u.speed + u.seed) * u.flap;
        u.L.rotation.y = flap; u.R.rotation.y = -flap;
        b.position.y = u.by + Math.sin(t * 0.5 * u.speed + u.seed) * 1.8 + sy * (6 + (i % 3) * 5);
        b.position.x = u.bx + Math.cos(t * 0.3 * u.speed + u.seed) * 2.0;
        b.rotation.z = Math.sin(t * 0.4 + u.seed) * 0.22; b.rotation.x = -0.35 + Math.sin(t * 0.3 + u.seed) * 0.12;
      }
      cam.position.x += (mouse.x * 3 - cam.position.x) * 0.04;
      cam.position.y += (-mouse.y * 2 - cam.position.y) * 0.04;
      cam.lookAt(0, 0, 0);
      renderer.render(scene, cam);
    })(t0);
  }
  initButterflies();
})();
