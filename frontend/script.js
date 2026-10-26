const BACKEND_URL = "http://127.0.0.1:8000/chat";

/* =========================================================
   ÇAĞLAR: her birinin kendi metinleri, yazma hızı ve persona'sı
   (persona'nın kendisi backend'de, "mode" alanı ile seçiliyor)
   ========================================================= */
const ERAS = [
  {
    id: "1985",
    year: 1985,
    userLabel: "KULLANICI> ",
    botLabel: "COMPU-BOT> ",
    pageTitle: "COMPU-BOT 85 :: TERMINAL",
    title: "COMPU-BOT 85",
    subtitle: "64K RAM SISTEM - DISKET SURUCU HAZIR",
    placeholder: "KOMUT GIR...",
    sendLabel: "GONDER",
    copyright: "(C) 1985 COMPU-BOT SYSTEMS. TUM HAKLARI SAKLIDIR.",
    greeting: "SISTEM HAZIR. BEN COMPU-BOT, 1985'TEN. SORULARINI YAZ, ISLEM YAPAYIM.",
    errorText: "HATA: HAT KOPTU",
    typing: { base: 60, jitter: true, pause: true },
  },
  {
    id: "1995",
    year: 1995,
    userLabel: "SEN: ",
    botLabel: "RETRO-BOT: ",
    pageTitle: "RETRO-BOT '95 Resmi Sayfasi!!!",
    title: "RETRO-BOT '95",
    subtitle: "%%% Zihni 1995'te Kalmis Yapay Zeka ile Sohbet Et! %%%",
    placeholder: "Mesajini buraya yaz...",
    sendLabel: "GONDER >>",
    copyright: "© 1995 RETRO-BOT Industries. Tum haklari saklidir.",
    greeting: "Selam! Ben RETRO-BOT, 1995'ten bir yapay zeka arkadasinim. Bana istedigini sor!",
    errorText: "Modem baglantisi koptu sanirim...",
    typing: { base: 45, jitter: true, pause: true },
  },
  {
    id: "2005",
    year: 2005,
    userLabel: "Sen says:",
    botLabel: "TURBO-BOT says:",
    pageTitle: "TURBO-BOT - Konuşma",
    title: "TURBO-BOT - Konuşma",
    subtitle: "msn'de online :) · nick: ~*TuRbO*~ ♥ · durum: müsait",
    placeholder: "Mesajını yaz...",
    sendLabel: "Gönder",
    copyright: "© 2005 TURBO-BOT · Windows XP için optimize edilmiştir",
    greeting: "heyy! ben TURBO-BOT :) msn'de online'im. nick'imi gördün mü? bir şey sor!",
    errorText: "Bağlantı kesildi :( tekrar dener misin?",
    typing: { base: 24, jitter: false, pause: false },
  },
  {
    id: "2030",
    year: 2030,
    userLabel: "Sen",
    botLabel: "NOVA-X",
    pageTitle: "NOVA-X 2030",
    title: "NOVA-X 2030",
    subtitle: "Geleceğin yapay zeka asistanı ile sohbet et",
    placeholder: "Bir şey sor…",
    sendLabel: "Gönder",
    copyright: "© 2030 NOVA-X Labs · Nöral bağlantı hazır",
    greeting: "Merhaba, ben NOVA-X. 2030'dan sana yardım etmeye hazırım. Ne öğrenmek istersin?",
    errorText: "Bağlantı kesildi…",
    typing: { base: 11, jitter: false, pause: false },
  },
  {
    id: "2100",
    year: 2100,
    userLabel: "KOLONİST",
    botLabel: "AURORA-7",
    pageTitle: "AURORA-7 · Ceres Habitat",
    title: "AURORA-7",
    subtitle: "CERES HABİTAT HALKASI · KOLONİ YAPAY ZEKASI",
    placeholder: "Aurora'ya bir soru ilet…",
    sendLabel: "İlet",
    copyright: "Ceres Habitat Birliği · Yıl 2100 · Sinyal: kararlı",
    greeting: "Hoş geldin, kolonist. Ben AURORA-7, Ceres Habitat Halkası'nın yapay zekasıyım. Yıl 2100; ne öğrenmek istersin?",
    errorText: "Sinyal kaybı — kolonilerarası bağlantı koptu…",
    typing: { base: 8, jitter: false, pause: false },
  },
];

