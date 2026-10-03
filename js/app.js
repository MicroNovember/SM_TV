// ============== CONFIG ==============
const API_EVENTS   = "https://atmflix.live/api/events";
const API_VOLLEY   = "https://atmflix.live/api/volleyball/fixtures";
const API_FOOTBALL = "https://atmflix.live/api/fixtures/date";

const THUMB_BASE       = "https://atmflix.live/stream/thumbs/";
const EVENT_URL_BASE   = "https://atmflix.live/events/";
const VOLLEY_URL_BASE  = "https://atmflix.live/volleyball/";
const FOOTBALL_URL_BASE= "https://atmflix.live/football/";
const REFERER          = "https://atmflix.live";
const LOGO_URL         = "https://play-lh.googleusercontent.com/dd1xzBKPa191wv_h3zmr1Np_NqctjGFKYUqxv8tLasOLDc2RMSsGdMo4hrLhYrhcWIhKVYHpfAbBpoq16SjEl10";
const JSON_FILE        = "atmflix_all_live.w3u";
// ====================================

const state = {
  events: [],
  volleyball: [],
  footballGroups: [],
  tab: "all",
  search: ""
};

const $content = document.getElementById("content");
const $status  = document.getElementById("status");
const $search  = document.getElementById("search");
const $dlBtn   = document.getElementById("downloadBtn");
const $reload  = document.getElementById("reloadBtn");
const $dt      = document.getElementById("datetime");

// ============== UTILS ==============
function updateDateTime() {
  const now = new Date();
  const d  = String(now.getDate()).padStart(2, "0");
  const m  = String(now.getMonth() + 1).padStart(2, "0");
  const y  = now.getFullYear() + 543; // พ.ศ. แบบไทย
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  $dt.textContent = `[${d}/${m}/${y}] | [${hh}:${mm}:${ss}]`;
}

