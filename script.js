/* ===============================
   TEAM S R VIP — PREMIUM SCRIPT
   READY TO RUN
================================ */

// ===== CONFIG =====
const PASSWORD = "VIPSHAHED";
const API_URL = "https://draw.ar-lottery01.com/WinGo/WinGo_1M.json";
const OWNER_TG = "@shahedbintarek";
const REF_LINK = "https://www.dkwin.xyz/#/register?invitationCode=16532572738";

const ROUND_DELAY = 65 * 1000;
const WIN_CAP_COUNT = 8;
const WIN_CAP_WINDOW_SEC = 2 * 3600;
const LOSS_STREAK_LIMIT = 7;

// ===== UI =====
const pwModal = document.getElementById("pw-modal");
const pwInput = document.getElementById("pw-input");
const pwSubmit = document.getElementById("pw-submit");
const launchBtn = document.getElementById("launch");
const periodEl = document.getElementById("period");
const cdEl = document.getElementById("countdown");
const resultEl = document.getElementById("result");
const resultMeta = document.getElementById("result-meta");
const logEl = document.getElementById("log");
const voiceToggle = document.getElementById("voice-toggle");
const voiceGender = document.getElementById("voice-gender");
const histBtn = document.getElementById("history-btn");
const histModal = document.getElementById("hist-modal");
const histList = document.getElementById("hist-list");
const histClose = document.getElementById("hist-close");

// ===== STATE =====
let unlocked = false;
let currentPeriod = null;
let cdTimer = null;
let enableVoice = true;

// ===== VIP MODE =====
document.documentElement.classList.add("vip-mode");

// ===== USER ID =====
if (!localStorage.getItem("sr_user_id")) {
  localStorage.setItem(
    "sr_user_id",
    "vip-" + Date.now() + "-" + Math.floor(Math.random() * 9999)
  );
}

// ===== HELPERS =====
function log(txt) {
  const t = new Date().toLocaleTimeString();
  logEl.innerHTML = `<div>[${t}] ${txt}</div>` + logEl.innerHTML;
}

function speak(text, gender = "female") {
  if (!enableVoice || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();
  let v =
    gender === "male"
      ? voices.find(x => /male|david|mark/i.test(x.name))
      : voices.find(x => /female|zira|susan/i.test(x.name));
  if (!v) v = voices[0];
  if (v) u.voice = v;
  u.rate = 0.95;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

// ===== HISTORY =====
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem("sr_history") || "{}");
  } catch {
    return {};
  }
}
function setHistory(h) {
  localStorage.setItem("sr_history", JSON.stringify(h));
}

// ===== PASSWORD =====
pwSubmit.onclick = () => {
  if (pwInput.value === PASSWORD) {
    unlocked = true;
    pwModal.style.display = "none";
    speak("Access granted. Welcome to Team S R VIP premium panel.", "male");
    log("VIP Access Granted");
    startLoop();
  } else {
    alert("Invalid password. Contact admin.");
    speak("Invalid password. Please contact admin for VIP access.", "female");
  }
};

// ===== VOICE TOGGLE =====
voiceToggle.onclick = () => {
  enableVoice = !enableVoice;
  voiceToggle.textContent = enableVoice ? "Voice: ON" : "Voice: OFF";
};

// ===== SIGNAL LOGIC =====
function pickSignal(issue) {
  let seed = 0;
  for (let c of issue) seed = (seed * 31 + c.charCodeAt(0)) % 100000;
  const num = (seed * 9301 + 49297) % 233280;
  const n = Math.abs(num) % 10;
  return { number: n, bet: n % 2 === 0 ? "BIG" : "SMALL" };
}

async function fetchIssue() {
  try {
    const r = await fetch(API_URL, { cache: "no-store" });
    const j = await r.json();
    const cur = j.current || j.data?.slice(-1)[0];
    return String(cur.issueNumber || cur.issue);
  } catch {
    return null;
  }
}

// ===== LAUNCH =====
launchBtn.onclick = async () => {
  if (!unlocked) return alert("Unlock VIP first");
  if (!currentPeriod) return alert("Period not ready");

  const hist = getHistory();
  if (hist[currentPeriod]) return alert("Already taken for this period");

  const pred = pickSignal(currentPeriod);
  hist[currentPeriod] = { pred, ts: Date.now() };
  setHistory(hist);

  resultEl.innerHTML = `<b>VIP SIGNAL</b><br>${pred.bet} — ${pred.number}`;
  resultMeta.innerHTML = `Period: ${currentPeriod}`;

  speak(
    `Team S R VIP signal. Period ${currentPeriod}. Bet ${pred.bet}. Number ${pred.number}.`,
    voiceGender.value
  );

  log(`Signal ${pred.bet} ${pred.number} | ${currentPeriod}`);
};

// ===== LOOP =====
async function startLoop() {
  currentPeriod = await fetchIssue();
  periodEl.textContent = currentPeriod;
  startCountdown(40);

  setInterval(async () => {
    const ni = await fetchIssue();
    if (ni && ni !== currentPeriod) {
      currentPeriod = ni;
      periodEl.textContent = ni;
      startCountdown(40);
      log("New Period " + ni);
    }
  }, 9000);
}

// ===== COUNTDOWN =====
function startCountdown(s) {
  clearInterval(cdTimer);
  let r = s;
  cdEl.textContent = `00:${String(r).padStart(2, "0")}`;
  cdTimer = setInterval(() => {
    r--;
    cdEl.textContent = `00:${String(Math.max(r, 0)).padStart(2, "0")}`;
    if (r <= 0) clearInterval(cdTimer);
  }, 1000);
}

// ===== ON LOAD =====
window.onload = () => {
  pwModal.style.display = "flex";
  speechSynthesis.getVoices();

  setTimeout(() => {
    speak(
      "Welcome to Wingo VIP Signal Web. I give three step signals. If you need password, connect admin. Team S R VIP.",
      "female"
    );
    log("VIP Welcome Voice Played");
  }, 1200);
};
