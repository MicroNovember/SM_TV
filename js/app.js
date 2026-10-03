// ---------------------- CONFIG ----------------------
const API_EVENTS    = "https://atmflix.live/api/events";
const API_FIXTURES  = "https://atmflix.live/api/fixtures/date";
const THUMB_BASE    = "https://atmflix.live/stream/thumbs/";
const EVENT_BASE    = "https://atmflix.live/events/";
const FIXTURE_BASE  = "https://atmflix.live/fixtures/";
const REFERER       = "https://atmflix.live";
const LOGO_URL      = "https://kicksball.com/assets/img/logo.png";
const JSON_FILE     = "events_result.w3u";
// ----------------------------------------------------

let allData       = [];   // รวม events + fixtures
let filteredData  = [];   // หลังกรอง

const $content     = document.getElementById('content');
const $status      = document.getElementById('status');
const $search      = document.getElementById('search');
const $dlBtn       = document.getElementById('downloadBtn');
const $reload      = document.getElementById('reloadBtn');
const $dt          = document.getElementById('datetime');
const $datePicker  = document.getElementById('datePicker');
const $groupSelect = document.getElementById('groupSelect');

// ---------- วันที่/เวลา ----------
function updateDateTime() {
  const now = new Date();
  const d  = String(now.getDate()).padStart(2, '0');
  const m  = String(now.getMonth() + 1).padStart(2, '0');
  const y  = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  $dt.textContent = `[${d}/${m}/${y}] | [${hh}:${mm}:${ss}]`;
}

// ---------- Escape HTML ----------
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ---------- แปลง Events เดิม ----------
function transformEvent(ev) {
  const eventId = ev.id || "";
  const channel = ev.channel || "";
  const chInfo  = ev.channel_info || {};
  const name    = chInfo.name || channel || ev.title || "";
  const title   = ev.title || "";
  const thumb   = ev.thumbnail || (channel ? `${THUMB_BASE}${channel}.jpg` : "");
  const url     = eventId ? `${EVENT_BASE}${eventId}` : "";

  return {
    name,
    info: title,
    image: thumb,
    url,
    referer: REFERER,
    channel_code: channel,
    group: "📺 Events",   // กลุ่มแยกจากลีก
    time: "",
    status: "",
    type: "event"
  };
}

// ---------- แปลง Fixtures ตามโครงสร้างใหม่ ----------
function transformFixture(fx) {
  const id       = fx.id || "";
  const channel  = fx.channel || "";
  const league   = fx.league_info || {};
  const home     = fx.teamhome || {};
  const away     = fx.teamaway || {};

  // ชื่อทีม: ใช้ name_th ถ้ามี ไม่งั้นใช้ name
  const homeName = home.name_th || home.name || "Home";
  const awayName = away.name_th || away.name || "Away";

  // ชื่อลีก
  const leagueName = league.name || "ไม่ระบุลีก";

  // title: ทีมเหย้า vs ทีมเยือน
  const title = `${homeName} vs ${awayName}`;

  // thumbnail: ใช้โลโก้ทีมเหย้า
  const thumb = home.logo || league.logo || "";

  // url: ใช้ id สร้างจาก FIXTURE_BASE
  const url = id ? `${FIXTURE_BASE}${id}` : "";

  // แสดงเวลาแบบ HH:MM
  let timeStr = "";
  if (fx.event_time) {
    const d = new Date(fx.event_time);
    if (!isNaN(d)) {
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      timeStr = `${hh}:${mm}`;
    }
  }

  return {
    name: homeName,           // ใช้ในช่องล่างซ้าย (ทีมเหย้า)
    info: title,              // หัวการ์ด
    image: thumb,
    url,
    referer: REFERER,
    channel_code: channel,
    group: `🏆 ${leagueName}`, // จัดกลุ่มตามลีก
    time: timeStr,
    status: fx.status_short || "",
    type: "fixture"
  };
}

// ---------- โหลด Events ----------
async function loadEvents() {
  try {
    const res = await fetch(API_EVENTS, { headers: { "Accept": "application/json" } });
    if (!res.ok) throw new Error(`Events HTTP ${res.status}`);
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.data || []);
    return list.map(transformEvent);
  } catch (err) {
    console.warn("⚠️ โหลด Events ไม่สำเร็จ:", err.message);
    return [];
  }
}

