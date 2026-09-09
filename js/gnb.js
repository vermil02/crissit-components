/* ============================================================
   GNB 동작 — 채택안 `_실험/윌슨-GNB-효과-LAB` v15 (2026-09-09). 모양은 css/gnb.css, 전환은 css/gnb-site.css.

   ① 바 — 스크롤마다 클래스를 정한다 (v7 규칙)
        y ≤ 96         → gnb--{tone} gnb--transparent      맨 위는 투명 (관성 스크롤이 0 에 닿기 전에 바꾼다)
        y > 96         → gnb--{tone} is-scrolled           굴리면 채움 + 아래 1px 선. 바는 사라지지 않는다
      tone 은 바 밑단에 걸린 섹션의 data-gnb="black|white" — 기계가 색을 재지 않고 디자이너가 섹션에 표시한다.
      겹쳐 있으면(회사소개의 sticky 머리 위로 본문이 올라옴) 문서에서 뒤에 오는 것이 위에 있으므로 **마지막으로 맞는 것**을 쓴다.
      표시가 없으면 <html data-gnb-mode> (없으면 white).
      ⚠ 스크롤마다 같은 값을 다시 쓰지 않는다 — 헤더가 매 프레임 다시 계산되어 sticky 바와 판이 흔들린다.

   ② 판(LNB) — 메뉴(data-lnb)에 올리면 그 판(data-lnb-panel)이 열린다
        · 배경 층(.gnb__lnb-back)의 높이를 목표 판 높이로 → CSS 가 0.28s 로 키운다. 내용은 .is-open 으로 0.35s 스며 나옴
        · 다른 판으로 옮기면 배경은 이어지고, 나가는 판 .is-cut(0.16s) · 들어오는 판 .is-switch(아래서 떠오름)
        · 판 없는 메뉴(고객사·미디어)에 올리면 접힌다. 로고·언어·CTA·판 위에서는 그대로. 헤더를 벗어나면 접힌다
        · 닫는 동안에는 `is-closing` 이 붙어 바가 채운 모습을 유지한다 — 딤이 다 사라진 뒤에 반투명으로 돌아간다 (v22)
        · 키보드 초점으로도 열린다 · Esc · 딤 클릭으로 닫힌다 · 스크롤로는 닫지 않는다
        · 태블릿·모바일(1023 이하)에서는 열지 않는다 — 드로어를 쓴다
        · 항목에 올리면 판 그림이 1.06배(그림은 판마다 한 장, 바뀌지 않는다)

   ── 붙이는 법 ────────────────────────────────────────────────
   <header class="gnb pg-gnb" id="gnb"> 안에
     · 메뉴 링크에 data-lnb="제품" · 판에 <div class="gnb__lnb" data-lnb-panel="제품">
     · 판들 앞에 <div class="gnb__lnb-back"></div>
   헤더 다음에 <div class="gnb__dim" id="lnbDim"></div>
   섹션에 data-gnb="black|white". 전부 공통.py 가 만든다.
   ============================================================ */
