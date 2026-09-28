// ============================================================
// seven 的工作空间 · 唱片机播放器
//   - 进入页面不自动播放
//   - 点歌单里的歌才会播（用户主动触发）
//   - 播放时唱片旋转、唱臂落下；暂停时唱片停在当前角度
// ============================================================

(function () {
  "use strict";

  const list = document.getElementById("song-list");
  if (!list) return; // 不在唱片机页面，直接退出

  const items = Array.prototype.slice.call(list.querySelectorAll(".song-item"));
  if (items.length === 0) return;

  const disc = document.getElementById("tt-disc");
  const arm = document.getElementById("tt-arm");
  const elTitle = document.getElementById("tt-title");
  const elArtist = document.getElementById("tt-artist");
  const elAlbum = document.getElementById("tt-album");
  const elNote = document.getElementById("tt-note");
  const elHint = document.getElementById("tt-hint");
  const elStatusText = document.getElementById("tt-status-text");
  const elStatus = document.getElementById("tt-status");
  const btnPlay = document.getElementById("btn-play");
  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");
  const seek = document.getElementById("tt-seek");
  const vol = document.getElementById("tt-vol");
  const elCur = document.getElementById("tt-cur");
  const elDur = document.getElementById("tt-dur");
  const turntable = document.getElementById("turntable");

  // ---- 歌单数据（直接从 DOM 的 data-* 上读） ----
  const tracks = items.map(function (el) {
    return {
      el: el,
      audio: el.dataset.audio || "",
      title: el.dataset.title || "未命名",
      artist: el.dataset.artist || "",
      album: el.dataset.album || "",
      year: el.dataset.year || "",
      note: el.dataset.note || "",
      color: el.dataset.color || "#c2703d",
      cover: el.dataset.cover || "",
    };
  });

  const audio = new Audio();
  audio.preload = "metadata";
  audio.volume = 0.8;

  let current = -1;
  let playing = false;
  let seeking = false;
  let loadedTrack = -1; // 已加载音频的曲目索引（懒加载标记）

  // ---- 小工具 ----
  function fmtTime(s) {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m + ":" + String(sec).padStart(2, "0");
  }

  function initialOf(t) {
    const s = (t || "").trim();
    if (!s) return "♪";
    const c = s.charAt(0);
    return /[a-zA-Z]/.test(c) ? c.toUpperCase() : c;
  }

  function setStatus(text, kind) {
    if (elStatusText) elStatusText.textContent = text;
    if (elStatus) {
      elStatus.classList.remove("is-playing", "is-paused", "is-error");
      if (kind) elStatus.classList.add("is-" + kind);
    }
  }

  function setHint(text) {
    if (elHint) elHint.textContent = text || "";
  }

  // ---- 渲染 ----
  function selectTrack(i, autoplay) {
    if (i < 0) i = tracks.length - 1;
    if (i >= tracks.length) i = 0;
    current = i;
    const t = tracks[i];

    // 高亮
    items.forEach(function (el, idx) {
      el.classList.toggle("is-current", idx === i);
    });

    // 面板信息
    if (elTitle) elTitle.textContent = t.title;
    if (elArtist) elArtist.textContent = t.artist || "未知歌手";
    if (elAlbum) {
      const bits = [];
      if (t.album) bits.push(t.album);
      if (t.year) bits.push(t.year);
      elAlbum.textContent = bits.join(" · ");
    }
    if (elNote) elNote.textContent = t.note ? "“" + t.note + "”" : "";

    // 主题色跟着歌走
    if (turntable) turntable.style.setProperty("--tt-accent", t.color);
    const songList = document.getElementById("song-list");
    if (songList) songList.style.setProperty("--tt-accent", t.color);

    setHint("");
    // 注意：这里不加载音频 —— 只有点了播放（doPlay）才真正去加载，
    // 否则示例歌单（音频还没放）一进页面就会报"音频未就绪"。

    if (autoplay) {
      doPlay();
    } else {
      setStatus("已选曲 · 按播放键开始", "paused");
      if (elDur) elDur.textContent = "0:00";
      if (elCur) elCur.textContent = "0:00";
      if (seek) seek.value = 0;
    }
  }

  function doPlay() {
    if (current < 0) selectTrack(0, false);
    if (current < 0) return;
    // 音频懒加载：同曲目不重复加载
    if (loadedTrack !== current) {
      audio.src = tracks[current].audio;
      loadedTrack = current;
    }
    setHint("");
    const p = audio.play();
    if (p && typeof p.catch === "function") {
      p.catch(function () {
        playing = false;
        syncPlayUI();
        setStatus("音频未就绪", "error");
        setHint(
          "这首歌的音频没加载出来。把音频文件放进仓库的 music/ 目录，文件名和 _data/songs.yml 里的 audio 保持一致。"
        );
      });
    }
  }

  function doPause() {
    audio.pause();
  }

  function togglePlay() {
    if (current < 0) {
      selectTrack(0, true);
      return;
    }
    if (playing) doPause();
    else doPlay();
  }

  function syncPlayUI() {
    if (btnPlay) btnPlay.classList.toggle("is-playing", playing);
    if (disc) disc.classList.toggle("spinning", playing);
    if (arm) arm.classList.toggle("is-down", playing);
    if (turntable) turntable.classList.toggle("is-playing", playing);
    items.forEach(function (el, idx) {
      el.classList.toggle("is-playing", playing && idx === current);
    });

    if (playing) {
      setStatus("播放中", "playing");
    } else if (current >= 0) {
      setStatus("已暂停", "paused");
    } else {
      setStatus("待机 · 未选择曲目", "");
    }
  }

  // ---- 事件 ----
  items.forEach(function (el, i) {
    // 序号
    const idxEl = el.querySelector(".song-index");
    if (idxEl) idxEl.textContent = String(i + 1).padStart(2, "0");
    // 色块封面首字
    const fb = el.querySelector(".cover-fallback");
    if (fb && !fb.textContent) fb.textContent = initialOf(tracks[i].title);

    function activate() {
      if (i === current) togglePlay();
      else selectTrack(i, true);
    }
    el.addEventListener("click", activate);
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        activate();
      }
    });
  });

  if (btnPlay) btnPlay.addEventListener("click", togglePlay);
  if (btnPrev)
    btnPrev.addEventListener("click", function () {
      selectTrack(current - 1, true);
    });
  if (btnNext)
    btnNext.addEventListener("click", function () {
      selectTrack(current + 1, true);
    });

  audio.addEventListener("play", function () {
    playing = true;
    syncPlayUI();
  });
  audio.addEventListener("pause", function () {
    playing = false;
    syncPlayUI();
  });
  audio.addEventListener("ended", function () {
    selectTrack(current + 1, true);
  });
  audio.addEventListener("error", function () {
    playing = false;
    syncPlayUI();
    setStatus("音频未就绪", "error");
    setHint(
      "音频没能加载。确认 music/ 目录里有这个文件，且文件名与 _data/songs.yml 中的 audio 一致。"
    );
  });

  audio.addEventListener("loadedmetadata", function () {
    if (elDur) elDur.textContent = fmtTime(audio.duration);
  });

  audio.addEventListener("timeupdate", function () {
    if (seeking) return;
    if (elCur) elCur.textContent = fmtTime(audio.currentTime);
    if (seek && isFinite(audio.duration) && audio.duration > 0) {
      seek.value = String(Math.round((audio.currentTime / audio.duration) * 1000));
      seek.disabled = false;
    } else if (seek) {
      seek.disabled = true;
    }
  });

  if (seek) {
    seek.addEventListener("input", function () {
      seeking = true;
      if (isFinite(audio.duration) && audio.duration > 0) {
        const t = (Number(seek.value) / 1000) * audio.duration;
        if (elCur) elCur.textContent = fmtTime(t);
      }
    });
    seek.addEventListener("change", function () {
      if (isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = (Number(seek.value) / 1000) * audio.duration;
      }
      seeking = false;
    });
  }

  if (vol) {
    vol.addEventListener("input", function () {
      audio.volume = Number(vol.value) / 100;
    });
    audio.volume = Number(vol.value) / 100;
  }

  // ---- 初始：只选第一首用于展示，不播放 ----
  selectTrack(0, false);
  syncPlayUI();
  setStatus("待机 · 点歌单里的任意一首", "");
})();
