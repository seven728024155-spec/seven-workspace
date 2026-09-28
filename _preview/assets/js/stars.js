// ============================================================
// seven 的工作空间 · 星空背景（OpenAI 风）
// - 中心一团亮星（"星系团"）
// - 全屏稀疏散布的暗星
// - 缓慢闪烁 + 鼠标轻微视差
// ============================================================

(function () {
  "use strict";

  const canvas = document.getElementById("stars-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true });

  // ---------- 配置 ----------
  const CONFIG = {
    density: 1,                 // 像素密度倍率
    cluster: {
      cxRatio: 0.5,             // 中心 X（相对画布宽）
      cyRatio: 0.42,            // 中心 Y（相对画布高）
      rxRatio: 0.18,            // 椭圆水平半径
      ryRatio: 0.13,            // 椭圆垂直半径
      count: 320,               // 中心亮星数量
    },
    field: {
      count: 260,               // 背景星数量
    },
    twinkleSpeed: 0.0028,        // 闪烁频率
    parallaxStrength: 18,       // 鼠标视差强度（像素）
    bgFade: 0.0,                // 拖尾（0 = 不拖尾；>0 = 残影）
  };

  // ---------- 状态 ----------
  let W = 0, H = 0, DPR = 1;
  let clusterStars = [];
  let fieldStars = [];
  let mouseTarget = { x: 0, y: 0 };
  let mouseOffset = { x: 0, y: 0 };
  let time = 0;

  // ---------- 工具 ----------
  function rand(min, max) { return Math.random() * (max - min) + min; }

  // ---------- 初始化星星 ----------
  function makeClusterStar() {
    // 高斯分布聚拢在中心（中心最密集）
    const u = Math.random();
    const v = Math.random();
    const r = Math.sqrt(-2 * Math.log(u || 0.0001)) * 0.55;
    const a = v * Math.PI * 2;
    const cx = W * CONFIG.cluster.cxRatio;
    const cy = H * CONFIG.cluster.cyRatio;
    return {
      x: cx + Math.cos(a) * r * W * CONFIG.cluster.rxRatio,
      y: cy + Math.sin(a) * r * H * CONFIG.cluster.ryRatio,
      r: rand(0.3, 1.9),
      baseAlpha: rand(0.35, 1.0),
      twinklePhase: rand(0, Math.PI * 2),
      twinkleAmp: rand(0.15, 0.45),
      hue: rand(0, 1) < 0.15 ? "warm" : "cool",  // 少量偏暖色
    };
  }

  function makeFieldStar() {
    return {
      x: rand(0, W),
      y: rand(0, H),
      r: rand(0.2, 1.1),
      baseAlpha: rand(0.12, 0.5),
      twinklePhase: rand(0, Math.PI * 2),
      twinkleAmp: rand(0.1, 0.3),
      hue: "cool",
    };
  }

  function build() {
    clusterStars = new Array(CONFIG.cluster.count).fill(0).map(makeClusterStar);
    fieldStars   = new Array(CONFIG.field.count).fill(0).map(makeFieldStar);
  }

  // ---------- 适配尺寸 ----------
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2) * CONFIG.density;
    const rect = canvas.parentElement.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    canvas.width  = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width  = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    build();
  }

  // ---------- 鼠标视差 ----------
  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseTarget.x = -x * CONFIG.parallaxStrength;
    mouseTarget.y = -y * CONFIG.parallaxStrength;
  }

  // ---------- 渲染 ----------
  function drawStar(s, t, ox, oy) {
    const twinkle = 1 + Math.sin(t + s.twinklePhase) * s.twinkleAmp * 0.5;
    const alpha = Math.max(0, Math.min(1, s.baseAlpha * twinkle));
    const r = s.r * (0.9 + (twinkle - 0.5) * 0.25);

    // 亮星加柔光晕
    if (s.baseAlpha > 0.7) {
      const glow = ctx.createRadialGradient(
        s.x + ox, s.y + oy, 0,
        s.x + ox, s.y + oy, r * 6
      );
      const c = s.hue === "warm"
        ? `rgba(255, 230, 200, ${alpha * 0.25})`
        : `rgba(200, 220, 255, ${alpha * 0.20})`;
      glow.addColorStop(0, c);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(s.x + ox, s.y + oy, r * 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 星点本体
    ctx.beginPath();
    ctx.arc(s.x + ox, s.y + oy, r, 0, Math.PI * 2);
    ctx.fillStyle = s.hue === "warm"
      ? `rgba(255, 240, 220, ${alpha})`
      : `rgba(255, 255, 255, ${alpha})`;
    ctx.fill();
  }

  function render() {
    time += CONFIG.twinkleSpeed * 16;

    // 视差缓动
    mouseOffset.x += (mouseTarget.x - mouseOffset.x) * 0.04;
    mouseOffset.y += (mouseTarget.y - mouseOffset.y) * 0.04;

    // 可选拖尾效果（轻微残影让星点有运动感）
    if (CONFIG.bgFade > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${CONFIG.bgFade})`;
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.clearRect(0, 0, W, H);
    }

    // 背景星（视差移动多一些）
    fieldStars.forEach((s) => drawStar(s, time, mouseOffset.x * 1.2, mouseOffset.y * 1.2));

    // 中心团（视差移动少一些，制造层次）
    clusterStars.forEach((s) => drawStar(s, time * 1.3, mouseOffset.x * 0.5, mouseOffset.y * 0.5));

    requestAnimationFrame(render);
  }

  // ---------- 启动 ----------
  function init() {
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    // 触摸设备：忽略鼠标视差
    window.addEventListener("touchstart", () => {
      mouseTarget.x = 0; mouseTarget.y = 0;
    }, { once: true, passive: true });

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