(function () {
  var gnb = document.getElementById('gnb');
  if (!gnb) return;

  /* ── ① 바 ─────────────────────────────────────────────── */
  var sections = Array.prototype.slice.call(document.querySelectorAll('[data-gnb]'));
  var fallback = document.documentElement.getAttribute('data-gnb-mode') || 'white';

  function toneUnderBar(h) {
    var tone = null;
    for (var i = 0; i < sections.length; i++) {
      var r = sections[i].getBoundingClientRect();
      if (r.top <= h && r.bottom > h) tone = sections[i].getAttribute('data-gnb');   // 마지막으로 맞는 것
    }
    return tone || fallback;
  }
  /* v7 — 여기만 고치면 바 규칙이 바뀐다 (LAB 의 rule 과 같은 꼴).
     「맨 위」는 y ≤ 96 으로 본다 — 관성 스크롤(Lenis)은 0 에 닿기까지 1초 가까이 미끄러져서, 정확히 0 에서만 투명으로
     바꾸면 위로 다 올라간 뒤에도 바가 한참 채워져 있다(2026-09-09 사용자 지적).
     처음엔 32 였는데 회사소개(Lenis 있음)에서 휠을 놓고 577ms 뒤에야 전환이 시작돼 96 으로 올렸다 — 426ms 로 151ms 빨라진다.
     아래로 내려갈 때도 96px 까지는 투명이지만 머리 그림·흰 배경 위라 티가 안 난다. 더 올리면 본문 글자가 바 글자와 겹친다 */
  var TOP = 96;
  function rule(y, tone) {
    var c = 'gnb--' + tone;
    return y <= TOP ? c + ' gnb--transparent' : c + ' is-scrolled';
  }
  function paintBar() {
    var next = 'gnb pg-gnb ' + rule(window.scrollY, toneUnderBar(gnb.offsetHeight))
             + (gnb.classList.contains('is-expanded') ? ' is-expanded' : '')
             + (gnb.classList.contains('is-closing')  ? ' is-closing'  : '');
    if (gnb.className !== next) gnb.className = next;        // 바뀔 때만 쓴다
  }
  window.addEventListener('scroll', paintBar, { passive: true });
  window.addEventListener('resize', paintBar);

  /* ── ② 판 ─────────────────────────────────────────────── */
  var links  = Array.prototype.slice.call(gnb.querySelectorAll('[data-lnb]'));
  var panels = Array.prototype.slice.call(gnb.querySelectorAll('[data-lnb-panel]'));
  var back   = gnb.querySelector('.gnb__lnb-back');
  var dim    = document.getElementById('lnbDim');
  var wide   = window.matchMedia('(min-width:1024px)');
  var openName = null, closeTimer = null;

  /* 딤이 사라지는 데 걸리는 시간 — CSS 변수 --lnb-dim-out 에서 읽는다. 못 읽으면 200ms */
  function dimOut() {
    var v = getComputedStyle(gnb).getPropertyValue('--lnb-dim-out').trim();
    var n = parseFloat(v);
    if (isNaN(n)) return 200;
    return /ms$/.test(v) ? n : n * 1000;      // 200ms 또는 0.2s 둘 다 받는다
  }

  function paint(name) {
    var prev = -1, next = -1;
    panels.forEach(function (p, i) {
      if (p.classList.contains('is-open')) prev = i;
      if (name && p.getAttribute('data-lnb-panel') === name) next = i;
    });
    var swap = prev > -1 && next > -1 && prev !== next;       // 열린 채로 다른 판으로
    panels.forEach(function (p, i) {
      var mine = i === next;
      p.classList.remove('is-switch', 'is-cut');
      if (swap && mine) p.classList.add('is-switch');
      if (swap && i === prev) p.classList.add('is-cut');
      p.classList.toggle('is-open', mine);
      p.setAttribute('aria-hidden', mine ? 'false' : 'true');
    });
    if (swap) { var cut = panels[prev]; setTimeout(function () { cut.classList.remove('is-cut'); }, 400); }
    var on = next > -1;
    gnb.classList.toggle('is-expanded', on);
    /* 닫는 동안에는 바가 열렸을 때의 「채운 모습」을 유지한다 (2026-09-09 사용자 지적 「번쩍인다」 · LAB v22).
       딤은 본문 위 검정 48% 인데 <body> 직속 fixed 라 바 뒤까지 덮는다(딤 45 · 바 50). 딤이 사라지는
       동안 바가 먼저 반투명 70% 로 돌아가면 그 검정이 30% 틈으로 비쳐 흰 바가 잠깐 회색이 된다.
       검정 바에서는 검정에 검정이라 안 보인다 — 사용자가 「흰색일 때만」이라고 짚은 것이 이 때문이다.
       유지 시간은 css/gnb-site.css 의 --lnb-dim-out 하나에서 읽는다 (두 곳에 같은 숫자를 두지 않는다) */
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    if (on) gnb.classList.remove('is-closing');
    else {
      gnb.classList.add('is-closing');
      closeTimer = setTimeout(function () { gnb.classList.remove('is-closing'); closeTimer = null; }, dimOut());
    }
    if (dim)  dim.classList.toggle('is-on', on);
    if (back) back.style.height = on ? panels[next].offsetHeight + 'px' : '0px';   // 판은 display:block(안 보일 뿐)이라 잴 수 있다
    links.forEach(function (a) {
      var mine = a.getAttribute('data-lnb') === name;
      a.classList.toggle('is-open', mine);
      a.setAttribute('aria-expanded', String(mine));
    });
    openName = on ? name : null;
  }
  function open(name)  { if (!wide.matches || name === openName) return; paint(name); }
  function close()     { if (openName !== null) paint(null); }

  links.forEach(function (a) { a.setAttribute('aria-expanded', 'false'); });
  gnb.addEventListener('mouseover', function (e) {
    var a = e.target.closest('[data-lnb]');
    if (a) return open(a.getAttribute('data-lnb'));
    if (e.target.closest('.gnb__menu a')) close();           // 판 없는 메뉴(고객사·미디어)로 가면 접는다
  });
  gnb.addEventListener('mouseleave', close);
  gnb.addEventListener('focusin', function (e) {
    var a = e.target.closest('.gnb__menu a');
    if (a) { var n = a.getAttribute('data-lnb'); if (n) open(n); else close(); }
  });
  gnb.addEventListener('focusout', function (e) { if (!gnb.contains(e.relatedTarget)) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  if (dim) dim.addEventListener('click', close);
  if (wide.addEventListener) wide.addEventListener('change', function () { if (!wide.matches) close(); });

  /* 항목에 올리면 판 그림이 살짝 커진다 — 그림은 판마다 한 장(v15) */
  panels.forEach(function (p) {
    var img = p.querySelector('.gnb__lnb-img'), list = p.querySelector('.gnb__lnb-list');
    if (!img || !list) return;
    list.addEventListener('mouseover', function (e) { if (e.target.closest('a')) img.classList.add('is-zoom'); });
    list.addEventListener('mouseleave', function () { img.classList.remove('is-zoom'); });
  });

  paintBar();
})();