/* =========================================================
   ELEMANLAR VE DURUM
   ========================================================= */
const $ = (id) => document.getElementById(id);

const chatForm = $("chat-form");
const messageInput = $("message-input");
const sendButton = $("send-button");
const chatLog = $("chat-log");
const visitorCounter = $("visitor-counter");
const titleEl = $("title");
const subtitleEl = $("subtitle");
const copyrightEl = $("copyright");
const soundToggle = $("sound-toggle");
const splash = $("splash");
const loader = $("loader");
const progressFill = $("progress-fill");
const loaderStatus = $("loader-status");
const staticCanvas = $("static-canvas");
const rail = $("tl-rail");

const INITIAL_INDEX = 1; // 1995 ile açılır

let currentIndex = INITIAL_INDEX;
let history = [];
let transitioning = true; // açılış bitene kadar kilitli
let typingToken = 0; // eski yazma animasyonlarını iptal etmek için
let stopWaitSound = () => {};

const currentEra = () => ERAS[currentIndex];

/* =========================================================
   SESLER (Web Audio ile üretiliyor, ses dosyası gerekmiyor)
   ========================================================= */
const sounds = (() => {
  let ctx = null;
  let on = true;
  let noiseBuffer = null;

  function getCtx() {
    if (!on) return null;
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    } catch (e) {
      return null;
    }
  }

  function master(c, volume) {
    const g = c.createGain();
    g.gain.value = volume;
    g.connect(c.destination);
    return g;
  }

  function stopper(c, g) {
    let done = false;
    return () => {
      if (done) return;
      done = true;
      try {
        const t = c.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0, t + 0.12);
      } catch (e) {}
    };
  }

  function tone(c, out, { type = "sine", f0, f1 = f0, t = 0, d = 0.2, v = 0.15 }) {
    const start = c.currentTime + t;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, start);
    if (f1 !== f0) osc.frequency.linearRampToValueAtTime(f1, start + d);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(v, start + Math.min(0.015, d / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, start + d);
    osc.connect(g);
    g.connect(out);
    osc.start(start);
    osc.stop(start + d + 0.05);
  }

  function noise(c, out, { t = 0, d = 0.3, v = 0.1, type = "bandpass", f = 1000, f1 = f, q = 1 }) {
    if (!noiseBuffer) {
      noiseBuffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const start = c.currentTime + t;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(f, start);
    if (f1 !== f) filter.frequency.linearRampToValueAtTime(f1, start + d);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(v, start + Math.min(0.03, d / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, start + d);
    src.connect(filter);
    filter.connect(g);
    g.connect(out);
    src.start(start);
    src.stop(start + d + 0.05);
  }

  // 1995: arama sesi + el sıkışma cızırtısı (~4.7 sn)
  function modem() {
    const c = getCtx();
    if (!c) return () => {};
    const out = master(c, 0.5);
    const low = [941, 697, 697, 697, 770, 770, 770, 852, 852, 852];
    const high = [1336, 1209, 1336, 1477, 1209, 1336, 1477, 1209, 1336, 1477];
    let t = 0.05;
    [0, 8, 5, 0, 1, 9, 9, 5].forEach((digit) => {
      tone(c, out, { f0: low[digit], t, d: 0.09, v: 0.1 });
      tone(c, out, { f0: high[digit], t, d: 0.09, v: 0.1 });
      t += 0.15;
    });
    tone(c, out, { f0: 2100, t: 1.5, d: 0.7, v: 0.14 });
    const freqs = [980, 1180, 1650, 1800, 2100, 2400];
    for (let k = 0; k < 16; k++) {
      const f = freqs[Math.floor(Math.random() * freqs.length)];
      const ft = freqs[Math.floor(Math.random() * freqs.length)];
      tone(c, out, { type: k % 2 ? "square" : "sawtooth", f0: f, f1: ft, t: 2.3 + k * 0.12, d: 0.12, v: 0.07 });
      noise(c, out, { t: 2.3 + k * 0.12, d: 0.12, v: 0.05, f: 1500 + Math.random() * 1500, q: 2 });
    }
    noise(c, out, { t: 4.2, d: 0.5, v: 0.05, type: "lowpass", f: 3000 });
    return stopper(c, out);
  }

  function whoosh(volume = 0.12) {
    const c = getCtx();
    if (!c) return;
    const out = master(c, 1);
    noise(c, out, { d: 0.7, v: volume, f: 300, f1: 2800, q: 0.8 });
    tone(c, out, { f0: 200, f1: 620, d: 0.6, v: volume / 3 });
  }

  function blipLoop() {
    const c = getCtx();
    if (!c) return () => {};
    const out = master(c, 1);
    let flip = false;
    const play = () => {
      tone(c, out, { type: "square", f0: flip ? 880 : 660, d: 0.06, v: 0.05 });
      flip = !flip;
    };
    play();
    const id = setInterval(play, 280);
    return () => clearInterval(id);
  }

  function chime() {
    const c = getCtx();
    if (!c) return;
    const out = master(c, 1);
    tone(c, out, { f0: 1318, d: 0.35, v: 0.12 });
    tone(c, out, { f0: 1760, t: 0.12, d: 0.5, v: 0.1 });
    tone(c, out, { type: "triangle", f0: 2637, t: 0.12, d: 0.3, v: 0.03 });
  }

  function pop() {
    const c = getCtx();
    if (!c) return;
    tone(c, master(c, 1), { f0: 700, f1: 350, d: 0.08, v: 0.1 });
  }

  function spaceSend() {
    const c = getCtx();
    if (!c) return;
    const out = master(c, 1);
    tone(c, out, { f0: 70, f1: 180, d: 1.0, v: 0.1 });
    tone(c, out, { type: "triangle", f0: 900, f1: 1400, t: 0.1, d: 0.5, v: 0.03 });
  }

  function ping() {
    const c = getCtx();
    if (!c) return;
    const out = master(c, 1);
    tone(c, out, { f0: 1568, d: 0.6, v: 0.08 });
    tone(c, out, { f0: 2093, t: 0.15, d: 0.7, v: 0.06 });
  }

  function glitch() {
    const c = getCtx();
    if (!c) return;
    const out = master(c, 1);
    noise(c, out, { d: 0.75, v: 0.18, type: "highpass", f: 800 });
    tone(c, out, { type: "sawtooth", f0: 120, f1: 40, d: 0.7, v: 0.06 });
  }

  return {
    setOn(value) {
      on = value;
      if (on) getCtx(); // kullanıcı tıklamasıyla ses motorunu uyandır
    },
    isOn: () => on,
    modem,
    glitch,
    send(id) {
      if (id === "2005") pop();
      else if (id === "2030") whoosh();
      else if (id === "2100") spaceSend();
    },
    wait(id) {
      if (id === "1995") return modem();
      if (id === "1985") return blipLoop();
      return () => {};
    },
    reply(id) {
      if (id === "1985") {
        const c = getCtx();
        if (c) {
          const out = master(c, 1);
          tone(c, out, { type: "square", f0: 880, d: 0.07, v: 0.05 });
          tone(c, out, { type: "square", f0: 1320, t: 0.1, d: 0.1, v: 0.05 });
        }
      } else if (id === "2005") chime();
      else if (id === "2030") whoosh(0.06);
      else if (id === "2100") ping();
    },
  };
})();

