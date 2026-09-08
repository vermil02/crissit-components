/* ============================================================
   Board list / Main — 자동 전환 + Progress 동작
   정책 출처: 가이드 [Media_Web_Desktop] 기능 및 정책 정의서 §1

     · 대표 기사 최대 5건, 8초마다 다음 건으로 자동 전환 (Delay Second : 8s)
     · 남은 시간은 일시정지 버튼 테두리가 상단 중앙에서 시계방향으로
       **연속으로** 차오르며 표시된다 — 한 바퀴가 8초
     · 일시정지를 누르면 차오르던 테두리가 그 자리에서 멈춘다
     · 기사가 1건뿐이면 이전·다음 버튼을 노출하지 않는다

   차오르는 모양은 css/boardlist.css 의 `.bl-prog` 가 CSS 애니메이션으로
   그린다. 이 파일은 그 애니메이션을 **켜고·멈추고·다시 걸기**만 한다.
   시간을 세는 일도 여기서 한다 — 8초가 지나면 다음 장으로 넘긴다.

   ── 붙이는 법 ──────────────────────────────────────────────
   <div data-bl-rotator>
     <div class="bl-main" data-bl-slide>       …1번 기사 + 버튼 3개…  </div>
     <div class="bl-main" data-bl-slide hidden>…2번 기사 + 버튼 3개…  </div>
     …

   버튼은 **카드 안에** 둔다 — 피그마 컴포넌트가 그렇게 되어 있다
   (오른쪽 단 맨 아래에 이전·다음 / 우측 끝에 일시정지).
   장마다 반복되지만 클릭은 rotator 에서 위임으로 받으므로 어디 있어도 된다.
     <button data-bl-prev>   이전
     <button data-bl-next>   다음
     <button class="bl-prog" data-bl-toggle>  일시정지/재생
       └ 안에 <span class="bl-prog__ring"></span> 하나가 테두리를 그린다
       └ 안의 <i class="icon i-pause"> 는 상태에 따라 i-play 로 바뀐다

   ── 넘기는 방식을 직접 정하고 싶으면 ────────────────────────
   `data-bl-slide` 를 하나도 두지 않으면 이 스크립트는 화면을 건드리지
   않고 `bl:next` 이벤트만 rotator 에서 올린다. 그걸 받아 원하는 대로
   내용을 갈아 끼우면 된다.
     el.addEventListener('bl:next', e => { … e.detail.index … })

   ── 스스로 멈추는 경우 ─────────────────────────────────────
   · 화면 밖으로 나가면 멈춘다 (다시 들어오면 남은 시간부터 이어서 돈다)
   · 탭이 백그라운드로 가면 멈춘다
   · prefers-reduced-motion 이면 자동 전환을 아예 하지 않는다
     — 이전·다음 버튼으로만 넘긴다. 움직임에 민감한 사용자를 위한 것이고,
       정의서에 없는 판단이라 여기 적어 둔다.
   ============================================================ */
