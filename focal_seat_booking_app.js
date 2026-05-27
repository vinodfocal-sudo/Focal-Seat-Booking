const SUPABASE_URL = 'https://xvwuurrfpytblnlkuyjg.supabase.co';

const SUPABASE_KEY = 'sb_publishable_i6kGeV_OctFCL42v0XmPUQ_3GuQxc4G';

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

/* ===============================
   FIX 2: localStorage SAFE WRAPPER 
/* ============================
   FIX 2: localStorage SAFE WRAPPER
   Root cause: SharePoint iframe sandboxing and IE/Edge compatibility modes
   throw a SecurityError when localStorage is accessed, crashing ALL JS execution
   after that point — this is why renderTable() never ran.
   Fix: test localStorage availability once at startup; if unavailable, fall back
   to an in-memory store so the app renders and works for the session.
============================= */
var KEYS = {
  bookings:  'seatbooking_bookings',
  blocked:   'seatbooking_blocked',
  holidays:  'seatbooking_holidays',
  resources: 'seatbooking_resources',
  layoutImg: 'seatbooking_layout_img',
  adminLoggedIn: 'seatbooking_admin'
};

/* In-memory fallback store (used when localStorage is blocked) */
var _memStore = {};
var _lsAvailable = false;

/* Test localStorage availability safely at startup */
(function() {
  try {
    if (typeof localStorage === 'undefined' || !localStorage) {
      throw new Error('localStorage not available');
    }
    var _test = '__focal_ls_test__';
    localStorage.setItem(_test, '1');
    localStorage.removeItem(_test);
    _lsAvailable = true;
    console.log('[FocalBooking] localStorage: AVAILABLE');
  } catch(e) {
    _lsAvailable = false;
    console.warn('[FocalBooking] localStorage: BLOCKED — using in-memory store. Data will not persist between sessions.', e);
  }
})();

function getData(key) {
  try {
    var raw = _lsAvailable ? localStorage.getItem(key) : (_memStore[key] || null);
    if (!raw) return [];
    var parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn('[FocalBooking] Corrupt/non-array data for key:', key, '- resetting to []');
      setData(key, []);
      return [];
    }
    return parsed;
  } catch(e) {
    console.warn('[FocalBooking] getData error for key:', key, '- resetting. Error:', e);
    try { removeDataRaw(key); } catch(ignore) {}
    return [];
  }
}
function getDataRaw(key) {
  /* For non-array values like admin flag and layout image */
  try {
    return _lsAvailable ? localStorage.getItem(key) : (_memStore[key] || null);
  } catch(e) {
    return null;
  }
}
function setData(key, val) {
  try {
    var str = JSON.stringify(val);
    if (_lsAvailable) { localStorage.setItem(key, str); }
    else { _memStore[key] = str; }
  } catch(e) {
    console.warn('[FocalBooking] setData error for key:', key, e);
  }
}
function setDataRaw(key, val) {
  /* For non-JSON values */
  try {
    if (_lsAvailable) { localStorage.setItem(key, val); }
    else { _memStore[key] = val; }
  } catch(e) {
    console.warn('[FocalBooking] setDataRaw error for key:', key, e);
  }
}
function removeDataRaw(key) {
  try {
    if (_lsAvailable) { localStorage.removeItem(key); }
    else { delete _memStore[key]; }
  } catch(e) {}
}