/* =========================================================
   SOHBET SATIRLARI VE DAKTİLO EFEKTİ
   ========================================================= */
function addLine(role, text) {
  const era = currentEra();
  const line = document.createElement("div");
  line.className = `line ${role}`;

  const who = document.createElement("span");
  who.className = "who";
  who.textContent = role === "user" ? era.userLabel : era.botLabel;

  const body = document.createElement("span");
  body.className = "text";
  body.textContent = text;

  line.appendChild(who);
  line.appendChild(body);
  chatLog.appendChild(line);
  chatLog.scrollTop = chatLog.scrollHeight;
  return { line, body };
}

// Cevabı harf harf yazar. Retro çağlarda yavaş ve "titrek", modern çağlarda akıcı.
function addBotLineTyped(text) {
  const era = currentEra();
  const token = ++typingToken;
  const { line, body } = addLine("bot", "");
  body.textContent = "";
  line.classList.add("typing");

  return new Promise((resolve) => {
    const t = era.typing;
    const chars = Array.from(text);
    const total = chars.length * t.base;
    const scale = total > 8000 ? 8000 / total : 1; // uzun cevaplar çok sürmesin
    let i = 0;

    function step() {
      if (token !== typingToken) return resolve(false);
      if (i >= chars.length) {
        line.classList.remove("typing");
        return resolve(true);
      }
      body.textContent += chars[i];
      i += 1;
      chatLog.scrollTop = chatLog.scrollHeight;

      let delay = t.base;
      if (t.jitter) delay *= 0.4 + Math.random() * 1.8;
      if (t.pause && Math.random() < 0.05) delay += 150;
      setTimeout(step, delay * scale);
    }
    step();
  });
}