(function () {
  "use strict";

  var DEFAULT_INTERVAL = 8000; // ms — 정의서 Delay Second : 8s
  var MAX_SLIDES = 5;          // 정의서: 최대 5건

  var reduceMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : { matches: false };

  function Rotator(root) {
    this.root = root;
    this.interval = parseInt(root.getAttribute("data-interval"), 10) || DEFAULT_INTERVAL;
    this.slides = Array.prototype.slice.call(root.querySelectorAll("[data-bl-slide]"));

    this.index = 0;
    this.paused = false;    // 사용자가 일시정지를 눌렀는가
    this.visible = true;    // 화면 안에 있는가
    this.timer = null;
    this.remaining = this.interval; // 이번 장에 남은 시간(ms)
    this.startedAt = 0;

    if (this.slides.length > MAX_SLIDES) {
      // 정책 위반은 조용히 자르지 않고 알린다 — 기획 실수를 감추면 안 된다
      console.warn(
        "[bl-rotator] 대표 기사는 최대 " + MAX_SLIDES + "건입니다. 현재 " +
        this.slides.length + "건 — 정의서 §1 확인 필요."
      );
    }

    this.single = this.slides.length <= 1;
    if (this.single) {
      // 1건뿐이면 이전·다음을 감춘다 (정의서 🅓)
      root.classList.add("bl-main--single");
      var cards = root.querySelectorAll(".bl-main");
      for (var i = 0; i < cards.length; i++) cards[i].classList.add("bl-main--single");
    }

    // 한 바퀴 도는 시간을 CSS 에 알려 준다 (data-interval 을 그대로 따른다)
    root.style.setProperty("--bl-interval", this.interval + "ms");

    this.bind();
    this.renderSlides();
    this.restartRing();
    this.sync();
  }

  /* 지금 시계가 돌아야 하는 상태인가 */
  Rotator.prototype.shouldRun = function () {
    return !this.single && !this.paused && this.visible &&
           !document.hidden && !reduceMotion.matches;
  };

  Rotator.prototype.bind = function () {
    var self = this;

    /* 버튼이 장마다 반복되므로 개별로 붙이지 않고 rotator 에서 위임으로 받는다.
       장이 바뀌어도 다시 붙일 필요가 없다 */
    this.root.addEventListener("click", function (e) {
      var t = e.target.closest
        ? e.target.closest("[data-bl-prev],[data-bl-next],[data-bl-toggle]")
        : null;
      if (!t || !self.root.contains(t)) return;
      e.preventDefault();
      if (t.hasAttribute("data-bl-prev")) self.go(self.index - 1);
      else if (t.hasAttribute("data-bl-next")) self.go(self.index + 1);
      else { self.paused = !self.paused; self.sync(); }
    });

    // 화면 밖이면 센다고 배터리 쓸 이유가 없다
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        self.visible = entries[0].isIntersecting;
        self.sync();
      }, { threshold: 0.1 }).observe(this.root);
    }

    document.addEventListener("visibilitychange", function () { self.sync(); });

    // 사용자가 도중에 설정을 바꿀 수 있다
    if (reduceMotion.addEventListener) {
      reduceMotion.addEventListener("change", function () {
        self.remaining = self.interval;
        self.restartRing();
        self.sync();
      });
    }
  };

  /* 상태를 보고 시계와 테두리 애니메이션을 맞춘다.
     이 함수 하나만 호출하면 되도록 만들었다 — 켜고 끄는 경로가 여럿이라
     (일시정지·스크롤·탭 전환·설정 변경) 각자 타이머를 만지면 어긋난다 */
  Rotator.prototype.sync = function () {
    var run = this.shouldRun();

    if (run && !this.timer) {
      this.startedAt = Date.now();
      var self = this;
      this.timer = setTimeout(function () {
        self.timer = null;
        self.go(self.index + 1, true);
      }, this.remaining);
    } else if (!run && this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      // 멈춘 지점을 기억해 둔다 — 되감지 않는다
      this.remaining = Math.max(0, this.remaining - (Date.now() - this.startedAt));
    }

    this.renderButtons(run);
  };

  /* 테두리 애니메이션을 처음부터 다시 건다.
     클래스를 뗐다 붙이는 것만으로는 브라우저가 같은 프레임에서 묶어 처리해
     다시 시작되지 않는다. 그래서 중간에 강제로 레이아웃을 한 번 읽는다
     (`offsetWidth` 를 읽는 순간 브라우저가 밀린 변경을 반영한다) */
  Rotator.prototype.restartRing = function () {
    var rings = this.root.querySelectorAll(".bl-prog__ring");
    for (var i = 0; i < rings.length; i++) {
      rings[i].style.animation = "none";
      void rings[i].offsetWidth;
      rings[i].style.animation = "";
    }
  };

  /* 장 넘기기. auto 가 true 면 자동 전환으로 넘어온 것 */
  Rotator.prototype.go = function (next, auto) {
    var n = this.slides.length || 1;
    this.index = ((next % n) + n) % n;

    // 새 장이니 시계도 테두리도 처음부터
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.remaining = this.interval;

    this.renderSlides();
    this.restartRing();
    this.sync();

    this.root.dispatchEvent(new CustomEvent("bl:next", {
      bubbles: true,
      detail: { index: this.index, auto: !!auto }
    }));
  };

  Rotator.prototype.renderSlides = function () {
    for (var i = 0; i < this.slides.length; i++) {
      this.slides[i].hidden = (i !== this.index);
    }
  };

  /* 일시정지 버튼은 장마다 있으므로 전부 같은 상태로 맞춘다.
     아이콘도 여기서 바꾼다 — 돌고 있으면 「멈춤(‖)」, 멈춰 있으면 「재생(▶)」.
     버튼이 하는 일을 보여주는 것이지 지금 상태를 보여주는 것이 아니다 */
  Rotator.prototype.renderButtons = function (run) {
    var toggles = this.root.querySelectorAll("[data-bl-toggle]");
    for (var j = 0; j < toggles.length; j++) {
      var t = toggles[j];
      // is-running = 애니메이션을 건다 / is-clock-paused = 그 자리에 세운다
      t.classList.toggle("is-running", !this.single && !reduceMotion.matches);
      t.classList.toggle("is-clock-paused", !run);
      t.setAttribute("aria-pressed", this.paused ? "true" : "false");
      t.setAttribute("aria-label", this.paused ? "자동 전환 재생" : "자동 전환 일시정지");

      var ico = t.querySelector(".icon");
      if (ico) {
        ico.classList.toggle("i-pause", !this.paused);
        ico.classList.toggle("i-play", this.paused);
      }
    }
  };

  function init(scope) {
    var roots = (scope || document).querySelectorAll("[data-bl-rotator]");
    for (var i = 0; i < roots.length; i++) {
      if (!roots[i].__blRotator) roots[i].__blRotator = new Rotator(roots[i]);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { init(); });
  } else {
    init();
  }

  // 나중에 붙는 마크업도 초기화할 수 있게 열어 둔다
  window.blRotatorInit = init;
})();
