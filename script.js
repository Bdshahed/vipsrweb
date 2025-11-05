// script.js — signals, voice, password, duplicate protection, result check
// CONFIG (edit before deploy)
const PASSWORD = "VIPSHAHED"; // change to your chosen pass
const API_URL = "https://draw.ar-lottery01.com/WinGo/WinGo_1M.json";
const OWNER_TG = "@shahedbintarek";
const REF_LINK = "https://www.dkwin.xyz/#/register?invitationCode=16532572738";
const ROUND_DELAY = 65 * 1000; // 65 seconds for result check
const WIN_CAP_COUNT = 8;
const WIN_CAP_WINDOW_SEC = 2 * 3600; // 2 hours in seconds
const LOSS_STREAK_LIMIT = 7;

// UI refs
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

let unlocked = false;
let currentPeriod = null;
let cdTimer = null;
let enableVoice = false;

// create or get local user id (frontend only)
if (!localStorage.getItem("sr_user_id")) {
  localStorage.setItem("sr_user_id", "u" + Date.now() + "-" + Math.floor(Math.random() * 9999));
}
const USER_ID = localStorage.getItem("sr_user_id");

// history stored in localStorage under 'sr_history' as { period: {pred, ts, actual?, ok?} }
function getHistory() {
  try { return JSON.parse(localStorage.getItem("sr_history") || "{}"); } catch (e) { return {}; }
}
function setHistory(h) { try { localStorage.setItem("sr_history", JSON.stringify(h)); } catch (e) {} }
function appendLog(txt) {
  const time = new Date().toLocaleTimeString();
  logEl.innerHTML = `<div>[${time}] ${txt}</div>` + logEl.innerHTML;
}

// password handling
pwSubmit.addEventListener("click", () => {
  if (pwInput.value === PASSWORD) {
    unlocked = true;
    pwModal.style.display = "none";
    appendLog("Unlocked premium UI");
    startLoop();
  } else {
    alert("Invalid password. Connect admin for pass.");
  }
});

// voice controls
voiceToggle.addEventListener("click", () => {
  enableVoice = !enableVoice;
  voiceToggle.textContent = enableVoice ? "Voice: On" : "Voice: Off";
  appendLog("Voice " + (enableVoice ? "enabled" : "disabled"));
});

// history modal
histBtn.addEventListener("click", () => {
  const h = getHistory();
  histList.innerHTML = "";
  const keys = Object.keys(h).sort().reverse();
  if (keys.length === 0) histList.innerHTML = "<div class='small muted'>No history yet</div>";
  keys.forEach(k => {
    const e = h[k];
    histList.innerHTML += `<div><b>Period ${k}</b> → Pred: ${e.pred.bet} ${e.pred.number} | Ok:${e.ok === true ? "WIN" : (e.ok === false ? "LOSS" : "Pending")} ${e.actual ? "(A:"+e.actual+")":""}</div>`;
  });
  histModal.classList.remove("hidden");
  histModal.style.display = "flex";
});
histClose && histClose.addEventListener("click", () => {
  histModal.classList.add("hidden");
  histModal.style.display = "none";
});

// deterministic pick — same algorithm as bot.py
function pickSignalFor(issue) {
  let seed = 0;
  for (let i = 0; i < issue.length; i++) seed = (seed * 31 + issue.charCodeAt(i)) % 100000;
  let num = (seed * 9301 + 49297) % 233280;
  const number = Math.abs(num) % 10;
  const bet = (number % 2 === 0) ? "BIG" : "SMALL";
  return { number, bet };
}

// fetch issue from API
async function fetchIssue() {
  try {
    const r = await fetch(API_URL, { cache: "no-store" });
    if (!r.ok) throw new Error("network");
    const js = await r.json();
    const cur = js.current || js.data?.slice?.(-1)?.[0] || js.list?.slice?.(-1)?.[0];
    const issue = cur?.issueNumber ?? cur?.issue ?? null;
    return String(issue);
  } catch (e) {
    return null;
  }
}

// get actual result for issue (tries previous/result fields)
async function getResultForIssue(issue) {
  try {
    const r = await fetch(API_URL, { cache: "no-store" });
    if (!r.ok) return null;
    const js = await r.json();
    const prev = js.previous;
    if (prev && String(prev.issueNumber ?? prev.issue) === String(issue)) {
      const v = prev.winNumber ?? prev.result ?? prev.openCode ?? prev.number;
      if (v != null) return parseInt(String(v).slice(-1));
    }
    for (const k of ["list", "data", "history", "previousIssues"]) {
      const arr = js[k];
      if (Array.isArray(arr)) {
        for (const row of arr) {
          if (String(row.issueNumber ?? row.issue) === String(issue)) {
            const v = row.winNumber ?? row.result ?? row.openCode ?? row.number;
            if (v != null) return parseInt(String(v).slice(-1));
          }
        }
      }
    }
    return null;
  } catch (e) { return null; }
}

