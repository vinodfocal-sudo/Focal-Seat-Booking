/* ============================================================
   FOCAL INDIA — OFFICE SEAT BOOKING APP
   Architecture: GitHub Pages (frontend) + Supabase (backend)
   All booking data lives exclusively in Supabase.
   localStorage is used ONLY for non-booking UI state:
     - admin session flag
     - office layout image (base64, device-local only)
   ============================================================ */

/* ============================================================
   SUPABASE CLIENT
   Uses the CDN ESM build loaded via importmap in index.html.
   We expose a single global `supabase` client; nothing else
   should ever reference the Supabase URL or key directly.
   ============================================================ */
var SUPABASE_URL = 'https://xvwuurrfpytblnlkuyjg.supabase.co';
var SUPABASE_KEY = 'sb_publishable_i6kGeV_OctFCL42v0XmPUQ_3GuQxc4G';

/* Initialised once the Supabase library is available (see appInit) */
var supabase = null;

function initSupabaseClient() {
  try {
    /* The Supabase CDN bundle exposes window.supabase.createClient */
    if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      console.log('[FocalBooking] Supabase client initialised.');
      return true;
    }
    console.error('[FocalBooking] Supabase library not found on window.supabase — check the <script> tag in index.html.');
    return false;
  } catch (e) {
    console.error('[FocalBooking] initSupabaseClient failed:', e);
    return false;
  }
}

/* ============================================================
   KEYS — only for localStorage items that are NOT bookings
   ============================================================ */
var KEYS = {
  adminLoggedIn: 'seatbooking_admin',
  layoutImg:     'seatbooking_layout_img'
};

/* ============================================================
   SAFE localStorage WRAPPER (admin flag + layout image only)
   ============================================================ */
var _lsAvailable = (function () {
  try {
    var t = '__focal_ls_test__';
    localStorage.setItem(t, '1');
    localStorage.removeItem(t);
    return true;
  } catch (e) {
    return false;
  }
})();

function lsGet(key)      { try { return _lsAvailable ? localStorage.getItem(key) : null; }       catch(e){ return null; } }
function lsSet(key, val) { try { if (_lsAvailable) localStorage.setItem(key, val); }              catch(e){} }
function lsDel(key)      { try { if (_lsAvailable) localStorage.removeItem(key); }                catch(e){} }

/* ============================================================
   DATE HELPERS  (local-timezone safe — no UTC offset bugs)
   ============================================================ */
function getMonday(d) {
  var dt = new Date(d);
  if (isNaN(dt.getTime())) dt = new Date();
  var day  = dt.getDay();
  var diff = (day === 0) ? -6 : (1 - day);
  dt.setDate(dt.getDate() + diff);
  dt.setHours(0, 0, 0, 0);
  return dt;
}
function addDays(d, n) {
  var dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt;
}
function formatDate(d) {
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var day = d.getDate();
  return (day < 10 ? '0' : '') + day + ' ' + months[d.getMonth()];
}
function isoDate(d) {
  var y = d.getFullYear();
  var m = d.getMonth() + 1;
  var day = d.getDate();
  return y + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
}

/* ============================================================
   APP STATE
   ============================================================ */
var currentWeekStart = null;
var pendingCell      = null;
var manageCell       = null;

/* In-memory caches — populated from Supabase, never from localStorage */
var globalBookings   = [];   /* [{ seat, date, initials }]          */
var globalBlocked    = [];   /* [{ seat, date }]                     */
var globalHolidays   = [];   /* [{ date, name }]                     */
var globalResources  = [];   /* [{ name, initials, type, status }]   */

/* ============================================================
   SEATS
   ============================================================ */
var SEATS = (function () {
  var arr = [];
  for (var i = 1; i <= 31; i++) arr.push('S' + (i < 10 ? '0' : '') + i);
  return arr;
})();
var DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

/* Permanently blocked seats (hard-coded; not stored in DB) */
var PERMANENT_BLOCKED_SEATS = ['S01', 'S15', 'S21', 'S26'];
var PERMANENT_BLOCK_UNTIL   = '2026-12-31';

function isPermanentlyBlocked(seat, dateStr) {
  return PERMANENT_BLOCKED_SEATS.indexOf(seat) !== -1 && dateStr <= PERMANENT_BLOCK_UNTIL;
}

/* ============================================================
   SUPABASE DATA LAYER
   All functions return { data, error } like the JS SDK does.
   "bookings"  table columns : seat TEXT, date TEXT, initials TEXT
   "blocked"   table columns : seat TEXT, date TEXT
   "holidays"  table columns : date TEXT, name TEXT
   "resources" table columns : name TEXT, initials TEXT, type TEXT, status TEXT
   ============================================================ */