function getThaiDateTime() {
  const now = new Date();
  const d  = String(now.getDate()).padStart(2, "0");
  const m  = String(now.getMonth() + 1).padStart(2, "0");
  const y  = now.getFullYear() + 543;
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `[${d}/${m}/${y}] | [${hh}:${mm}]`;
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// ============== PARSERS (ตาม cloudfare.txt) ==============

// 📺 Events
function parseEventsData(data) {
  if (!Array.isArray(data)) return [];
  return data.map(ev => {
    const channel = ev.channel;
    const channelName = ev.channel_info?.name || channel;
    const eventId = ev.id;
    return {
      id: eventId,
      name: ev.title || channelName,
      info: ev.start || "",
      image: `${THUMB_BASE}${channel}.jpg`,
      url: `${EVENT_URL_BASE}${eventId}`,
      referer: REFERER,
      channel_code: channel
    };
  });
}

// 🏐 Volleyball
function parseVolleyballData(data) {
  if (!Array.isArray(data)) return [];
  const active = data.filter(item =>
    item.status_short !== "FT" && item.status_long !== "Finished"
  );
  return active.map(item => {
    const channel = item.channel || "vbtv";
    const matchId = item.id;
    const home = item.teamhome?.name_th || item.teamhome?.name || "Home";
    const away = item.teamaway?.name_th || item.teamaway?.name || "Away";
    return {
      id: matchId,
      name: `${home} vs ${away}`,
      info: item.event_time || "",
      image: `${THUMB_BASE}${channel}.jpg`,
      url: `${VOLLEY_URL_BASE}${matchId}`,
      referer: REFERER,
      channel_code: channel
    };
  });
}

// ⚽ Football (จัดกลุ่มตามลีก)
function parseFootballData(data) {
  if (!data || typeof data !== "object") return [];

  let items = [];
  if (Array.isArray(data)) items = data;
  else if (Array.isArray(data.data)) items = data.data;
  else items = Object.values(data).flat();

  if (!Array.isArray(items) || items.length === 0) return [];

  const active = items.filter(item => {
    if (!item) return false;
    const statusShort = String(item.status_short || "").toUpperCase();
    const statusLong  = String(item.status_long || "").toLowerCase();
    const isFinished  = statusShort === "FT" || statusLong.includes("finished");
    const hasChannel  = Boolean(
      item.channel && String(item.channel).trim() !== "" && item.channel !== "null"
    );
    return !isFinished && hasChannel;
  });

  const groupedLeagues = {};
  active.forEach(item => {
    const leagueName = item.league_info?.name_th || item.league_info?.name || "Football Live";
    const leagueLogo = item.league_info?.logo || LOGO_URL;
    const channel    = item.channel;
    const matchId    = item.id;
    const homeName   = item.teamhome?.name_th || item.teamhome?.name || "Home";
    const awayName   = item.teamaway?.name_th || item.teamaway?.name || "Away";

    let eventTime = "";
    if (item.event_time) {
      const m = item.event_time.match(/\d{2}:\d{2}/);
      eventTime = m ? m[0] : item.event_time;
    }

    const station = {
      id: matchId,
      name: `${homeName} vs ${awayName}`,
      info: `${eventTime} | ${leagueName}`.trim(),
      image: `${THUMB_BASE}${channel}.jpg`,
      url: `${FOOTBALL_URL_BASE}${matchId}`,
      referer: REFERER,
      channel_code: channel,
      time: eventTime,
      status: item.status_short || ""
    };

    if (!groupedLeagues[leagueName]) {
      groupedLeagues[leagueName] = {
        name: leagueName,
        image: leagueLogo,
        stations: []
      };
    }
    groupedLeagues[leagueName].stations.push(station);
  });

  const subGroups = Object.values(groupedLeagues);
  if (subGroups.length === 0) return [];
  return [{
    name: "⚽ Football Live",
    image: LOGO_URL,
    groups: subGroups
  }];
}

// ============== FETCH ==============
async function fetchJSON(url) {
  try {
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json, text/plain, */*",
        "Referer": REFERER
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`⚠️ ${url}:`, err.message);
    return null;
  }
}

async function loadAll() {
  $content.innerHTML = `<div class="loader"><div class="spinner"></div>กำลังดึงข้อมูล...</div>`;
  $status.textContent = "🌐 กำลังเชื่อมต่อ API...";
  $dlBtn.disabled = true;

  const [eventsJson, volleyJson, footballJson] = await Promise.all([
    fetchJSON(API_EVENTS),
    fetchJSON(API_VOLLEY),
    fetchJSON(API_FOOTBALL)
  ]);

  state.events         = parseEventsData(eventsJson || []);
  state.volleyball     = parseVolleyballData(volleyJson || []);
  state.footballGroups = parseFootballData(footballJson || {});

  const totalFoot = state.footballGroups.reduce((s, g) =>
    s + (g.groups || []).reduce((ss, gg) => ss + gg.stations.length, 0), 0);

  $status.textContent =
    `✅ Events ${state.events.length} | ` +
    `Volleyball ${state.volleyball.length} | ` +
    `Football ${totalFoot}`;

  $dlBtn.disabled = false;
  render();
}

// ============== RENDER ==============
function renderCard(s) {
  const time   = s.time || extractTime(s.info);
  const status = s.status || "";
  const sub    = s.channel_code || "";

  return `
    <a class="card" href="${s.url}" target="_blank" rel="noopener">
      <div class="thumb-wrap">
        <img class="card-thumb" src="${s.image}" alt="" loading="lazy"
             onerror="this.style.opacity=0.3;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%221%22 height=%221%22/>'">
        ${time   ? `<span class="badge-time">${escapeHtml(time)}</span>` : ""}
        ${status ? `<span class="badge-status">${escapeHtml(status)}</span>` : ""}
      </div>
      <div class="card-body">
        <div class="card-title">${escapeHtml(s.name)}</div>
        <div class="card-channel">
          <span>${escapeHtml(sub)}</span>
          <span>${escapeHtml(shortenUrl(s.url))}</span>
        </div>
      </div>
    </a>`;
}

function extractTime(str) {
  if (!str) return "";
  const m = String(str).match(/(\d{2}:\d{2})/);
  return m ? m[1] : "";
}

function shortenUrl(url) {
  try {
    const u = new URL(url);
    return u.pathname;
  } catch { return url; }
}

function renderGroup(title, items) {
  if (!items.length) return "";
  return `
    <div class="group-section">
      <div class="group-title">${escapeHtml(title)} <span class="count">${items.length}</span></div>
      <div class="grid">${items.map(renderCard).join("")}</div>
    </div>`;
}

function render() {
  const q = state.search.toLowerCase();
  const filterFn = s => !q ||
    s.name.toLowerCase().includes(q) ||
    (s.info || "").toLowerCase().includes(q) ||
    (s.channel_code || "").toLowerCase().includes(q);

  let html = "";

  // 📺 Events
  if (state.tab === "all" || state.tab === "event") {
    const list = state.events.filter(filterFn);
    html += renderGroup("📺 Live - Events", list);
  }

  // 🏐 Volleyball
  if (state.tab === "all" || state.tab === "volley") {
    const list = state.volleyball.filter(filterFn);
    html += renderGroup("🏐 Volleyball Live", list);
  }

  // ⚽ Football (มี nested groups)
  if (state.tab === "all" || state.tab === "football") {
    state.footballGroups.forEach(parent => {
      parent.groups.forEach(sub => {
        const list = sub.stations.filter(filterFn);
        html += renderGroup(`⚽ ${sub.name}`, list);
      });
    });
  }

  if (!html.trim()) {
    $content.innerHTML = `<div class="empty">😕 ไม่พบรายการที่ตรงกัน</div>`;
    return;
  }
  $content.innerHTML = html;
}

// ============== BUILD W3U (โครงสร้างซ้อนแบบ cloudfare) ==============
function buildW3U() {
  const atmflixSubGroups = [
    {
      name: "Live - Events",
      image: LOGO_URL,
      stations: state.events.map(stripUI)
    },
    {
      name: "Volleyball Live",
      image: LOGO_URL,
      stations: state.volleyball.map(stripUI)
    },
    ...state.footballGroups.map(g => ({
      name: g.name,
      image: g.image,
      groups: g.groups.map(sub => ({
        name: sub.name,
        image: sub.image,
        stations: sub.stations.map(stripUI)
      }))
    }))
  ];

  return {
    name: "© 2026 ATMFLIX",
    author: `© 2026 ATMFLIX ${getThaiDateTime()}`,
    info: "© 2026 ATMFLIX. All Rights Reserved.",
    url: "https://atmflix.live",
    image: LOGO_URL,
    groups: [
      {
        name: "ATMFLIX",
        image: LOGO_URL,
        groups: atmflixSubGroups
      }
    ]
  };
}

// ตัด field ที่ใช้แค่ UI ออกก่อนบันทึก
function stripUI(s) {
  const { time, status, channel_code, ...rest } = s;
  return rest;
}

function downloadW3U() {
  const blob = new Blob(
    [JSON.stringify(buildW3U(), null, 2)],
    { type: "application/json;charset=utf-8" }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = JSON_FILE;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============== EVENTS UI ==============
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.tab = btn.dataset.tab;
    render();
  });
});

$search.addEventListener("input", e => {
  state.search = e.target.value.trim();
  render();
});

$reload.addEventListener("click", loadAll);
$dlBtn.addEventListener("click", downloadW3U);

// ============== INIT ==============
updateDateTime();
setInterval(updateDateTime, 1000);
loadAll();