// voice announce
function speak(text, gender) {
  if (!enableVoice || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  let v = voices.find(x => /female|woman|zira|susan|alloy/i.test(x.name)) || voices[0];
  if (gender === "male") v = voices.find(x => /male|man|david|mark/i.test(x.name)) || v;
  if (v) u.voice = v;
  u.rate = 0.95;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

// protection & counts using local history
function userHasRequested(issue) {
  const h = getHistory();
  return !!h[issue];
}
function saveUserRequest(issue, pred) {
  const h = getHistory();
  h[issue] = { pred: pred, ts: Date.now(), actual: null, ok: null };
  setHistory(h);
}
function updateUserResult(issue, actual, ok) {
  const h = getHistory();
  if (!h[issue]) return;
  h[issue].actual = actual;
  h[issue].ok = ok;
  setHistory(h);
}
function countRecentWins(windowSec = WIN_CAP_WINDOW_SEC) {
  const h = getHistory();
  const now = Date.now();
  let wins = 0;
  for (const k in h) {
    const e = h[k];
    if (e.ok === true && (now - (e.ts || 0) <= windowSec * 1000)) wins++;
  }
  return wins;
}
function consecutiveLosses() {
  const h = getHistory();
  const keys = Object.keys(h).sort();
  let cnt = 0;
  for (let i = keys.length - 1; i >= 0; i--) {
    const e = h[keys[i]];
    if (e.ok === false) cnt++;
    else if (e.ok === true) break;
    else break; // pending => break streak
  }
  return cnt;
}

// main behavior when user clicks Launch
launchBtn.addEventListener("click", async () => {
  if (!unlocked) { alert("Unlock premium with password first."); return; }
  // ensure issue ready
  if (!currentPeriod) { alert("Period not ready. Try again."); return; }
  // duplicate protection
  if (userHasRequested(currentPeriod)) { alert("You already requested for this period. Wait next period."); return; }
  // win cap 2h
  const wins2h = countRecentWins(WIN_CAP_WINDOW_SEC);
  if (wins2h >= WIN_CAP_COUNT) { alert("You already have 8 wins in last 2 hours. Signals paused for 2 hours."); return; }

  const pred = pickSignalFor(currentPeriod);
  saveUserRequest(currentPeriod, pred);
  resultEl.innerHTML = `<div><b>Signal:</b> ${pred.bet} — ${pred.number}</div>`;
  resultMeta.innerHTML = `<div class="small muted">Period: ${currentPeriod}</div>`;
  appendLog(`Requested signal ${pred.bet} ${pred.number} for period ${currentPeriod}`);

  const gender = voiceGender.value;
  const voiceText = `Team S R V I P signal for period ${currentPeriod}: ${pred.bet}, number ${pred.number}. Register with referral.`;
  speak(voiceText, gender);

  // schedule result check after ROUND_DELAY (65s)
  setTimeout(async () => {
    const actual = await getResultForIssue(currentPeriod);
    let ok = null;
    if (actual != null) ok = (actual === pred.number);
    updateUserResult(currentPeriod, actual, ok);
    if (ok === true) {
      resultEl.innerHTML += `<div class="small">✅ WIN — Actual: ${actual}</div>`;
      speak("Win! Congratulations!", "male");
      appendLog(`WIN for period ${currentPeriod}`);
    } else if (ok === false) {
      resultEl.innerHTML += `<div class="small">❌ LOSS — Actual: ${actual}</div>`;
      speak("Sorry, it was a loss.", "female");
      appendLog(`LOSS for period ${currentPeriod}`);
    } else {
      resultEl.innerHTML += `<div class="small">⏳ Result not available yet from API.</div>`;
      appendLog(`Result pending for period ${currentPeriod}`);
    }
    // check long loss streak
    const lostStreak = consecutiveLosses();
    if (lostStreak >= LOSS_STREAK_LIMIT) {
      resultEl.innerHTML += `<div class="small">⚠️ You have ${lostStreak} consecutive losses. Contact owner for recovery: ${OWNER_TG}</div>`;
      speak("Please contact the owner for recovery assistance.", "male");
      appendLog(`Loss streak ${lostStreak} reached — notify owner.`);
    }
  }, ROUND_DELAY);
});

// keep period & countdown updated
async function startLoop() {
  const issue = await fetchIssue();
  currentPeriod = issue || "LOCAL-" + Date.now();
  periodEl.textContent = currentPeriod;
  startCountdown(40); // start with 40s remaining to match your bot behavior
  // refresh every ~9 seconds; when a new issue appears, restart countdown 40s
  setInterval(async () => {
    const ni = await fetchIssue();
    if (ni && ni !== currentPeriod) {
      currentPeriod = ni;
      periodEl.textContent = currentPeriod;
      appendLog("New period: " + currentPeriod);
      startCountdown(40);
    }
  }, 9000);
}

function startCountdown(s) {
  clearInterval(cdTimer);
  let rem = s;
  updateCd(rem);
  cdTimer = setInterval(() => {
    rem--; if (rem < 0) rem = 0;
    updateCd(rem);
    if (rem === 0) clearInterval(cdTimer);
  }, 1000);
}
function updateCd(sec) {
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  cdEl.textContent = `${mm}:${ss}`;
}

// on load show modal
window.addEventListener("load", () => {
  pwModal.style.display = "flex";
  // ensure speech voices are loaded
  if (window.speechSynthesis && speechSynthesis.getVoices) {
    speechSynthesis.getVoices(); // prime voices
  }
});