/* --- Generic helpers ---------------------------------------- */
async function sbFetch(table) {
  var { data, error } = await supabase.from(table).select('*');
  if (error) console.error('[FocalBooking] sbFetch(' + table + ') error:', error);
  return { data: data || [], error };
}
async function sbInsert(table, row) {
  var { data, error } = await supabase.from(table).insert([row]);
  if (error) console.error('[FocalBooking] sbInsert(' + table + ') error:', error);
  return { data, error };
}
async function sbDelete(table, matchObj) {
  var query = supabase.from(table).delete();
  Object.keys(matchObj).forEach(function (k) { query = query.eq(k, matchObj[k]); });
  var { data, error } = await query;
  if (error) console.error('[FocalBooking] sbDelete(' + table + ') error:', error);
  return { data, error };
}
async function sbUpdate(table, matchObj, updates) {
  var query = supabase.from(table).update(updates);
  Object.keys(matchObj).forEach(function (k) { query = query.eq(k, matchObj[k]); });
  var { data, error } = await query;
  if (error) console.error('[FocalBooking] sbUpdate(' + table + ') error:', error);
  return { data, error };
}

/* --- Load all data into memory caches ----------------------- */
async function loadAllData() {
  showLoading(true);
  try {
    var [bRes, blRes, hRes, rRes] = await Promise.all([
      sbFetch('bookings'),
      sbFetch('blocked'),
      sbFetch('holidays'),
      sbFetch('resources')
    ]);
    globalBookings  = bRes.data;
    globalBlocked   = blRes.data;
    globalHolidays  = hRes.data;
    globalResources = rRes.data;

    /* Seed default employees on first run */
    if (globalResources.length === 0) {
      await seedDefaultResources();
    }

    console.log('[FocalBooking] Data loaded — bookings:', globalBookings.length,
      'blocked:', globalBlocked.length, 'holidays:', globalHolidays.length,
      'resources:', globalResources.length);
  } catch (e) {
    console.error('[FocalBooking] loadAllData error:', e);
    showToast('Could not load data from server. Check console.', 'error');
  } finally {
    showLoading(false);
  }
}

/* Seed the employee list once (only if the table is empty) */
async function seedDefaultResources() {
  var defaults = [
    { name:'Vinod Kumar',           initials:'VK',  type:'Office Seating', status:'Available' },
    { name:'Mohammed Basheer',      initials:'MB',  type:'Office Seating', status:'Available' },
    { name:'Nidhina Jamal',         initials:'NJ',  type:'Office Seating', status:'Available' },
    { name:'Anish Kumar',           initials:'AK',  type:'Office Seating', status:'Available' },
    { name:'Bhagyaraj NG',          initials:'BN',  type:'Office Seating', status:'Available' },
    { name:'Akshay S',              initials:'AS',  type:'Office Seating', status:'Available' },
    { name:'Aneesh M A',            initials:'AM',  type:'Office Seating', status:'Available' },
    { name:'Aswin Chandh C S',      initials:'AC',  type:'Office Seating', status:'Available' },
    { name:'Muralidharan K',        initials:'MK',  type:'Office Seating', status:'Available' },
    { name:'Sameer Venugopal',      initials:'SV',  type:'Office Seating', status:'Available' },
    { name:'Arun Das',              initials:'AD',  type:'Office Seating', status:'Available' },
    { name:'Sidharth S Nair',       initials:'SN',  type:'Office Seating', status:'Available' },
    { name:'Ajith P Babu',          initials:'AB',  type:'Office Seating', status:'Available' },
    { name:'Arun P J',              initials:'AP',  type:'Office Seating', status:'Available' },
    { name:'Abhijith N',            initials:'ABN', type:'Office Seating', status:'Available' },
    { name:'Ponnu Anna Varghese',   initials:'PA',  type:'Office Seating', status:'Available' },
    { name:'Jinto Thomas',          initials:'JT',  type:'Office Seating', status:'Available' },
    { name:'Anusuya N V',           initials:'ANV', type:'Office Seating', status:'Available' },
    { name:'Mohammed Abu Thahair',  initials:'MA',  type:'Office Seating', status:'Available' },
    { name:'Magesh M',              initials:'MM',  type:'Office Seating', status:'Available' },
    { name:'Gouri Vinod',           initials:'GV',  type:'Office Seating', status:'Available' },
    { name:'Sooraj R',              initials:'SR',  type:'Office Seating', status:'Available' },
    { name:'Kaverimani Ramasamy',   initials:'KR',  type:'Office Seating', status:'Available' },
    { name:'Aby George',            initials:'AG',  type:'Office Seating', status:'Available' },
    { name:'Jayakrishnan O J',      initials:'JO',  type:'Office Seating', status:'Available' },
    { name:'Jeevan Roy',            initials:'JR',  type:'Office Seating', status:'Available' },
    { name:'Ajmal Khan',            initials:'AJK', type:'Office Seating', status:'Available' },
    { name:'Vijesh Vijayan',        initials:'VV',  type:'Office Seating', status:'Available' }
  ];
  var { error } = await supabase.from('resources').insert(defaults);
  if (error) {
    console.error('[FocalBooking] seedDefaultResources error:', error);
  } else {
    globalResources = defaults;
    console.log('[FocalBooking] Default employees seeded (28).');
  }
}

