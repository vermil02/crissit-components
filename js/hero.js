/* ============================================================
   머리(히어로) 동작 — 회사소개·파트너사가 함께 쓴다. 모양은 `css/hero.css`.
   2026-09-09 — 회사소개에만 있던 것을 공통으로 뺐다.

   무엇을 채우나
       --p   A → B 전환 정도 (0~1). --hero-run 만큼 굴리는 동안 0 → 1
       --q   본문이 머리를 덮어 올라오는 정도 (0~1)
       화살표 투명도 — 본문 위끝이 화면 밑단에 닿은 뒤 18% 더 굴리면 사라진다. 누르면 다음으로 이동

   필요한 마크업 — `.pg-stack` 안에 `.pg-hero` · `.pg-hero__spacer` · `.pg-main`,
   그리고 스택 밖에 `.pg-cue`. 하나라도 없으면 아무것도 하지 않는다.

   관성 스크롤(Lenis)은 화면이 CDN 으로 불러온다. 없으면 기본 스크롤로 동작한다.
   ============================================================ */
(function () {
  var stack  = document.querySelector('.pg-stack');
  var spacer = document.querySelector('.pg-hero__spacer');
  var main   = document.querySelector('.pg-main');
  var cue    = document.querySelector('.pg-cue');
  if (!stack || !spacer || !main || !cue) return;

  var BASE = 0.48, GLIDE_MS = 600;       // 화살표 투명도(시안) · 눌렀을 때 이동 시간
  var gliding = false, nextY = 0, lenis = null;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function mainTop() { return main.getBoundingClientRect().top + window.scrollY; }

  function cssLen(name) {                // --hero-run 같은 값을 px 로. vh · px 만 받는다
    var v = getComputedStyle(stack).getPropertyValue(name).trim();
    var n = parseFloat(v);
    if (!n) return 0;
    return v.indexOf('vh') > -1 ? n * window.innerHeight / 100 : n;
  }

  function paint() {
    var vh = window.innerHeight, y = window.scrollY;
    var run = cssLen('--hero-run') || vh;            // 이 거리 동안 A → B
    var p = y / run; if (p < 0) p = 0; else if (p > 1) p = 1;
    stack.style.setProperty('--p', p.toFixed(4));

    var top = mainTop();
    var q = (y - (top - vh)) / vh;                   // 본문이 화면 밑단에 닿은 뒤 한 화면 올라오는 동안 0 → 1
    if (q < 0) q = 0; else if (q > 1) q = 1;
    stack.style.setProperty('--q', q.toFixed(4));

    var from = top - vh, to = top - vh * 0.82;
    var op = 1;
    if (y >= to) op = 0; else if (y > from) op = 1 - (y - from) / (to - from);
    cue.style.opacity = (BASE * op).toFixed(3);
    cue.style.pointerEvents = op > 0.15 ? 'auto' : 'none';
    nextY = (y < run * 0.98) ? run : top;            // 아직 A 쪽이면 B 상태로, 아니면 본문으로
  }

  // 관성 스크롤 (Lenis). 화면이 불러오지 않았으면 그냥 넘어간다
  if (window.Lenis && !reduce) {
    lenis = new window.Lenis({ duration: 1.05, smoothWheel: true, touchMultiplier: 1.6 });
    lenis.on('scroll', paint);
    (function loop(t) { if (!lenis) return; lenis.raf(t); requestAnimationFrame(loop); })();
  }

  cue.addEventListener('click', function () {
    var y = nextY; gliding = true;
    if (lenis) lenis.scrollTo(y, { duration: GLIDE_MS / 1000 });
    else window.scrollTo({ top: y, behavior: 'smooth' });
    var follow = setInterval(paint, 16);
    setTimeout(function () { clearInterval(follow); gliding = false; paint(); }, GLIDE_MS + 60);
  });
  ['wheel', 'touchstart', 'keydown'].forEach(function (ev) {
    window.addEventListener(ev, function () {
      if (!gliding) return;
      gliding = false; window.scrollTo({ top: window.scrollY, behavior: 'auto' });
    }, { passive: true });
  });

  // 진입 — 열릴 때마다 한 번. 새로고침해도 돈다(브라우저가 기억한 스크롤 위치를 버리고 맨 위에서 시작).
  // 굴리기 시작하면 배경(어둠·확대·흐림 풀림)과 문구를 세 배로 감아 서둘러 끝낸다 —
  // 굴리는데 2.5초 동안 어둡고 흐리게 남아 있으면 아직 로드 중인 것처럼 보인다(2026-09-09)
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
  if (!reduce) stack.classList.add('is-intro');
  var rushed = false;
  window.addEventListener('scroll', function () {
    if (rushed || window.scrollY < 40) return;
    rushed = true;
    document.querySelectorAll('.pg-hero__title--a .pg-in, .pg-hero__in, .pg-hero__blur').forEach(function (e) {
      e.getAnimations().forEach(function (a) { a.playbackRate = 3; });
    });
  }, { passive: true });

  window.addEventListener('scroll', paint, { passive: true });
  window.addEventListener('resize', paint);
  paint();
})();
