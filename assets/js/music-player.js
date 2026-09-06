// ============================================================
// seven 的工作空间 · 自动背景音乐播放器
// 歌曲: Shaun Gibson - 《If I Stay》(英文版《夜空中最亮的星》)
// ============================================================

(function () {
  "use strict";

  // 获取当前脚本所在标签上配置的音频文件地址
  const currentScript = document.currentScript || (function () {
    const scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1];
  })();

  const audioSrc = currentScript?.getAttribute("data-audio-src") || "./assets/audio/if-i-stay.mp3";

  // 创建 Audio 实例
  const audio = new Audio(audioSrc);
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = 0.6; // 适中音量，体贴舒适

  let isUserPaused = sessionStorage.getItem("seven_music_paused") === "true";

  // 构建浮动播放器 DOM
  function createPlayerDOM() {
    const widget = document.createElement("div");
    widget.className = "music-player-widget";
    widget.setAttribute("aria-label", "背景音乐播放器");
    widget.innerHTML = `
      <div class="music-disc" id="music-disc" title="点击播放/暂停"></div>
      <div class="music-info" id="music-info" title="点击播放/暂停">
        <div class="music-title">
          <span>If I Stay</span>
          <span class="sound-bars" id="sound-bars">
            <span class="sound-bar"></span>
            <span class="sound-bar"></span>
            <span class="sound-bar"></span>
          </span>
        </div>
        <div class="music-artist">Shaun Gibson · 英文版《夜空中最亮的星》</div>
      </div>
      <button class="music-btn" id="music-toggle-btn" aria-label="播放/暂停" title="播放/暂停">
        <svg id="music-play-icon" viewBox="0 0 24 24"><polygon points="6,4 20,12 6,20"></polygon></svg>
        <svg id="music-pause-icon" viewBox="0 0 24 24" style="display:none;"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
      </button>
      <div class="music-hint" id="music-hint">🎵 点击页面任意处开启背景音乐</div>
    `;
    document.body.appendChild(widget);
    return widget;
  }

  function updateUI(isPlaying) {
    const disc = document.getElementById("music-disc");
    const bars = document.getElementById("sound-bars");
    const playIcon = document.getElementById("music-play-icon");
    const pauseIcon = document.getElementById("music-pause-icon");

    if (isPlaying) {
      disc?.classList.add("playing");
      bars?.classList.add("playing");
      if (playIcon) playIcon.style.display = "none";
      if (pauseIcon) pauseIcon.style.display = "block";
    } else {
      disc?.classList.remove("playing");
      bars?.classList.remove("playing");
      if (playIcon) playIcon.style.display = "block";
      if (pauseIcon) pauseIcon.style.display = "none";
    }
  }

  function showHint() {
    const hint = document.getElementById("music-hint");
    if (!hint) return;
    hint.classList.add("show");
    setTimeout(() => {
      hint.classList.remove("show");
    }, 4000);
  }

  function hideHint() {
    const hint = document.getElementById("music-hint");
    if (hint) hint.classList.remove("show");
  }

  // 尝试自动播放
  function attemptAutoplay() {
    if (isUserPaused) {
      updateUI(false);
      return;
    }

    const promise = audio.play();
    if (promise !== undefined) {
      promise
        .then(() => {
          // 浏览器允许直接自动播放
          updateUI(true);
        })
        .catch(() => {
          // 浏览器阻止了未经交互的自动播放（Chrome / Safari / Edge 默认策略）
          updateUI(false);
          showHint();

          // 监听首次任意交互（点击、滑动、按键、触摸），即刻无缝开播
          const startOnInteraction = () => {
            if (!isUserPaused) {
              audio.play().then(() => {
                updateUI(true);
                hideHint();
              }).catch(() => {});
            }
            ["click", "touchstart", "scroll", "keydown"].forEach((ev) => {
              window.removeEventListener(ev, startOnInteraction, true);
            });
          };

          ["click", "touchstart", "scroll", "keydown"].forEach((ev) => {
            window.addEventListener(ev, startOnInteraction, { once: true, capture: true });
          });
        });
    }
  }

  function togglePlay() {
    if (audio.paused) {
      isUserPaused = false;
      sessionStorage.removeItem("seven_music_paused");
      audio.play().then(() => updateUI(true)).catch(() => {});
      hideHint();
    } else {
      isUserPaused = true;
      sessionStorage.setItem("seven_music_paused", "true");
      audio.pause();
      updateUI(false);
    }
  }

  // 初始化绑定
  document.addEventListener("DOMContentLoaded", () => {
    createPlayerDOM();

    const disc = document.getElementById("music-disc");
    const info = document.getElementById("music-info");
    const btn = document.getElementById("music-toggle-btn");

    disc?.addEventListener("click", togglePlay);
    info?.addEventListener("click", togglePlay);
    btn?.addEventListener("click", togglePlay);

    attemptAutoplay();
  });
})();