/* ============================
   FIX 3: initDemoData — use safe wrappers, not bare localStorage.
   Old code: localStorage.getItem('_focal_demo_v2') would throw in SP sandbox
   and crash execution before renderTable() was ever reached.
============================= */
function initDemoData() {
  try {
    if (getDataRaw('_focal_demo_v3')) {
      console.log('[FocalBooking] Demo data v3 already loaded, skipping.');
      return;
    }
    console.log('[FocalBooking] Loading demo data v3 — refreshing employee list...');
    /* Preserve any existing bookings and blocked seats; only reset resources */
    var existingBookings = getData(KEYS.bookings);
    var existingBlocked  = getData(KEYS.blocked);
    var today = new Date();
    var mon = getMonday(today);
    var fmt = function(d) { return isoDate(d); };
    var bookings = existingBookings.length ? existingBookings : [
      { seat:'S03', date:fmt(addDays(mon,0)), initials:'VK' },
      { seat:'S05', date:fmt(addDays(mon,1)), initials:'MB' },
      { seat:'S07', date:fmt(addDays(mon,2)), initials:'NJ' }
    ];
    var blocked = existingBlocked.length ? existingBlocked : [];
    var resources = [
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
    setData(KEYS.bookings,  bookings);
    setData(KEYS.blocked,   blocked);
    if (!getData(KEYS.holidays).length) { setData(KEYS.holidays, []); }
    setData(KEYS.resources, resources);
    setDataRaw('_focal_demo_v3', '1');
    console.log('[FocalBooking] Demo data v3 loaded OK — 28 employees set.');
  } catch(e) {
    console.warn('[FocalBooking] initDemoData failed (non-fatal):', e);
    /* Non-fatal — app renders with empty data rather than crashing */
  }
}

/* ============================
   FIX 4: DATE HELPERS — SharePoint-safe
   Root cause: toISOString() converts to UTC before formatting.
   In SharePoint (especially IE11 compat mode or UTC+5:30 India timezone),
   a date at midnight local time becomes the PREVIOUS day in UTC,
   causing isoDate() to return the wrong date string.
   All booking lookups use isoDate() for matching — a wrong date means
   no matches are found and the table appears blank.
   Fix: build the ISO date string from local date parts, not UTC.
============================= */
function getMonday(d) {
  try {
    var dt = new Date(d);
    if (isNaN(dt.getTime())) { dt = new Date(); } /* fallback to today if invalid */
    var day = dt.getDay(); /* 0=Sun,1=Mon...6=Sat */
    var diff = (day === 0) ? -6 : (1 - day);
    dt.setDate(dt.getDate() + diff);
    dt.setHours(0, 0, 0, 0);
    return dt;
  } catch(e) {
    console.warn('[FocalBooking] getMonday error, using today:', e);
    var fallback = new Date(); fallback.setHours(0,0,0,0); return fallback;
  }
}
function addDays(d, n) {
  try {
    var dt = new Date(d);
    dt.setDate(dt.getDate() + n);
    return dt;
  } catch(e) { return new Date(); }
}
function formatDate(d) {
  try {
    /* Use locale-aware formatting but safe for all browsers */
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var day = d.getDate();
    var mon = months[d.getMonth()];
    return (day < 10 ? '0' : '') + day + ' ' + mon;
  } catch(e) { return ''; }
}
function isoDate(d) {
  /* FIX: use LOCAL date parts, NOT toISOString() (which uses UTC) */
  try {
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return y + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  } catch(e) {
    console.warn('[FocalBooking] isoDate error:', e);
    return '';
  }
}

/* ============================
   FIX 5: APP STATE — safe initialization
   Root cause: currentWeekStart = getMonday(new Date()) was executing at
   script-parse time (top level). In SharePoint Modern pages, scripts inside
   embedded HTML files can execute in a partial DOM state, causing getMonday()
   to fail silently and leave currentWeekStart as undefined/NaN.
   renderTable() then builds weekDates from a broken date and produces no output.
   Fix: declare with a safe default; reinitialize inside DOMContentLoaded.
============================= */
var currentWeekStart = null;  /* set safely in DOMContentLoaded */
var pendingCell = null;
var manageCell  = null;

/* SEATS: S01–S31 */
var SEATS = (function() {
  var arr = [];
  for (var i = 1; i <= 31; i++) {
    arr.push('S' + (i < 10 ? '0' : '') + i);
  }
  return arr;
})();
var DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

/* ============================
   PERMANENT BLOCKED SEATS — S01, S15, S21, S26 blocked until 31 Dec 2026
   Hard-coded; not stored in localStorage. Admin UI block/unblock does not
   affect these. To lift, remove the seat from the array below.
============================= */
var PERMANENT_BLOCKED_SEATS = ['S01', 'S15', 'S21', 'S26'];
var PERMANENT_BLOCK_UNTIL   = '2026-12-31';

function isPermanentlyBlocked(seat, dateStr) {
  if (PERMANENT_BLOCKED_SEATS.indexOf(seat) === -1) return false;
  return dateStr <= PERMANENT_BLOCK_UNTIL;
}

/* ============================
   RENDER TABLE — fully wrapped in try/catch
   Any single failure now logs + shows error message instead of silent blank
============================= */
function renderTable() {
  console.log('[FocalBooking] renderTable() called. currentWeekStart =', currentWeekStart);
  try {
    /* Guard: ensure currentWeekStart is valid */
    if (!currentWeekStart || isNaN(currentWeekStart.getTime())) {
      console.warn('[FocalBooking] currentWeekStart invalid, resetting to today.');
      currentWeekStart = getMonday(new Date());
    }

    var bookings = getData(KEYS.bookings);
    var blocked  = getData(KEYS.blocked);
    var holidays = getData(KEYS.holidays);
    console.log('[FocalBooking] Data loaded — bookings:', bookings.length, 'blocked:', blocked.length, 'holidays:', holidays.length);

    /* Build week dates array */
    var weekDates = [];
    for (var wi = 0; wi < 7; wi++) { weekDates.push(addDays(currentWeekStart, wi)); }

    /* Update header */
    var thead = document.getElementById('tableHeader');
    if (!thead) {
      console.error('[FocalBooking] tableHeader element not found — DOM may not be ready (SharePoint iframe).');
      return false;
    }
    thead.innerHTML = '<th>Seat</th>';
    for (var di = 0; di < weekDates.length; di++) {
      var d = weekDates[di];
      var th = document.createElement('th');
      var hol = null;
      for (var hi = 0; hi < holidays.length; hi++) { if (holidays[hi].date === isoDate(d)) { hol = holidays[hi]; break; } }
      th.innerHTML = '<div class="th-day">' + DAYS[di] + '</div><div class="th-date">' + formatDate(d) + '</div>'
        + (hol ? '<div style="font-size:9px;background:rgba(255,255,255,0.2);border-radius:3px;padding:1px 3px;margin-top:1px;">' + hol.name + '</div>' : '');
      if (hol) th.style.background = '#1540a0';
      thead.appendChild(th);
    }

    /* Update week range display */
    var rangeEl = document.getElementById('weekRangeDisplay');
    if (rangeEl) {
      rangeEl.innerHTML = formatDate(weekDates[0]) + ' \u2013 ' + formatDate(weekDates[6]) + '<br>' + weekDates[0].getFullYear();
    }

    /* Build body */
    var tbody = document.getElementById('tableBody');
    if (!tbody) {
      console.error('[FocalBooking] tableBody element not found — DOM may not be ready (SharePoint iframe).');
      return false;
    }
    tbody.innerHTML = '';
    var totalBooked = 0, totalBlocked = 0, totalHoliday = 0;

    for (var si = 0; si < SEATS.length; si++) {
      var seat = SEATS[si];
      var tr = document.createElement('tr');

      var tdLabel = document.createElement('td');
      tdLabel.className = 'seat-label';
      tdLabel.textContent = seat;
      tr.appendChild(tdLabel);

      for (var dj = 0; dj < weekDates.length; dj++) {
        var dw = weekDates[dj];
        var dateStr = isoDate(dw);
        var td  = document.createElement('td');
        td.className = 'seat-cell';
        var div = document.createElement('div');
        div.className = 'cell-inner';

        var holCell = null;
        for (var hh = 0; hh < holidays.length; hh++) { if (holidays[hh].date === dateStr) { holCell = holidays[hh]; break; } }
        var blkCell = null;
        for (var bb = 0; bb < blocked.length; bb++) { if (blocked[bb].seat === seat && blocked[bb].date === dateStr) { blkCell = blocked[bb]; break; } }
        var bkgCell = null;
        for (var bk = 0; bk < bookings.length; bk++) { if (bookings[bk].seat === seat && bookings[bk].date === dateStr) { bkgCell = bookings[bk]; break; } }

        /* Permanent block overrides everything */
        var permBlocked = isPermanentlyBlocked(seat, dateStr);

        if (holCell) {
          div.classList.add('holiday'); div.textContent = 'PH'; div.title = holCell.name; totalHoliday++;
        } else if (permBlocked || blkCell) {
          div.classList.add('unavailable'); div.textContent = '\u2715';
          div.title = permBlocked ? 'Permanently Not Available' : 'Not Available';
          totalBlocked++;
        } else if (bkgCell) {
          div.classList.add('booked'); div.textContent = bkgCell.initials; div.title = 'Booked: ' + bkgCell.initials; totalBooked++;
          /* Closure fix: capture seat/dateStr/bkgCell for onclick */
          (function(s, ds, bkg) {
            div.onclick = function() { openManageModal(s, ds, bkg); };
          })(seat, dateStr, bkgCell);
        } else {
          div.classList.add('available'); div.title = 'Book ' + seat + ' \u2013 ' + formatDate(dw);
          (function(s, ds, dayLabel) {
            div.onclick = function() { openBookingModal(s, ds, dayLabel); };
          })(seat, dateStr, DAYS[dj] + ', ' + formatDate(dw));
        }
        td.appendChild(div); tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    /* Summary */
    var avail = SEATS.length - totalBooked - totalBlocked;
    if (avail < 0) avail = 0;
    var summaryEl = document.getElementById('summaryBadges');
    if (summaryEl) {
      summaryEl.innerHTML =
        '<span class="badge badge-total">\uD83E\uDE91 Total Seats: ' + SEATS.length + '</span>' +
        '<span class="badge badge-booked">\u2705 Booked: ' + totalBooked + '</span>' +
        '<span class="badge badge-available">\u25FD Available: ' + avail + '</span>' +
        '<span class="badge badge-unavailable">\uD83D\uDEAB Not Available: ' + totalBlocked + '</span>' +
        '<span class="badge badge-holiday">\uD83C\uDF89 Holiday: ' + totalHoliday + '</span>';
    }
    console.log('[FocalBooking] renderTable() completed successfully. Seats rendered:', SEATS.length);
    return true;
  } catch(e) {
    console.error('[FocalBooking] renderTable() FAILED:', e);
    /* Show visible error inside the table area so it's not a silent blank */
    var tbodyErr = document.getElementById('tableBody');
    if (tbodyErr) {
      tbodyErr.innerHTML = '<tr><td colspan="8" style="padding:20px;text-align:center;color:#dc2626;font-size:13px;">' +
        '⚠️ Table render error. Please refresh the page. (Details: ' + e.message + ')</td></tr>';
    }
    var rangeErrEl = document.getElementById('weekRangeDisplay');
    if (rangeErrEl) rangeErrEl.textContent = 'Error - please refresh';
    return false;
  }
}

/* ============================
   WEEK NAVIGATION
============================= */
function changeWeek(dir) {
  currentWeekStart = addDays(currentWeekStart, dir*7);
  renderTable();
}

/* ============================
   BOOKING MODAL — dropdown (name + initials), saves only initials to seat
============================= */
function openBookingModal(seat, date, dayLabel) {
  pendingCell = { seat: seat, date: date, dayLabel: dayLabel };
  document.getElementById('modalSeatInfo').textContent = seat + '  \xB7  ' + dayLabel;

  /* Populate dropdown from resources */
  var sel = document.getElementById('empSelect');
  sel.innerHTML = '<option value="">— Select your name —</option>';
  var resources = getData(KEYS.resources);
  resources.forEach(function(r) {
    var opt = document.createElement('option');
    opt.value = r.initials;
    opt.textContent = r.name + '  (' + r.initials + ')';
    sel.appendChild(opt);
  });
  sel.value = '';
  document.getElementById('empSelectErr').classList.remove('show');
  sel.classList.remove('error');
  openModal('bookingModal');
  setTimeout(function() { if (sel) sel.focus(); }, 220);
}

function confirmBooking() {
  var sel      = document.getElementById('empSelect');
  var initials = sel ? sel.value.trim().toUpperCase() : '';
  if (!initials) {
    document.getElementById('empSelectErr').classList.add('show');
    sel.classList.add('error');
    return;
  }
  document.getElementById('empSelectErr').classList.remove('show');
  sel.classList.remove('error');

  var bookings = getData(KEYS.bookings);

  /* Check: seat already booked this day */
  for (var bi = 0; bi < bookings.length; bi++) {
    if (bookings[bi].seat === pendingCell.seat && bookings[bi].date === pendingCell.date) {
      showToast('Seat already booked for this day.', 'error');
      closeModal('bookingModal'); return;
    }
  }

  /* Double-booking warning: same initials already has a seat on this date */
  var existingSeat = null;
  for (var di = 0; di < bookings.length; di++) {
    if (bookings[di].initials === initials && bookings[di].date === pendingCell.date) {
      existingSeat = bookings[di].seat; break;
    }
  }
  if (existingSeat) {
    var proceed = confirm(
      '\u26A0\uFE0F Double Booking Warning!\n\n' +
      initials + ' already has seat ' + existingSeat + ' booked on this day.\n\n' +
      'Are you sure you want to book ' + pendingCell.seat + ' as well?'
    );
    if (!proceed) return;
  }

  bookings.push({ seat: pendingCell.seat, date: pendingCell.date, initials: initials });
  saveBookingsToSupabase(bookings);
  closeModal('bookingModal');
  renderTable();
  showToast('\u2705 ' + pendingCell.seat + ' booked (' + initials + ') for ' + pendingCell.dayLabel + '!', 'success');
}

/* ============================
   MANAGE MODAL (Edit/Cancel)
============================= */
function openManageModal(seat, date, booking) {
  manageCell = { seat: seat, date: date, booking: booking };
  document.getElementById('manageSeatInfo').textContent = seat + '  \xB7  Booked by ' + booking.initials + '  \xB7  ' + date;
  document.getElementById('editInitials').value = booking.initials;
  openModal('manageModal');
}
function saveEditBooking() {
  var initials = document.getElementById('editInitials').value.trim().toUpperCase();
  if (!initials || initials.length < 1 || initials.length > 3) { showToast('Enter 2-3 initials.', 'error'); return; }
  var bookings = getData(KEYS.bookings);
  var idx = -1;
  for (var si = 0; si < bookings.length; si++) {
    if (bookings[si].seat === manageCell.seat && bookings[si].date === manageCell.date) { idx = si; break; }
  }
  if (idx > -1) { bookings[idx].initials = initials; }
  setData(KEYS.bookings, bookings);
  closeModal('manageModal'); renderTable();
  showToast('Booking updated!', 'success');
}
function cancelBooking() {
  if (!confirm('Cancel this booking?')) return;
  var bookings = getData(KEYS.bookings);
  var filtered = [];
  for (var ci = 0; ci < bookings.length; ci++) {
    if (!(bookings[ci].seat === manageCell.seat && bookings[ci].date === manageCell.date)) {
      filtered.push(bookings[ci]);
    }
  }
  setData(KEYS.bookings, filtered);
  closeModal('manageModal'); renderTable();
  showToast('Booking cancelled.', 'info');
}

/* ============================
   OFFICE LAYOUT IMAGE
============================= */
function handleLayoutUpload(e) {
  try {
    var file = e.target.files[0];
    if (!file) return;
    if (file.size > 5*1024*1024) { showToast('Image too large (max 5MB).','error'); return; }
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        setDataRaw(KEYS.layoutImg, ev.target.result);
        showLayoutImage(ev.target.result);
        showToast('Office layout uploaded!','success');
      } catch(err) { console.warn('[FocalBooking] Layout save error:', err); }
    };
    reader.readAsDataURL(file);
  } catch(e) { console.warn('[FocalBooking] handleLayoutUpload error:', e); }
}
function showLayoutImage(src) {
  try {
    var img  = document.getElementById('layoutImg');
    var ph   = document.getElementById('layoutPlaceholder');
    var hint = document.getElementById('layoutHint');
    if (img)  { img.src = src; img.classList.add('loaded'); }
    if (ph)   { ph.style.display = 'none'; }
    if (hint) { hint.style.display = 'block'; }
  } catch(e) { console.warn('[FocalBooking] showLayoutImage error:', e); }
}
function openImageZoom() {
  try {
    var img = document.getElementById('layoutImg');
    if (!img || !img.classList.contains('loaded')) return;
    document.getElementById('imgZoomTarget').src = img.src;
    openModal('imgZoomModal');
  } catch(e) {}
}
function closeImageZoom(e) {
  try {
    if (e.target === document.getElementById('imgZoomModal')) closeModal('imgZoomModal');
  } catch(er) {}
}

/* Restore saved office layout image from storage (non-fatal) */
function loadSavedLayout() {
  try {
    var saved = getDataRaw(KEYS.layoutImg);
    if (saved) {
      showLayoutImage(saved);
      console.log('[FocalBooking] loadSavedLayout: restored layout image.');
    } else {
      console.log('[FocalBooking] loadSavedLayout: no saved layout.');
    }
  } catch(e) {
    console.warn('[FocalBooking] loadSavedLayout failed (non-fatal):', e);
  }
}

/* ============================
   ADMIN — all bare localStorage replaced with safe wrappers
============================= */
var ADMIN_PASS = 'admin123';

function requestAdmin() {
  if (getDataRaw(KEYS.adminLoggedIn) === '1') { showPage('admin'); return; }
  document.getElementById('adminPassInput').value = '';
  document.getElementById('adminPassErr').style.display = 'none';
  openModal('adminLoginOverlay');
  setTimeout(function() {
    var el = document.getElementById('adminPassInput'); if (el) el.focus();
  }, 220);
}
function checkAdminPass() {
  if (document.getElementById('adminPassInput').value === ADMIN_PASS) {
    setDataRaw(KEYS.adminLoggedIn, '1');
    closeModal('adminLoginOverlay');
    showPage('admin');
  } else {
    document.getElementById('adminPassErr').style.display = 'block';
  }
}

function renderAdminBookings() {
  var bookings = getData(KEYS.bookings);
  var tbody = document.getElementById('adminBookingsBody');
  if (!tbody) return;
  if (!bookings.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="color:var(--text-muted);text-align:center;padding:14px;">No bookings yet.</td></tr>';
    return;
  }
  bookings.sort(function(a,b){ return a.date.localeCompare(b.date); });
  tbody.innerHTML = bookings.map(function(b) {
    return '<tr>' +
      '<td><strong>' + b.seat + '</strong></td>' +
      '<td>' + b.date + '</td>' +
      '<td><span style="background:var(--green-light);color:var(--green-dark);padding:2px 7px;border-radius:4px;font-weight:700;">' + b.initials + '</span></td>' +
      '<td><button class="btn-sm del" onclick="adminDeleteBooking(\'' + b.seat + '\',\'' + b.date + '\')">Delete</button></td>' +
      '</tr>';
  }).join('');
}
function adminDeleteBooking(seat, date) {
  if (!confirm('Delete this booking?')) return;
  var b = getData(KEYS.bookings).filter(function(x){ return !(x.seat===seat && x.date===date); });
  setData(KEYS.bookings, b);
  renderAdminBookings(); renderTable();
  showToast('Booking deleted.','info');
}
function confirmResetAll() {
  if (!confirm('Delete ALL bookings? This cannot be undone.')) return;
  setData(KEYS.bookings, []);
  renderAdminBookings(); renderTable();
  showToast('All bookings cleared.','info');
}
function exportBookings() {
  try {
    var data = { bookings:getData(KEYS.bookings), blocked:getData(KEYS.blocked), holidays:getData(KEYS.holidays), exported:new Date().toISOString() };
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    a.download = 'focal_seat_bookings.json';
    a.click();
    showToast('Exported!','success');
  } catch(e) { showToast('Export failed in this browser.','error'); }
}

/* ============================
   EXPORT BOOKINGS — CSV
   Filename includes the current week range for easy filing.
   Columns: Seat, Date, Day, Initials, Employee Name
============================= */
function exportBookingsCSV() {
  try {
    var bookings  = getData(KEYS.bookings);
    var resources = getData(KEYS.resources);

    /* Build initials → name lookup */
    var nameMap = {};
    for (var ri = 0; ri < resources.length; ri++) {
      nameMap[resources[ri].initials] = resources[ri].name;
    }

    /* Week range label for filename */
    var weekStart = currentWeekStart ? isoDate(currentWeekStart) : 'all';
    var weekEnd   = currentWeekStart ? isoDate(addDays(currentWeekStart, 6)) : '';
    var fileLabel = weekStart + '_to_' + weekEnd;

    /* Build CSV */
    var dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var lines = ['"Seat","Date","Day","Initials","Employee Name"'];
    bookings.sort(function(a,b){ return a.date.localeCompare(b.date) || a.seat.localeCompare(b.seat); });
    for (var bi = 0; bi < bookings.length; bi++) {
      var b    = bookings[bi];
      var d    = new Date(b.date + 'T00:00:00');
      var day  = isNaN(d.getTime()) ? '' : dayNames[d.getDay()];
      var name = nameMap[b.initials] || '';
      lines.push(
        '"' + b.seat    + '",' +
        '"' + b.date    + '",' +
        '"' + day       + '",' +
        '"' + b.initials + '",' +
        '"' + name      + '"'
      );
    }
    var csv  = lines.join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = 'focal_bookings_' + fileLabel + '.csv';
    a.click();
    showToast('CSV exported!', 'success');
  } catch(e) {
    showToast('CSV export failed in this browser.', 'error');
  }
}
function adminBlockSeat() {
  var seat = document.getElementById('blockSeatInput').value.trim().toUpperCase();
  var date = document.getElementById('blockDateInput').value;
  if (!seat||!date) { showToast('Enter seat and date.','error'); return; }
  var blocked = getData(KEYS.blocked);
  var exists = false;
  for (var i=0;i<blocked.length;i++) { if (blocked[i].seat===seat&&blocked[i].date===date) { exists=true; break; } }
  if (!exists) { blocked.push({seat:seat,date:date}); setData(KEYS.blocked,blocked); }
  renderAdminBlocked(); renderTable();
  showToast(seat + ' blocked on ' + date + '.','info');
}
function adminUnblockSeat() {
  var seat = document.getElementById('blockSeatInput').value.trim().toUpperCase();
  var date = document.getElementById('blockDateInput').value;
  if (!seat||!date) { showToast('Enter seat and date.','error'); return; }
  var blocked = getData(KEYS.blocked).filter(function(b){ return !(b.seat===seat&&b.date===date); });
  setData(KEYS.blocked,blocked);
  renderAdminBlocked(); renderTable();
  showToast(seat + ' unblocked.','success');
}
function renderAdminBlocked() {
  var blocked = getData(KEYS.blocked);
  var el = document.getElementById('blockedList');
  if (!el) return;
  if (!blocked.length) { el.textContent='None'; return; }
  el.innerHTML = blocked.map(function(b){
    return '<span style="display:inline-block;background:var(--red-light);color:#dc2626;border-radius:4px;padding:2px 7px;margin:2px;font-size:11px;font-weight:700;">' + b.seat + '\xB7' + b.date + '</span>';
  }).join('');
}
function adminAddHoliday() {
  var date = document.getElementById('holidayDateInput').value;
  var name = document.getElementById('holidayNameInput').value.trim();
  if (!date||!name) { showToast('Enter date and name.','error'); return; }
  var holidays = getData(KEYS.holidays);
  var exists = false;
  for (var i=0;i<holidays.length;i++) { if (holidays[i].date===date) { exists=true; break; } }
  if (!exists) { holidays.push({date:date,name:name}); setData(KEYS.holidays,holidays); }
  renderAdminHolidays(); renderTable();
  showToast('Holiday "' + name + '" added!','success');
}
function renderAdminHolidays() {
  var holidays = getData(KEYS.holidays);
  var el = document.getElementById('holidayList');
  if (!el) return;
  if (!holidays.length) { el.innerHTML='<span style="color:var(--text-muted);">None scheduled.</span>'; return; }
  el.innerHTML = holidays.map(function(h){
    return '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">' +
      '<span style="font-size:12px;"><strong>' + h.date + '</strong> \u2013 ' + h.name + '</span>' +
      '<button class="btn-sm del" onclick="adminRemoveHoliday(\'' + h.date + '\')">&#x2715;</button>' +
      '</div>';
  }).join('');
}
function adminRemoveHoliday(date) {
  var h = getData(KEYS.holidays).filter(function(x){ return x.date!==date; });
  setData(KEYS.holidays,h); renderAdminHolidays(); renderTable();
  showToast('Holiday removed.','info');
}

/* ============================
   RESOURCES / EMPLOYEES
============================= */
function renderResources() {
  var resources = getData(KEYS.resources);
  var tbody = document.getElementById('resourcesTableBody');
  if (!tbody) return;
  if (!resources.length) {
    tbody.innerHTML='<tr><td colspan="5" style="color:var(--text-muted);text-align:center;padding:20px;">No employees added yet.</td></tr>';
    return;
  }
  tbody.innerHTML = resources.map(function(r,i){
    return '<tr>' +
      '<td>' + (i+1) + '</td>' +
      '<td><strong>' + r.name + '</strong></td>' +
      '<td><span style="background:var(--primary-light);color:var(--primary);padding:2px 8px;border-radius:4px;font-weight:700;">' + r.initials + '</span></td>' +
      '<td><span style="font-size:11px;color:var(--text-muted);">Office Seating</span></td>' +
      '<td><span style="background:var(--green-light);color:var(--green-dark);padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">' + (r.status||'Available') + '</span></td>' +
      '</tr>';
  }).join('');
}
function renderAdminResources() {
  var resources = getData(KEYS.resources);
  var tbody = document.getElementById('adminResourceBody');
  if (!tbody) return;
  if (!resources.length) {
    tbody.innerHTML='<tr><td colspan="4" style="color:var(--text-muted);text-align:center;padding:10px;">No employees.</td></tr>';
    return;
  }
  tbody.innerHTML = resources.map(function(r,i){
    return '<tr>' +
      '<td>' + r.name + '</td>' +
      '<td>' + r.initials + '</td>' +
      '<td>Office Seating</td>' +
      '<td><button class="btn-sm del" onclick="adminDeleteResource(' + i + ')">Del</button></td>' +
      '</tr>';
  }).join('');
}
function adminAddResource() {
  var name     = document.getElementById('resNameInput').value.trim();
  var initials = document.getElementById('resInitialsInput').value.trim().toUpperCase();
  if (!name||!initials) { showToast('Enter employee name and initials.','error'); return; }
  var resources = getData(KEYS.resources);
  resources.push({ name:name, initials:initials, type:'Office Seating', status:'Available' });
  setData(KEYS.resources, resources);
  document.getElementById('resNameInput').value='';
  document.getElementById('resInitialsInput').value='';
  renderAdminResources(); renderResources();
  showToast('Employee "' + name + '" added!','success');
}
function adminDeleteResource(idx) {
  if (!confirm('Delete this employee?')) return;
  var r = getData(KEYS.resources);
  r.splice(idx,1); setData(KEYS.resources,r);
  renderAdminResources(); renderResources();
  showToast('Employee deleted.','info');
}

/* ============================
   PAGE NAVIGATION
============================= */
function showPage(page) {
  try {
    document.getElementById('bookingPage').classList.toggle('hidden', page!=='booking');
    document.getElementById('adminPage').classList.toggle('active', page==='admin');
    document.getElementById('resourcesPage').classList.toggle('active', page==='resources');
    document.getElementById('navBooking').classList.toggle('active', page==='booking');
    document.getElementById('navResources').classList.toggle('active', page==='resources');
    document.getElementById('navAdmin').classList.toggle('active', page==='admin');
    if (page==='admin') { renderAdminBookings(); renderAdminBlocked(); renderAdminHolidays(); renderAdminResources(); }
    if (page==='resources') renderResources();
  } catch(e) { console.warn('[FocalBooking] showPage error:', e); }
}

/* ============================
   MANAGE MODAL (Edit/Cancel) — second reference removed (defined above)
============================= */
function openManageModal(seat, date, booking) {
  manageCell = { seat:seat, date:date, booking:booking };
  document.getElementById('manageSeatInfo').textContent = seat + '  \xB7  Booked by ' + booking.initials + '  \xB7  ' + date;
  document.getElementById('editInitials').value = booking.initials;
  openModal('manageModal');
}
function saveEditBooking() {
  var initials = document.getElementById('editInitials').value.trim().toUpperCase();
  if (!initials || initials.length < 1 || initials.length > 3) { showToast('Enter 2\u20133 initials.','error'); return; }
  var bookings = getData(KEYS.bookings);
  for (var i=0;i<bookings.length;i++) {
    if (bookings[i].seat===manageCell.seat && bookings[i].date===manageCell.date) { bookings[i].initials=initials; break; }
  }
  setData(KEYS.bookings, bookings);
  closeModal('manageModal'); renderTable();
  showToast('\u270F\uFE0F Booking updated!','success');
}
function cancelBooking() {
  if (!confirm('Cancel this booking?')) return;
  var bookings = getData(KEYS.bookings).filter(function(b){ return !(b.seat===manageCell.seat && b.date===manageCell.date); });
  setData(KEYS.bookings, bookings);
  closeModal('manageModal'); renderTable();
  showToast('\uD83D\uDDD1\uFE0F Booking cancelled.','info');
}

/* ============================
   WEEK NAVIGATION
============================= */
function changeWeek(dir) {
  currentWeekStart = addDays(currentWeekStart, dir * 7);
  renderTable();
}

/* ============================
   MODAL HELPERS
============================= */
function openModal(id)  { try { document.getElementById(id).classList.add('open'); } catch(e){} }
function closeModal(id) { try { document.getElementById(id).classList.remove('open'); } catch(e){} }

/* ============================
   TOAST
============================= */
var toastTimer;
function showToast(msg, type) {
  type = type || 'info';
  try {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.className = 'toast ' + type + ' show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ t.classList.remove('show'); }, 3200);
  } catch(e) {}
}

/* ============================
   FIX 6: BULLETPROOF INIT
   Root cause: DOMContentLoaded sometimes does NOT fire inside SharePoint's
   embedded iframe/webpart because SharePoint's own page scripts interfere
   with the document lifecycle. The script ran but the event never fired,
   so initDemoData() and renderTable() were never called.
   Fix: Use THREE layered initialization triggers:
     1. DOMContentLoaded — standard
     2. document.readyState check — catches cases where DOM was already ready
        when the script ran (common in SP Modern pages)
     3. window.onload fallback — last resort if everything else fails
   Only one will actually execute init() due to the _appReady guard flag.
============================= */
var _appReady = false;
var _tableRendered = false;
var _modalsBound = false;

function isWeekStillLoading() {
  var el = document.getElementById('weekRangeDisplay');
  if (!el) return true;
  var t = (el.textContent || el.innerText || '').replace(/\s/g, '');
  return t === 'Loading...' || t === 'Loading';
}

function appInit(forceRetry) {
  if (_appReady && _tableRendered && !forceRetry) return;
  console.log('[FocalBooking] appInit() starting. readyState:', document.readyState, 'forceRetry:', !!forceRetry);
  try {
    /* CRITICAL: initialize currentWeekStart here, safely inside init */
    currentWeekStart = getMonday(new Date());
    console.log('[FocalBooking] currentWeekStart set to:', currentWeekStart);

    initDemoData();
    var rendered = renderTable();
    if (!rendered) {
      console.warn('[FocalBooking] renderTable returned false — will allow retry.');
      _tableRendered = false;
    } else {
      _tableRendered = true;
      _appReady = true;
    }

    try { loadSavedLayout(); } catch(layoutErr) {
      console.warn('[FocalBooking] loadSavedLayout skipped:', layoutErr);
    }

    var today = isoDate(new Date());
    var bdi = document.getElementById('blockDateInput');
    var hdi = document.getElementById('holidayDateInput');
    if (bdi) bdi.value = today;
    if (hdi) hdi.value = today;

    /* Close modals on overlay click — only bind once */
    if (!_modalsBound) {
      _modalsBound = true;
      var overlays = document.querySelectorAll('.modal-overlay');
      for (var oi = 0; oi < overlays.length; oi++) {
        (function(overlay) {
          overlay.addEventListener('click', function(e) {
            if (e.target === overlay) overlay.classList.remove('open');
          });
        })(overlays[oi]);
      }
      var adminOverlay = document.getElementById('adminLoginOverlay');
      if (adminOverlay) {
        adminOverlay.addEventListener('click', function(e) {
          if (e.target === adminOverlay) closeModal('adminLoginOverlay');
        });
      }
    }

    if (_tableRendered) {
      _appReady = true;
      var spNotice = document.getElementById('spScriptBlockedNotice');
      if (spNotice) spNotice.style.display = 'none';
      console.log('[FocalBooking] appInit() completed successfully.');
    } else {
      console.warn('[FocalBooking] appInit() finished but table not rendered yet.');
    }
  } catch(e) {
    console.error('[FocalBooking] appInit() FAILED:', e);
    try {
      if (!currentWeekStart || isNaN(currentWeekStart.getTime())) {
        currentWeekStart = getMonday(new Date());
      }
      if (renderTable()) { _tableRendered = true; _appReady = true; }
    } catch(e2) {
      console.error('[FocalBooking] Emergency renderTable also failed:', e2);
    }
  }
}

function scheduleInitRetries() {
  var delays = [0, 50, 250, 1000, 3000];
  for (var di = 0; di < delays.length; di++) {
    (function(ms) {
      setTimeout(function() {
        if (!_tableRendered || isWeekStillLoading()) {
          console.log('[FocalBooking] Retry appInit after ' + ms + 'ms (SP/OneDrive DOM delay).');
          appInit(true);
        }
      }, ms);
    })(delays[di]);
  }
}

/* Global error handler — never leave UI stuck on Loading */
window.onerror = function(msg, url, line, col, err) {
  console.error('[FocalBooking] Uncaught error:', msg, 'at', line + ':' + col, err || '');
  if (!_tableRendered || isWeekStillLoading()) {
    try {
      if (!currentWeekStart || isNaN(currentWeekStart.getTime())) {
        currentWeekStart = getMonday(new Date());
      }
      renderTable();
    } catch(recoverErr) {
      console.error('[FocalBooking] Recovery renderTable failed:', recoverErr);
    }
  }
  return false;
};

console.log('[FocalBooking] Script loaded. readyState:', document.readyState);

/* Trigger 1: DOMContentLoaded */
document.addEventListener('DOMContentLoaded', function() {
  console.log('[FocalBooking] DOMContentLoaded fired.');
  appInit(false);
  scheduleInitRetries();
});

/* Trigger 2: readyState already interactive or complete (SP Modern pages) */
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  console.log('[FocalBooking] readyState already ' + document.readyState + ' — running appInit directly.');
  appInit(false);
  scheduleInitRetries();
}

/* Trigger 3: window.onload fallback */
window.addEventListener('load', function() {
  console.log('[FocalBooking] window.load fired.');
  appInit(true);
  scheduleInitRetries();
});