/* =========================================================
   ÇAĞ DEĞİŞTİRME (arayüz, geçiş efekti, yükleme ekranı)
   ========================================================= */
function applyEra(index) {
  currentIndex = index;
  const era = ERAS[index];

  document.body.className = `era-${era.id}`;
  document.title = era.pageTitle;
  titleEl.textContent = era.title;
  subtitleEl.textContent = era.subtitle;
  messageInput.placeholder = era.placeholder;
  sendButton.textContent = era.sendLabel;
  copyrightEl.textContent = era.copyright;

  // Yeni persona = yeni sohbet (eski çağın geçmişi karışmasın)
  history = [];
  chatLog.innerHTML = "";
  syncKnob();
}

// TV parazit / glitch geçişi: ekran bozulurken ortada çağ değişir
let staticRaf = null;

function startStatic() {
  const w = staticCanvas.width;
  const h = staticCanvas.height;
  const sctx = staticCanvas.getContext("2d");
  const img = sctx.createImageData(w, h);
  staticCanvas.hidden = false;

  const draw = () => {
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    sctx.putImageData(img, 0, 0);
    if (Math.random() < 0.6) {
      sctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.4})`;
      sctx.fillRect(0, Math.random() * h, w, 2 + Math.random() * 8);
    }
    staticRaf = requestAnimationFrame(draw);
  };
  draw();
}

function stopStatic() {
  if (staticRaf) cancelAnimationFrame(staticRaf);
  staticRaf = null;
  staticCanvas.hidden = true;
}

function runGlitch(midCallback) {
  return new Promise((resolve) => {
    document.body.classList.add("glitching");
    startStatic();
    sounds.glitch();
    setTimeout(midCallback, 380);
    setTimeout(() => {
      document.body.classList.remove("glitching");
      stopStatic();
      resolve();
    }, 760);
  });
}

// Sahte "Netscape'te açılıyor" yükleme çubuğu (+ istersek modem sesi)
function showLoader(durationMs, withSound) {
  return new Promise((resolve) => {
    const stopModem = withSound ? sounds.modem() : () => {};
    const stages = [
      [0, "Ana bilgisayar aranıyor..."],
      [0.2, "www.retro-bot95.com bulundu. Bağlanılıyor..."],
      [0.45, "Bağlantı kuruldu. Cevap bekleniyor..."],
      [0.7, "Belge yükleniyor..."],
      [0.92, "Belge alındı. Sayfa çiziliyor..."],
    ];
    const start = performance.now();
    loader.hidden = false;

    const tick = () => {
      const p = Math.min(1, (performance.now() - start) / durationMs);
      progressFill.style.width = `${Math.round(p * 100)}%`;
      let status = stages[0][1];
      stages.forEach(([threshold, text]) => {
        if (p >= threshold) status = text;
      });
      loaderStatus.textContent = status;

      if (p < 1) {
        requestAnimationFrame(tick);
      } else {
        stopModem();
        setTimeout(() => {
          loader.hidden = true;
          resolve();
        }, 250);
      }
    };
    tick();
  });
}

async function greet() {
  await addBotLineTyped(currentEra().greeting);
}

async function switchEra(index) {
  if (transitioning || index === currentIndex) {
    syncKnob();
    return;
  }
  transitioning = true;
  typingToken += 1;
  stopWaitSound();
  messageInput.disabled = false;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    applyEra(index);
  } else {
    await runGlitch(() => applyEra(index));
  }

  if (ERAS[index].id === "1995") {
    await showLoader(2800, true);
  }

  transitioning = false;
  greet();
}

/* =========================================================
   ZAMAN ÇİZGİSİ (sürüklenebilir)
   ========================================================= */
const ticks = [];
let knob = null;

function buildTimeline() {
  ERAS.forEach((era, i) => {
    const tick = document.createElement("div");
    tick.className = "tl-tick";
    tick.style.left = `${(i / (ERAS.length - 1)) * 100}%`;

    const dot = document.createElement("span");
    dot.className = "tl-dot";
    const year = document.createElement("span");
    year.className = "tl-year";
    year.textContent = era.year;

    tick.appendChild(dot);
    tick.appendChild(year);
    rail.appendChild(tick);
    ticks.push(tick);
  });

  knob = document.createElement("div");
  knob.className = "tl-knob";
  knob.tabIndex = 0;
  knob.setAttribute("role", "slider");
  knob.setAttribute("aria-label", "Yıl");
  knob.setAttribute("aria-valuemin", "0");
  knob.setAttribute("aria-valuemax", String(ERAS.length - 1));
  rail.appendChild(knob);

  let dragging = false;
  const fractionOf = (e) => {
    const r = rail.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  };
  const indexOf = (f) => Math.round(f * (ERAS.length - 1));

  const preview = (f) => {
    knob.style.left = `${f * 100}%`;
    const idx = indexOf(f);
    ticks.forEach((t, i) => t.classList.toggle("preview", i === idx));
  };

  rail.addEventListener("pointerdown", (e) => {
    if (transitioning) return;
    dragging = true;
    rail.setPointerCapture(e.pointerId);
    knob.classList.add("dragging");
    preview(fractionOf(e));
  });

  rail.addEventListener("pointermove", (e) => {
    if (dragging) preview(fractionOf(e));
  });

  const release = (e) => {
    if (!dragging) return;
    dragging = false;
    knob.classList.remove("dragging");
    const idx = indexOf(fractionOf(e));
    ticks.forEach((t) => t.classList.remove("preview"));
    knob.style.left = `${(idx / (ERAS.length - 1)) * 100}%`; // en yakın çağa oturt
    switchEra(idx);
  };
  rail.addEventListener("pointerup", release);
  rail.addEventListener("pointercancel", release);

  knob.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      if (currentIndex > 0) switchEra(currentIndex - 1);
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      if (currentIndex < ERAS.length - 1) switchEra(currentIndex + 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      switchEra(0);
    } else if (e.key === "End") {
      e.preventDefault();
      switchEra(ERAS.length - 1);
    }
  });
}

function syncKnob() {
  if (!knob) return;
  knob.style.left = `${(currentIndex / (ERAS.length - 1)) * 100}%`;
  knob.setAttribute("aria-valuenow", String(currentIndex));
  knob.setAttribute("aria-valuetext", String(ERAS[currentIndex].year));
  ticks.forEach((t, i) => t.classList.toggle("active", i === currentIndex));
}

/* =========================================================
   SOHBET GÖNDERME
   ========================================================= */
chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (transitioning) return;

  const message = messageInput.value.trim();
  if (!message) return;

  const eraAtSend = currentEra();
  addLine("user", message);
  messageInput.value = "";
  messageInput.disabled = true;

  sounds.send(eraAtSend.id);
  const stopWait = sounds.wait(eraAtSend.id);
  stopWaitSound = stopWait;

  try {
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history, mode: eraAtSend.id }),
    });

    if (!response.ok) {
      let detail = "";
      try {
        const errorBody = await response.json();
        detail = errorBody.detail || "";
      } catch (e) {}
      throw new Error(`Sunucu hatasi: ${response.status} ${detail}`);
    }

    const data = await response.json();
    stopWait();

    // Cevap beklenirken çağ değiştiyse eski persona'nın cevabını gösterme.
    if (eraAtSend !== currentEra()) return;

    history.push({ role: "user", text: message });
    history.push({ role: "model", text: data.reply });
    sounds.reply(eraAtSend.id);
    await addBotLineTyped(data.reply);
  } catch (error) {
    stopWait();
    if (eraAtSend === currentEra()) {
      addLine("bot", `${eraAtSend.errorText} (${error.message})`);
    }
  } finally {
    stopWait();
    messageInput.disabled = false;
    if (!transitioning) messageInput.focus();
  }
});

/* =========================================================
   RETRO EKSTRALAR: ZİYARETÇİ SAYACI VE ZİYARETÇİ DEFTERİ
   ========================================================= */
function updateVisitorCounter() {
  let count = 133700;
  try {
    count = parseInt(localStorage.getItem("visitorCount") || "133700", 10) + 1;
    localStorage.setItem("visitorCount", String(count));
  } catch (e) {}
  visitorCounter.textContent = String(count).padStart(6, "0");
}

const GUESTBOOK_SEED = [
  { n: "xX_Kemal_Xx", m: "Super site!!! 10/10 begendim. Beni de ekleyin!!", d: "14.03.1996" },
  { n: "Cool_Ayse", m: "Modemim cok yavas ama degdi :)", d: "02.02.1996" },
  { n: "Webmaster", m: "Sayfa yapim asamasinda, yakinda daha fazlasi!", d: "01.01.1996" },
];

function loadGuestbook() {
  try {
    return JSON.parse(localStorage.getItem("guestbook") || "[]");
  } catch (e) {
    return [];
  }
}

function saveGuestbook(list) {
  try {
    localStorage.setItem("guestbook", JSON.stringify(list.slice(-50)));
  } catch (e) {}
}

function renderGuestbook() {
  const box = $("gb-entries");
  box.innerHTML = "";
  [...loadGuestbook().reverse(), ...GUESTBOOK_SEED].slice(0, 25).forEach((entry) => {
    const row = document.createElement("div");
    row.className = "gb-entry";

    const name = document.createElement("b");
    name.textContent = entry.n;
    const date = document.createElement("span");
    date.className = "gb-date";
    date.textContent = ` — ${entry.d}`;
    const msg = document.createElement("div");
    msg.textContent = entry.m;

    row.appendChild(name);
    row.appendChild(date);
    row.appendChild(msg);
    box.appendChild(row);
  });
}

$("gb-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("gb-name").value.trim().slice(0, 24);
  const msg = $("gb-message").value.trim().slice(0, 140);
  if (!name || !msg) return;

  const list = loadGuestbook();
  list.push({ n: name, m: msg, d: new Date().toLocaleDateString("tr-TR") });
  saveGuestbook(list);
  renderGuestbook();
  $("gb-form").reset();
});

/* =========================================================
   SES DÜĞMESİ VE AÇILIŞ AKIŞI
   ========================================================= */
function updateSoundButton() {
  soundToggle.textContent = sounds.isOn() ? "🔊" : "🔇";
}

soundToggle.addEventListener("click", () => {
  sounds.setOn(!sounds.isOn());
  updateSoundButton();
});

async function startFirstLoad(withSound) {
  sounds.setOn(withSound);
  updateSoundButton();
  splash.hidden = true;

  applyEra(INITIAL_INDEX);
  await showLoader(4600, withSound);
  transitioning = false;
  greet();
}

$("connect-sound").addEventListener("click", () => startFirstLoad(true));
$("connect-silent").addEventListener("click", () => startFirstLoad(false));

buildTimeline();
syncKnob();
updateVisitorCounter();
renderGuestbook();
applyEra(INITIAL_INDEX);