/* ============================================================
   REAL-TIME SUBSCRIPTION
   Listens for INSERT / UPDATE / DELETE on the bookings table
   so all open browser tabs/devices refresh automatically.
   ============================================================ */
function subscribeToBookings() {
  supabase
    .channel('bookings-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, function (payload) {
      console.log('[FocalBooking] Real-time bookings change:', payload.eventType);
      loadAllData().then(function () { renderTable(); });
    })
    .subscribe(function (status) {
      console.log('[FocalBooking] Real-time subscription status:', status);
    });
}

/* ============================================================
   LOADING SPINNER HELPER
   ============================================================ */
function showLoading(on) {
  var el = document.getElementById('loadingOverlay');
  if (!el) return;
  el.style.display = on ? 'flex' : 'none';
}

/* ============================================================
   RENDER TABLE  (synchronous — reads from memory caches)
   ============================================================ */
function renderTable() {
  console.log('[FocalBooking] renderTable() called.');
  try {
    if (!currentWeekStart || isNaN(currentWeekStart.getTime())) {
      currentWeekStart = getMonday(new Date());
    }

    var bookings  = globalBookings;
    var blocked   = globalBlocked;
    var holidays  = globalHolidays;

    /* Build week dates */
    var weekDates = [];
    for (var wi = 0; wi < 7; wi++) weekDates.push(addDays(currentWeekStart, wi));

    /* Header */
    var thead = document.getElementById('tableHeader');
    if (!thead) { console.error('[FocalBooking] tableHeader not found'); return false; }
    thead.innerHTML = '<th>Seat</th>';
    for (var di = 0; di < weekDates.length; di++) {
      var d   = weekDates[di];
      var th  = document.createElement('th');
      var hol = null;
      for (var hi = 0; hi < holidays.length; hi++) {
        if (holidays[hi].date === isoDate(d)) { hol = holidays[hi]; break; }
      }
      th.innerHTML = '<div class="th-day">' + DAYS[di] + '</div>'
        + '<div class="th-date">' + formatDate(d) + '</div>'
        + (hol ? '<div style="font-size:9px;background:rgba(255,255,255,0.2);border-radius:3px;padding:1px 3px;margin-top:1px;">' + hol.name + '</div>' : '');
      if (hol) th.style.background = '#1540a0';
      thead.appendChild(th);
    }

    /* Week range label */
    var rangeEl = document.getElementById('weekRangeDisplay');
    if (rangeEl) {
      rangeEl.innerHTML = formatDate(weekDates[0]) + ' \u2013 ' + formatDate(weekDates[6]) + '<br>' + weekDates[0].getFullYear();
    }

    /* Body */
    var tbody = document.getElementById('tableBody');
    if (!tbody) { console.error('[FocalBooking] tableBody not found'); return false; }
    tbody.innerHTML = '';
    var totalBooked = 0, totalBlocked = 0, totalHoliday = 0;

    for (var si = 0; si < SEATS.length; si++) {
      var seat = SEATS[si];
      var tr   = document.createElement('tr');

      var tdLabel = document.createElement('td');
      tdLabel.className   = 'seat-label';
      tdLabel.textContent = seat;
      tr.appendChild(tdLabel);

      for (var dj = 0; dj < weekDates.length; dj++) {
        var dw      = weekDates[dj];
        var dateStr = isoDate(dw);
        var td      = document.createElement('td');
        td.className = 'seat-cell';
        var div = document.createElement('div');
        div.className = 'cell-inner';

        var holCell  = null;
        var blkCell  = null;
        var bkgCell  = null;
        for (var hh = 0; hh < holidays.length; hh++) {
          if (holidays[hh].date === dateStr) { holCell = holidays[hh]; break; }
        }
        for (var bb = 0; bb < blocked.length; bb++) {
          if (blocked[bb].seat === seat && blocked[bb].date === dateStr) { blkCell = blocked[bb]; break; }
        }
        for (var bk = 0; bk < bookings.length; bk++) {
          if (bookings[bk].seat === seat && bookings[bk].date === dateStr) { bkgCell = bookings[bk]; break; }
        }

        var permBlocked = isPermanentlyBlocked(seat, dateStr);

        if (holCell) {
          div.classList.add('holiday');
          div.textContent = 'PH';
          div.title = holCell.name;
          totalHoliday++;
        } else if (permBlocked || blkCell) {
          div.classList.add('unavailable');
          div.textContent = '\u2715';
          div.title = permBlocked ? 'Permanently Not Available' : 'Not Available';
          totalBlocked++;
        } else if (bkgCell) {
          div.classList.add('booked');
          div.textContent = bkgCell.initials;
          div.title = 'Booked: ' + bkgCell.initials;
          totalBooked++;
          (function (s, ds, bkg) {
            div.onclick = function () { openManageModal(s, ds, bkg); };
          })(seat, dateStr, bkgCell);
        } else {
          div.classList.add('available');
          div.title = 'Book ' + seat + ' \u2013 ' + formatDate(dw);
          (function (s, ds, dayLabel) {
            div.onclick = function () { openBookingModal(s, ds, dayLabel); };
          })(seat, dateStr, DAYS[dj] + ', ' + formatDate(dw));
        }

        td.appendChild(div);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    /* Summary */
    var avail = Math.max(0, SEATS.length - totalBooked - totalBlocked);
    var summaryEl = document.getElementById('summaryBadges');
    if (summaryEl) {
      summaryEl.innerHTML =
        '<span class="badge badge-total">\uD83E\uDE91 Total Seats: ' + SEATS.length + '</span>' +
        '<span class="badge badge-booked">\u2705 Booked: ' + totalBooked + '</span>' +
        '<span class="badge badge-available">\u25FD Available: ' + avail + '</span>' +
        '<span class="badge badge-unavailable">\uD83D\uDEAB Not Available: ' + totalBlocked + '</span>' +
        '<span class="badge badge-holiday">\uD83C\uDF89 Holiday: ' + totalHoliday + '</span>';
    }

    console.log('[FocalBooking] renderTable() complete. Booked:', totalBooked);
    return true;
  } catch (e) {
    console.error('[FocalBooking] renderTable() FAILED:', e);
    var tbodyErr = document.getElementById('tableBody');
    if (tbodyErr) {
      tbodyErr.innerHTML = '<tr><td colspan="8" style="padding:20px;text-align:center;color:#dc2626;">'
        + '\u26A0\uFE0F Table render error. Please refresh. (' + e.message + ')</td></tr>';
    }
    var rangeErrEl = document.getElementById('weekRangeDisplay');
    if (rangeErrEl) rangeErrEl.textContent = 'Error - please refresh';
    return false;
  }
}

/* ============================================================
   WEEK NAVIGATION
   ============================================================ */
function changeWeek(dir) {
  currentWeekStart = addDays(currentWeekStart, dir * 7);
  renderTable();
}

/* ============================================================
   BOOKING MODAL
   ============================================================ */
function openBookingModal(seat, date, dayLabel) {
  pendingCell = { seat: seat, date: date, dayLabel: dayLabel };
  document.getElementById('modalSeatInfo').textContent = seat + '  \xB7  ' + dayLabel;

  var sel = document.getElementById('empSelect');
  sel.innerHTML = '<option value="">— Select your name —</option>';
  globalResources.forEach(function (r) {
    var opt = document.createElement('option');
    opt.value       = r.initials;
    opt.textContent = r.name + '  (' + r.initials + ')';
    sel.appendChild(opt);
  });
  sel.value = '';
  document.getElementById('empSelectErr').classList.remove('show');
  sel.classList.remove('error');
  openModal('bookingModal');
  setTimeout(function () { if (sel) sel.focus(); }, 220);
}

async function confirmBooking() {
  var sel      = document.getElementById('empSelect');
  var initials = sel ? sel.value.trim().toUpperCase() : '';
  if (!initials) {
    document.getElementById('empSelectErr').classList.add('show');
    sel.classList.add('error');
    return;
  }
  document.getElementById('empSelectErr').classList.remove('show');
  sel.classList.remove('error');

  /* Guard: seat already booked on this day */
  for (var bi = 0; bi < globalBookings.length; bi++) {
    if (globalBookings[bi].seat === pendingCell.seat && globalBookings[bi].date === pendingCell.date) {
      showToast('Seat already booked for this day.', 'error');
      closeModal('bookingModal');
      return;
    }
  }

  /* Double-booking warning: same person already has a seat today */
  var existingSeat = null;
  for (var di = 0; di < globalBookings.length; di++) {
    if (globalBookings[di].initials === initials && globalBookings[di].date === pendingCell.date) {
      existingSeat = globalBookings[di].seat;
      break;
    }
  }
  if (existingSeat) {
    var proceed = confirm(
      '\u26A0\uFE0F Double Booking Warning!\n\n' + initials +
      ' already has seat ' + existingSeat + ' booked on this day.\n\nBook ' + pendingCell.seat + ' as well?'
    );
    if (!proceed) return;
  }

  /* Optimistic UI update */
  var newBooking = { seat: pendingCell.seat, date: pendingCell.date, initials: initials };
  globalBookings.push(newBooking);
  closeModal('bookingModal');
  renderTable();
  showToast('\u2705 ' + pendingCell.seat + ' booked (' + initials + ') for ' + pendingCell.dayLabel + '!', 'success');

  /* Persist to Supabase */
  var { error } = await sbInsert('bookings', newBooking);
  if (error) {
    /* Roll back optimistic update */
    globalBookings = globalBookings.filter(function (b) {
      return !(b.seat === newBooking.seat && b.date === newBooking.date);
    });
    renderTable();
    showToast('Save failed — booking rolled back. Please try again.', 'error');
  }
}

/* ============================================================
   MANAGE MODAL (Edit / Cancel an existing booking)
   ============================================================ */
function openManageModal(seat, date, booking) {
  manageCell = { seat: seat, date: date, booking: booking };
  document.getElementById('manageSeatInfo').textContent =
    seat + '  \xB7  Booked by ' + booking.initials + '  \xB7  ' + date;
  document.getElementById('editInitials').value = booking.initials;
  openModal('manageModal');
}

async function saveEditBooking() {
  var initials = document.getElementById('editInitials').value.trim().toUpperCase();
  if (!initials || initials.length < 1 || initials.length > 3) {
    showToast('Enter 2\u20133 initials.', 'error');
    return;
  }

  /* Optimistic update */
  var oldInitials = manageCell.booking.initials;
  for (var i = 0; i < globalBookings.length; i++) {
    if (globalBookings[i].seat === manageCell.seat && globalBookings[i].date === manageCell.date) {
      globalBookings[i].initials = initials;
      break;
    }
  }
  closeModal('manageModal');
  renderTable();
  showToast('\u270F\uFE0F Booking updated!', 'success');

  /* Persist */
  var { error } = await sbUpdate(
    'bookings',
    { seat: manageCell.seat, date: manageCell.date },
    { initials: initials }
  );
  if (error) {
    /* Roll back */
    for (var j = 0; j < globalBookings.length; j++) {
      if (globalBookings[j].seat === manageCell.seat && globalBookings[j].date === manageCell.date) {
        globalBookings[j].initials = oldInitials;
        break;
      }
    }
    renderTable();
    showToast('Update failed. Please try again.', 'error');
  }
}

async function cancelBooking() {
  if (!confirm('Cancel this booking?')) return;

  /* Optimistic update */
  var removed = globalBookings.filter(function (b) {
    return b.seat === manageCell.seat && b.date === manageCell.date;
  });
  globalBookings = globalBookings.filter(function (b) {
    return !(b.seat === manageCell.seat && b.date === manageCell.date);
  });
  closeModal('manageModal');
  renderTable();
  showToast('\uD83D\uDDD1\uFE0F Booking cancelled.', 'info');

  /* Persist */
  var { error } = await sbDelete('bookings', { seat: manageCell.seat, date: manageCell.date });
  if (error) {
    /* Roll back */
    globalBookings = globalBookings.concat(removed);
    renderTable();
    showToast('Cancellation failed. Please try again.', 'error');
  }
}

/* ============================================================
   OFFICE LAYOUT IMAGE  (stored in localStorage, device-local)
   ============================================================ */
function handleLayoutUpload(e) {
  try {
    var file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Image too large (max 5 MB).', 'error'); return; }
    var reader = new FileReader();
    reader.onload = function (ev) {
      lsSet(KEYS.layoutImg, ev.target.result);
      showLayoutImage(ev.target.result);
      showToast('Office layout uploaded!', 'success');
    };
    reader.readAsDataURL(file);
  } catch (e) { console.warn('[FocalBooking] handleLayoutUpload error:', e); }
}
function showLayoutImage(src) {
  var img  = document.getElementById('layoutImg');
  var ph   = document.getElementById('layoutPlaceholder');
  var hint = document.getElementById('layoutHint');
  if (img)  { img.src = src; img.classList.add('loaded'); }
  if (ph)   { ph.style.display = 'none'; }
  if (hint) { hint.style.display = 'block'; }
}
function openImageZoom() {
  var img = document.getElementById('layoutImg');
  if (!img || !img.classList.contains('loaded')) return;
  document.getElementById('imgZoomTarget').src = img.src;
  openModal('imgZoomModal');
}
function closeImageZoom(e) {
  if (e.target === document.getElementById('imgZoomModal')) closeModal('imgZoomModal');
}
function loadSavedLayout() {
  var saved = lsGet(KEYS.layoutImg);
  if (saved) showLayoutImage(saved);
}

/* ============================================================
   ADMIN — password check (session flag in localStorage)
   ============================================================ */
var ADMIN_PASS = 'admin123';

function requestAdmin() {
  if (lsGet(KEYS.adminLoggedIn) === '1') { showPage('admin'); return; }
  document.getElementById('adminPassInput').value = '';
  document.getElementById('adminPassErr').style.display = 'none';
  openModal('adminLoginOverlay');
  setTimeout(function () {
    var el = document.getElementById('adminPassInput');
    if (el) el.focus();
  }, 220);
}
function checkAdminPass() {
  if (document.getElementById('adminPassInput').value === ADMIN_PASS) {
    lsSet(KEYS.adminLoggedIn, '1');
    closeModal('adminLoginOverlay');
    showPage('admin');
  } else {
    document.getElementById('adminPassErr').style.display = 'block';
  }
}

/* ============================================================
   ADMIN — BOOKINGS
   ============================================================ */
function renderAdminBookings() {
  var tbody = document.getElementById('adminBookingsBody');
  if (!tbody) return;
  var bookings = globalBookings.slice().sort(function (a, b) {
    return a.date.localeCompare(b.date);
  });
  if (!bookings.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="color:var(--text-muted);text-align:center;padding:14px;">No bookings yet.</td></tr>';
    return;
  }
  tbody.innerHTML = bookings.map(function (b) {
    return '<tr>' +
      '<td><strong>' + b.seat + '</strong></td>' +
      '<td>' + b.date + '</td>' +
      '<td><span style="background:var(--green-light);color:var(--green-dark);padding:2px 7px;border-radius:4px;font-weight:700;">' + b.initials + '</span></td>' +
      '<td><button class="btn-sm del" onclick="adminDeleteBooking(\'' + b.seat + '\',\'' + b.date + '\')">Delete</button></td>' +
      '</tr>';
  }).join('');
}

async function adminDeleteBooking(seat, date) {
  if (!confirm('Delete this booking?')) return;
  globalBookings = globalBookings.filter(function (x) { return !(x.seat === seat && x.date === date); });
  renderAdminBookings();
  renderTable();
  showToast('Booking deleted.', 'info');
  var { error } = await sbDelete('bookings', { seat: seat, date: date });
  if (error) {
    showToast('Delete failed on server. Please refresh.', 'error');
    await loadAllData();
    renderAdminBookings();
    renderTable();
  }
}

async function confirmResetAll() {
  if (!confirm('Delete ALL bookings? This cannot be undone.')) return;
  globalBookings = [];
  renderAdminBookings();
  renderTable();
  showToast('All bookings cleared.', 'info');
  var { error } = await supabase.from('bookings').delete().neq('seat', '');
  if (error) {
    showToast('Server clear failed. Please refresh.', 'error');
    await loadAllData();
    renderAdminBookings();
    renderTable();
  }
}

/* ============================================================
   ADMIN — BLOCKED SEATS
   ============================================================ */
async function adminBlockSeat() {
  var seat = document.getElementById('blockSeatInput').value.trim().toUpperCase();
  var date = document.getElementById('blockDateInput').value;
  if (!seat || !date) { showToast('Enter seat and date.', 'error'); return; }

  var exists = globalBlocked.some(function (b) { return b.seat === seat && b.date === date; });
  if (exists) { showToast(seat + ' already blocked on ' + date + '.', 'info'); return; }

  globalBlocked.push({ seat: seat, date: date });
  renderAdminBlocked();
  renderTable();
  showToast(seat + ' blocked on ' + date + '.', 'info');

  var { error } = await sbInsert('blocked', { seat: seat, date: date });
  if (error) {
    globalBlocked = globalBlocked.filter(function (b) { return !(b.seat === seat && b.date === date); });
    renderAdminBlocked();
    renderTable();
    showToast('Block failed. Please try again.', 'error');
  }
}

async function adminUnblockSeat() {
  var seat = document.getElementById('blockSeatInput').value.trim().toUpperCase();
  var date = document.getElementById('blockDateInput').value;
  if (!seat || !date) { showToast('Enter seat and date.', 'error'); return; }

  var removed = globalBlocked.filter(function (b) { return b.seat === seat && b.date === date; });
  globalBlocked = globalBlocked.filter(function (b) { return !(b.seat === seat && b.date === date); });
  renderAdminBlocked();
  renderTable();
  showToast(seat + ' unblocked.', 'success');

  var { error } = await sbDelete('blocked', { seat: seat, date: date });
  if (error) {
    globalBlocked = globalBlocked.concat(removed);
    renderAdminBlocked();
    renderTable();
    showToast('Unblock failed. Please try again.', 'error');
  }
}

function renderAdminBlocked() {
  var el = document.getElementById('blockedList');
  if (!el) return;
  if (!globalBlocked.length) { el.textContent = 'None'; return; }
  el.innerHTML = globalBlocked.map(function (b) {
    return '<span style="display:inline-block;background:var(--red-light);color:#dc2626;border-radius:4px;padding:2px 7px;margin:2px;font-size:11px;font-weight:700;">'
      + b.seat + '\xB7' + b.date + '</span>';
  }).join('');
}

/* ============================================================
   ADMIN — HOLIDAYS
   ============================================================ */
async function adminAddHoliday() {
  var date = document.getElementById('holidayDateInput').value;
  var name = document.getElementById('holidayNameInput').value.trim();
  if (!date || !name) { showToast('Enter date and name.', 'error'); return; }

  var exists = globalHolidays.some(function (h) { return h.date === date; });
  if (exists) { showToast('Holiday already exists for that date.', 'info'); return; }

  globalHolidays.push({ date: date, name: name });
  renderAdminHolidays();
  renderTable();
  showToast('Holiday "' + name + '" added!', 'success');

  var { error } = await sbInsert('holidays', { date: date, name: name });
  if (error) {
    globalHolidays = globalHolidays.filter(function (h) { return h.date !== date; });
    renderAdminHolidays();
    renderTable();
    showToast('Save failed. Please try again.', 'error');
  }
}

function renderAdminHolidays() {
  var el = document.getElementById('holidayList');
  if (!el) return;
  if (!globalHolidays.length) {
    el.innerHTML = '<span style="color:var(--text-muted);">None scheduled.</span>';
    return;
  }
  el.innerHTML = globalHolidays.map(function (h) {
    return '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">' +
      '<span style="font-size:12px;"><strong>' + h.date + '</strong> \u2013 ' + h.name + '</span>' +
      '<button class="btn-sm del" onclick="adminRemoveHoliday(\'' + h.date + '\')">&#x2715;</button>' +
      '</div>';
  }).join('');
}

async function adminRemoveHoliday(date) {
  var removed = globalHolidays.filter(function (h) { return h.date === date; });
  globalHolidays = globalHolidays.filter(function (h) { return h.date !== date; });
  renderAdminHolidays();
  renderTable();
  showToast('Holiday removed.', 'info');
  var { error } = await sbDelete('holidays', { date: date });
  if (error) {
    globalHolidays = globalHolidays.concat(removed);
    renderAdminHolidays();
    renderTable();
    showToast('Remove failed. Please try again.', 'error');
  }
}

/* ============================================================
   RESOURCES / EMPLOYEES
   ============================================================ */
function renderResources() {
  var tbody = document.getElementById('resourcesTableBody');
  if (!tbody) return;
  if (!globalResources.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:var(--text-muted);text-align:center;padding:20px;">No employees added yet.</td></tr>';
    return;
  }
  tbody.innerHTML = globalResources.map(function (r, i) {
    return '<tr>' +
      '<td>' + (i + 1) + '</td>' +
      '<td><strong>' + r.name + '</strong></td>' +
      '<td><span style="background:var(--primary-light);color:var(--primary);padding:2px 8px;border-radius:4px;font-weight:700;">' + r.initials + '</span></td>' +
      '<td><span style="font-size:11px;color:var(--text-muted);">Office Seating</span></td>' +
      '<td><span style="background:var(--green-light);color:var(--green-dark);padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">' + (r.status || 'Available') + '</span></td>' +
      '</tr>';
  }).join('');
}

function renderAdminResources() {
  var tbody = document.getElementById('adminResourceBody');
  if (!tbody) return;
  if (!globalResources.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="color:var(--text-muted);text-align:center;padding:10px;">No employees.</td></tr>';
    return;
  }
  tbody.innerHTML = globalResources.map(function (r, i) {
    return '<tr>' +
      '<td>' + r.name + '</td>' +
      '<td>' + r.initials + '</td>' +
      '<td>Office Seating</td>' +
      '<td><button class="btn-sm del" onclick="adminDeleteResource(' + i + ')">Del</button></td>' +
      '</tr>';
  }).join('');
}

async function adminAddResource() {
  var name     = document.getElementById('resNameInput').value.trim();
  var initials = document.getElementById('resInitialsInput').value.trim().toUpperCase();
  if (!name || !initials) { showToast('Enter employee name and initials.', 'error'); return; }

  var newResource = { name: name, initials: initials, type: 'Office Seating', status: 'Available' };
  globalResources.push(newResource);
  document.getElementById('resNameInput').value     = '';
  document.getElementById('resInitialsInput').value = '';
  renderAdminResources();
  renderResources();
  showToast('Employee "' + name + '" added!', 'success');

  var { error } = await sbInsert('resources', newResource);
  if (error) {
    globalResources = globalResources.filter(function (r) {
      return !(r.name === name && r.initials === initials);
    });
    renderAdminResources();
    renderResources();
    showToast('Save failed. Please try again.', 'error');
  }
}

async function adminDeleteResource(idx) {
  if (!confirm('Delete this employee?')) return;
  var removed = globalResources.splice(idx, 1)[0];
  renderAdminResources();
  renderResources();
  showToast('Employee deleted.', 'info');
  var { error } = await sbDelete('resources', { name: removed.name, initials: removed.initials });
  if (error) {
    globalResources.splice(idx, 0, removed);
    renderAdminResources();
    renderResources();
    showToast('Delete failed. Please try again.', 'error');
  }
}

/* ============================================================
   EXPORT
   ============================================================ */
function exportBookings() {
  try {
    var data = {
      bookings:  globalBookings,
      blocked:   globalBlocked,
      holidays:  globalHolidays,
      exported:  new Date().toISOString()
    };
    var a      = document.createElement('a');
    a.href     = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = 'focal_seat_bookings.json';
    a.click();
    showToast('Exported!', 'success');
  } catch (e) { showToast('Export failed.', 'error'); }
}

function exportBookingsCSV() {
  try {
    var nameMap = {};
    globalResources.forEach(function (r) { nameMap[r.initials] = r.name; });

    var weekStart = currentWeekStart ? isoDate(currentWeekStart) : 'all';
    var weekEnd   = currentWeekStart ? isoDate(addDays(currentWeekStart, 6)) : '';
    var dayNames  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    var lines = ['"Seat","Date","Day","Initials","Employee Name"'];
    var sorted = globalBookings.slice().sort(function (a, b) {
      return a.date.localeCompare(b.date) || a.seat.localeCompare(b.seat);
    });
    sorted.forEach(function (b) {
      var d   = new Date(b.date + 'T00:00:00');
      var day = isNaN(d.getTime()) ? '' : dayNames[d.getDay()];
      lines.push('"' + b.seat + '","' + b.date + '","' + day + '","' + b.initials + '","' + (nameMap[b.initials] || '') + '"');
    });

    var a      = document.createElement('a');
    a.href     = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
    a.download = 'focal_bookings_' + weekStart + '_to_' + weekEnd + '.csv';
    a.click();
    showToast('CSV exported!', 'success');
  } catch (e) { showToast('CSV export failed.', 'error'); }
}

/* ============================================================
   PAGE NAVIGATION
   ============================================================ */
function showPage(page) {
  try {
    document.getElementById('bookingPage').classList.toggle('hidden',    page !== 'booking');
    document.getElementById('adminPage').classList.toggle('active',      page === 'admin');
    document.getElementById('resourcesPage').classList.toggle('active',  page === 'resources');
    document.getElementById('navBooking').classList.toggle('active',     page === 'booking');
    document.getElementById('navResources').classList.toggle('active',   page === 'resources');
    document.getElementById('navAdmin').classList.toggle('active',        page === 'admin');
    if (page === 'admin') {
      renderAdminBookings();
      renderAdminBlocked();
      renderAdminHolidays();
      renderAdminResources();
    }
    if (page === 'resources') renderResources();
  } catch (e) { console.warn('[FocalBooking] showPage error:', e); }
}

/* ============================================================
   MODAL HELPERS
   ============================================================ */
function openModal(id)  { try { document.getElementById(id).classList.add('open');    } catch (e) {} }
function closeModal(id) { try { document.getElementById(id).classList.remove('open'); } catch (e) {} }

/* ============================================================
   TOAST
   ============================================================ */
var toastTimer;
function showToast(msg, type) {
  try {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className   = 'toast ' + (type || 'info') + ' show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3200);
  } catch (e) {}
}

/* ============================================================
   APP INIT
   Single async entry point. Called once on DOMContentLoaded.
   ============================================================ */
var _appReady = false;

async function appInit() {
  if (_appReady) return;
  console.log('[FocalBooking] appInit() starting.');

  /* 1. Initialise Supabase client */
  if (!initSupabaseClient()) {
    showToast('Supabase library not loaded. Check index.html script tag.', 'error');
    return;
  }

  /* 2. Set current week */
  currentWeekStart = getMonday(new Date());

  /* 3. Render skeleton so UI is not blank while data loads */
  renderTable();

  /* 4. Load all data from Supabase, then re-render */
  await loadAllData();
  renderTable();

  /* 5. Restore office layout image (device-local) */
  try { loadSavedLayout(); } catch (e) {}

  /* 6. Prefill date inputs */
  var today = isoDate(new Date());
  var bdi   = document.getElementById('blockDateInput');
  var hdi   = document.getElementById('holidayDateInput');
  if (bdi) bdi.value = today;
  if (hdi) hdi.value = today;

  /* 7. Close modals on overlay click */
  document.querySelectorAll('.modal-overlay').forEach(function (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });
  var adminOverlay = document.getElementById('adminLoginOverlay');
  if (adminOverlay) {
    adminOverlay.addEventListener('click', function (e) {
      if (e.target === adminOverlay) closeModal('adminLoginOverlay');
    });
  }

  /* 8. Subscribe to real-time updates */
  subscribeToBookings();

  _appReady = true;
  console.log('[FocalBooking] appInit() complete.');
}

/* ============================================================
   BOOT — wait for DOM, then init
   ============================================================ */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', appInit);
} else {
  appInit();
}