// ---------- โหลด Fixtures (โครงสร้าง { "YYYY-MM-DD": [...] }) ----------
async function loadFixtures(dateStr) {
  if (!dateStr) return [];
  try {
    const url = `${API_FIXTURES}?date=${dateStr}`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) throw new Error(`Fixtures HTTP ${res.status}`);
    const data = await res.json();

    let list = [];

    // เคส 1: response เป็น object ที่ key เป็นวันที่ เช่น { "2026-10-03": [...] }
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      // ถ้ามี key ตรงกับวันที่เลือก → ใช้เลย
      if (Array.isArray(data[dateStr])) {
        list = data[dateStr];
      } else {
        // ถ้าไม่มี key ตรง → รวมทุก array ที่อยู่ใน object
        Object.values(data).forEach(v => {
          if (Array.isArray(v)) list = list.concat(v);
        });
      }
    }
    // เคส 2: response เป็น array ตรง ๆ
    else if (Array.isArray(data)) {
      list = data;
    }

    return list.map(transformFixture);
  } catch (err) {
    console.warn("⚠️ โหลด Fixtures ไม่สำเร็จ:", err.message);
    return [];
  }
}

// ---------- โหลดทั้งหมด ----------
async function loadAll() {
  $content.innerHTML = `<div class="loader"><div class="spinner"></div>กำลังดึงข้อมูล...</div>`;
  $status.textContent = "🌐 กำลังเชื่อมต่อ API...";
  $dlBtn.disabled = true;

  const date = $datePicker.value || new Date().toISOString().slice(0, 10);

  const [events, fixtures] = await Promise.all([
    loadEvents(),
    loadFixtures(date)
  ]);

  allData = [...events, ...fixtures];

  // อัปเดต group dropdown
  const groups = [...new Set(allData.map(d => d.group))].sort();
  $groupSelect.innerHTML = `<option value="">-- ทั้งหมด --</option>` +
    groups.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('');

  $status.textContent =
    `✅ โหลดสำเร็จ ${allData.length} รายการ ` +
    `(📺 ${events.length} events / ⚽ ${fixtures.length} fixtures)`;

  $dlBtn.disabled = false;
  applyFilters();
}

// ---------- กรองข้อมูล ----------
function applyFilters() {
  const q     = $search.value.trim().toLowerCase();
  const group = $groupSelect.value;

  filteredData = allData.filter(item => {
    if (group && item.group !== group) return false;
    if (q) {
      const text = (item.info + " " + item.name + " " + item.channel_code).toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });

  renderGrouped(filteredData);
}

// ---------- เรนเดอร์แบบจัดกลุ่ม ----------
function renderGrouped(list) {
  if (!list.length) {
    $content.innerHTML = `<div class="empty">😕 ไม่พบรายการที่ตรงกัน</div>`;
    return;
  }

  const grouped = {};
  list.forEach(item => {
    const g = item.group || "ไม่ระบุกลุ่ม";
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(item);
  });

  const html = Object.keys(grouped).sort().map(groupName => {
    const items = grouped[groupName];
    return `
      <div class="group-section">
        <div class="group-title">
          ${escapeHtml(groupName)}
          <span class="count">${items.length}</span>
        </div>
        <div class="grid">
          ${items.map(s => `
            <a class="card" href="${s.url}" target="_blank" rel="noopener">
              <div class="thumb-wrap">
                <img class="card-thumb" src="${s.image}" alt="" loading="lazy"
                     onerror="this.style.opacity=0.3;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%221%22 height=%221%22/>'">
                ${s.time ? `<span class="badge-time">${escapeHtml(s.time)}</span>` : ""}
                ${s.status ? `<span class="badge-status">${escapeHtml(s.status)}</span>` : ""}
              </div>
              <div class="card-body">
                <div class="card-title">${escapeHtml(s.info || s.name)}</div>
                <div class="card-channel">
                  <span>${escapeHtml(s.channel_code)}</span>
                  <span>${escapeHtml(s.name)}</span>
                </div>
              </div>
            </a>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  $content.innerHTML = html;
}

// ---------- สร้าง .w3u ----------
function buildW3U() {
  const now = new Date();
  const d  = String(now.getDate()).padStart(2, '0');
  const m  = String(now.getMonth() + 1).padStart(2, '0');
  const y  = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  return {
    name: "Live -event",
    author: `[${d}/${m}/${y}] | [${hh}:${mm}:${ss}]`,
    info: "atmflix",
    image: LOGO_URL,
    stations: (filteredData.length ? filteredData : allData)
              .map(({ time, status, type, group, ...rest }) => rest) // ตัด field ที่ไม่จำเป็น
  };
}

function downloadW3U() {
  const blob = new Blob(
    [JSON.stringify(buildW3U(), null, 2)],
    { type: "application/json;charset=utf-8" }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = JSON_FILE;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------- Events ----------
$search.addEventListener('input', applyFilters);
$groupSelect.addEventListener('change', applyFilters);
$datePicker.addEventListener('change', loadAll);
$reload.addEventListener('click', loadAll);
$dlBtn.addEventListener('click', downloadW3U);

// ---------- Init ----------
updateDateTime();
setInterval(updateDateTime, 1000);
$datePicker.value = new Date().toISOString().slice(0, 10);
loadAll();