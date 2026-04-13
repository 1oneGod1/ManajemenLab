'use strict';

/* ===========================
   DATA
=========================== */
let facilities = [
  { name: 'Digital Oscilloscope',   qty: 20,  condition: 'Good',      lab: 'Physics Lab' },
  { name: 'Erlenmeyer Flask (500ml)',qty: 150, condition: 'Fair',      lab: 'Chemistry Lab' },
  { name: 'Human Skeleton Model',   qty: 5,   condition: 'Excellent', lab: 'Biology Lab' },
  { name: 'Desktop Computer (I7)',  qty: 30,  condition: 'Good',      lab: 'Computer Lab' },
  { name: 'Desktop Computer (I7)',  qty: 30,  condition: 'Good',      lab: 'Computer Lab' },
  { name: 'Microscope',             qty: 12,  condition: 'Excellent', lab: 'Biology Lab' },
  { name: 'Bunsen Burner',          qty: 40,  condition: 'Good',      lab: 'Chemistry Lab' },
  { name: 'Function Generator',     qty: 8,   condition: 'Fair',      lab: 'Physics Lab' },
  { name: 'Laptop (Core i5)',        qty: 25,  condition: 'Good',      lab: 'Computer Lab' },
  { name: 'Centrifuge',             qty: 3,   condition: 'Poor',      lab: 'Biology Lab' },
];

const activities = [
  { type: 'add',    icon: '+',  time: '10:30 AM, Oct 26', html: '<strong>John Doe</strong> added 20 Dell Computers to Computer Lab' },
  { type: 'warn',   icon: '!',  time: '10:30 AM, Oct 26', html: '<strong>Mary Smith</strong> reported damage to Digital Oscilloscope' },
  { type: 'update', icon: '✓',  time: '10:30 AM, Oct 26', html: 'System updated inventory logs' },
  { type: 'update', icon: '✓',  time: '10:30 AM, Oct 26', html: 'System updated inventory logs' },
];

let damageReports = [
  {
    id: 'DR-1042',
    item: 'Desktop Computer #22',
    description: 'Cannot boot and shows repeated disk error during startup.',
    lab: 'Computer Lab',
    status: 'Open',
    priority: 'Critical',
    assignee: 'IT Support Team',
    reporter: 'Mary Smith',
    updatedAt: 'Apr 13, 09:20',
    createdAt: 'Apr 13, 08:50',
    overdue: true,
  },
  {
    id: 'DR-1041',
    item: 'Digital Oscilloscope',
    description: 'Channel B stops reading after 15 minutes of use.',
    lab: 'Physics Lab',
    status: 'In Progress',
    priority: 'High',
    assignee: 'Lab Technician',
    reporter: 'John Doe',
    updatedAt: 'Apr 13, 08:10',
    createdAt: 'Apr 12, 15:40',
    overdue: false,
  },
  {
    id: 'DR-1039',
    item: 'Centrifuge Unit #1',
    description: 'Motor vibrates heavily and stops before cycle completes.',
    lab: 'Biology Lab',
    status: 'Open',
    priority: 'High',
    assignee: 'Maintenance Vendor',
    reporter: 'Emily Carter',
    updatedAt: 'Apr 12, 16:45',
    createdAt: 'Apr 12, 14:10',
    overdue: true,
  },
  {
    id: 'DR-1038',
    item: 'Erlenmeyer Flask (500ml)',
    description: 'Reported chipped rim on one batch after practical class.',
    lab: 'Chemistry Lab',
    status: 'Resolved',
    priority: 'Medium',
    assignee: 'Safety Officer',
    reporter: 'Nadia Putri',
    updatedAt: 'Apr 12, 13:30',
    createdAt: 'Apr 11, 11:10',
    overdue: false,
  },
  {
    id: 'DR-1037',
    item: 'Microscope #07',
    description: 'Focus knob is loose and image cannot stay stable.',
    lab: 'Biology Lab',
    status: 'Open',
    priority: 'Medium',
    assignee: 'Lab Assistant',
    reporter: 'Rudi Hartono',
    updatedAt: 'Apr 11, 14:20',
    createdAt: 'Apr 11, 10:15',
    overdue: false,
  },
  {
    id: 'DR-1035',
    item: 'Function Generator',
    description: 'Output frequency drifts beyond tolerance during testing.',
    lab: 'Physics Lab',
    status: 'In Progress',
    priority: 'Medium',
    assignee: 'Calibration Team',
    reporter: 'Farah Aulia',
    updatedAt: 'Apr 10, 17:00',
    createdAt: 'Apr 10, 09:25',
    overdue: false,
  },
  {
    id: 'DR-1034',
    item: 'Bunsen Burner #05',
    description: 'Gas control valve is stiff and difficult to close fully.',
    lab: 'Chemistry Lab',
    status: 'Resolved',
    priority: 'Low',
    assignee: 'Lab Technician',
    reporter: 'Dian Sari',
    updatedAt: 'Apr 10, 12:10',
    createdAt: 'Apr 09, 16:20',
    overdue: false,
  },
  {
    id: 'DR-1032',
    item: 'Projector Unit #2',
    description: 'Image is blurry and overheats after extended presentation use.',
    lab: 'Computer Lab',
    status: 'Open',
    priority: 'High',
    assignee: 'AV Support',
    reporter: 'Kevin Tan',
    updatedAt: 'Apr 09, 15:10',
    createdAt: 'Apr 09, 09:45',
    overdue: true,
  },
];

/* ===========================
   SESSION & AUTH
=========================== */
const SESSION_LAB     = sessionStorage.getItem('loggedInLab');
const SESSION_TEACHER = sessionStorage.getItem('loggedInTeacher');
const SESSION_EMAIL   = sessionStorage.getItem('loggedInEmail');

/** Navigate to login for a given lab */
window.goToLab = function(lab) {
  window.location.href = 'pages/login.html?lab=' + encodeURIComponent(lab);
};

/* ===========================
   PAGINATION STATE
=========================== */
let currentPage = 1;
const rowsPerPage = 5;
let filteredFacilities = [];
let currentDamageReportPage = 1;
const damageReportsPerPage = 6;
let filteredDamageReports = [];

/* ===========================
   INIT
=========================== */
document.addEventListener('DOMContentLoaded', () => {
  // Apply lab filter when coming from login
  if (SESSION_LAB) {
    filteredFacilities = facilities.filter(f => f.lab === SESSION_LAB);
    // Update the page heading to show lab context
    const heading = document.querySelector('.page-heading');
    if (heading) heading.textContent = 'Dashboard – ' + SESSION_LAB;

    // Update user display with teacher name
    const teacher = SESSION_TEACHER || 'Unknown';
    const initials = teacher.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
    const nameEl = document.querySelector('.user-name');
    const avatarEl = document.querySelector('.user-avatar');
    const profileEl = document.querySelector('#userDropdown a:first-child');
    if (nameEl) nameEl.textContent = teacher;
    if (avatarEl) avatarEl.textContent = initials;

    // Add logout to dropdown
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
      const logoutLink = dropdown.querySelector('a[style*="color:#f87171"]') ||
                         dropdown.querySelector('a:last-child');
      if (logoutLink) {
        logoutLink.textContent = 'Logout';
        logoutLink.onclick = (e) => {
          e.preventDefault();
          sessionStorage.clear();
          window.location.href = 'pages/login.html?lab=' + encodeURIComponent(SESSION_LAB);
        };
      }
    }

    // Highlight active lab in submenu
    document.querySelectorAll('.nav-sub-item').forEach(el => {
      if (el.textContent.includes(SESSION_LAB.replace(' Lab','').trim())) {
        el.style.color = 'var(--accent-blue)';
        el.style.fontWeight = '600';
      }
    });

    // Add a "Back to all labs" banner
    const banner = document.createElement('div');
    banner.className = 'lab-banner';
    banner.innerHTML = `
      <span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        </svg>
        Menampilkan data: <strong>${SESSION_LAB}</strong>
      </span>
      <button onclick="sessionStorage.clear(); window.location.href='index.html'">
        ✕ Keluar dari Lab
      </button>
    `;
    document.querySelector('.page-content').prepend(banner);
  } else {
    // No session: show all facilities
    filteredFacilities = [...facilities];
  }

  renderActivities();
  renderFacilities();
  updateStats();
  filteredDamageReports = [...damageReports];
  renderDamageReports();
  // open lab submenu by default
  toggleLabList();
});


/* ===========================
   STATS COUNTER
=========================== */
function updateStats() {
  const total = facilities.reduce((s, f) => s + f.qty, 0);
  document.getElementById('totalItems').textContent = total.toLocaleString();
  const active = damageReports.filter(r => r.status !== 'Resolved').length;
  const availability = Math.max(72, 100 - Math.round((active / Math.max(facilities.length, 1)) * 12));
  const activeReportsEl = document.getElementById('activeReports');
  const labAvailabilityEl = document.getElementById('labAvailability');
  if (activeReportsEl) activeReportsEl.textContent = active;
  if (labAvailabilityEl) labAvailabilityEl.textContent = availability + '%';
}

/* ===========================
   ACTIVITY FEED
=========================== */
function renderActivities() {
  const list = document.getElementById('activityList');
  list.innerHTML = activities.map(a => `
    <div class="activity-item">
      <div class="act-icon ${a.type}">${a.icon}</div>
      <div>
        <div class="act-time">${a.time}</div>
        <div class="act-text">${a.html}</div>
      </div>
    </div>
  `).join('');
}

/* ===========================
   FACILITIES TABLE
=========================== */
function renderFacilities() {
  const body = document.getElementById('facilitiesBody');
  const totalPages = Math.ceil(filteredFacilities.length / rowsPerPage);
  if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
  if (totalPages === 0) currentPage = 1;

  const start = (currentPage - 1) * rowsPerPage;
  const slice = filteredFacilities.slice(start, start + rowsPerPage);

  if (slice.length === 0) {
    body.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">No facilities found.</td></tr>`;
  } else {
    body.innerHTML = slice.map((f, i) => {
      const realIdx = facilities.indexOf(filteredFacilities[start + i]);
      return `
        <tr>
          <td style="color:var(--text-primary);font-weight:500">${escHtml(f.name)}</td>
          <td>${f.qty}</td>
          <td><span class="badge ${f.condition}">${f.condition}</span></td>
          <td>${escHtml(f.lab)}</td>
          <td class="action-links">
            <a onclick="editFacility(${realIdx})">[Edit]</a>
            <span> </span>
            <a onclick="viewFacility(${realIdx})">[View]</a>
          </td>
        </tr>
      `;
    }).join('');
  }

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const nums = document.getElementById('pageNumbers');
  nums.innerHTML = '';
  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.className = 'page-num' + (i === currentPage ? ' active' : '');
    btn.textContent = i;
    btn.onclick = () => { currentPage = i; renderFacilities(); };
    nums.appendChild(btn);
  }
  document.getElementById('prevBtn').disabled = currentPage <= 1;
  document.getElementById('nextBtn').disabled = currentPage >= totalPages;
}

window.changePage = function(dir) {
  const totalPages = Math.ceil(filteredFacilities.length / rowsPerPage);
  currentPage = Math.max(1, Math.min(totalPages, currentPage + dir));
  renderFacilities();
};

/* ===========================
   SEARCH / FILTER
=========================== */
window.filterFacilities = function() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  filteredFacilities = facilities.filter(f =>
    f.name.toLowerCase().includes(q) ||
    f.lab.toLowerCase().includes(q) ||
    f.condition.toLowerCase().includes(q)
  );
  currentPage = 1;
  renderFacilities();
};

/* ===========================
   DAMAGE REPORTS PAGE
=========================== */
window.showPage = function(page) {
  document.querySelectorAll('.page-panel').forEach(panel => panel.classList.add('hidden'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });
};

function renderDamageReports() {
  renderDamageReportStats();
  renderLabReportSummary();
  renderUrgentReportList();
  renderDamageReportTable();
}

function renderDamageReportStats() {
  const total = damageReports.length;
  const open = damageReports.filter(r => r.status === 'Open').length;
  const progress = damageReports.filter(r => r.status === 'In Progress').length;
  const critical = damageReports.filter(r => r.priority === 'Critical' || r.overdue).length;

  setTextIfExists('reportsTotal', total);
  setTextIfExists('reportsOpen', open);
  setTextIfExists('reportsProgress', progress);
  setTextIfExists('reportsCritical', critical);
}

function renderLabReportSummary() {
  const container = document.getElementById('labReportList');
  if (!container) return;

  const labs = ['Computer Lab', 'Physics Lab', 'Chemistry Lab', 'Biology Lab'];
  const summary = labs.map(lab => {
    const reports = damageReports.filter(r => r.lab === lab);
    const active = reports.filter(r => r.status !== 'Resolved').length;
    const critical = reports.filter(r => r.priority === 'Critical' || r.priority === 'High').length;
    const ratio = totalPercent(active, damageReports.filter(r => r.status !== 'Resolved').length || 1);
    return { lab, total: reports.length, active, critical, ratio };
  });

  container.innerHTML = summary.map(item => `
    <div class="lab-report-item">
      <div class="lab-report-top">
        <div class="lab-report-name">${escHtml(item.lab)}</div>
        <span class="badge ${item.active > 0 ? 'open' : 'resolved'}">${item.active} active</span>
      </div>
      <div class="lab-report-meta">
        <span>${item.total} total reports</span>
        <span>•</span>
        <span>${item.critical} high priority</span>
      </div>
      <div class="lab-report-progress"><span style="width:${item.ratio}%"></span></div>
    </div>
  `).join('');
}

function renderUrgentReportList() {
  const container = document.getElementById('urgentReportList');
  if (!container) return;

  const urgent = [...damageReports]
    .filter(r => r.status !== 'Resolved')
    .sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority) || Number(b.overdue) - Number(a.overdue))
    .slice(0, 5);

  container.innerHTML = urgent.map(report => `
    <div class="urgent-report-item">
      <div class="urgent-report-top">
        <div class="urgent-report-name">${escHtml(report.item)}</div>
        <span class="badge ${priorityClass(report.priority)}">${escHtml(report.priority)}</span>
      </div>
      <div class="urgent-report-meta">
        <span>${escHtml(report.lab)}</span>
        <span>•</span>
        <span>${escHtml(report.status)}</span>
        <span>•</span>
        <span>${report.overdue ? 'Overdue' : 'Updated ' + escHtml(report.updatedAt)}</span>
      </div>
      <p class="urgent-report-description">${escHtml(report.description)}</p>
    </div>
  `).join('') || '<div class="urgent-report-item"><div class="urgent-report-name">No urgent reports.</div></div>';
}

function renderDamageReportTable() {
  const body = document.getElementById('damageReportsBody');
  const totalPages = Math.ceil(filteredDamageReports.length / damageReportsPerPage);
  if (currentDamageReportPage > totalPages && totalPages > 0) currentDamageReportPage = totalPages;
  if (totalPages === 0) currentDamageReportPage = 1;

  const start = (currentDamageReportPage - 1) * damageReportsPerPage;
  const slice = filteredDamageReports.slice(start, start + damageReportsPerPage);

  if (!body) return;

  if (slice.length === 0) {
    body.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">No damage reports found.</td></tr>';
  } else {
    body.innerHTML = slice.map((report, i) => {
      const realIdx = damageReports.indexOf(filteredDamageReports[start + i]);
      return `
        <tr>
          <td>
            <div style="color:var(--text-primary);font-weight:600">${escHtml(report.id)}</div>
            <div style="font-size:12px;color:var(--text-faint);margin-top:4px">${escHtml(report.item)}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:3px">Reported by ${escHtml(report.reporter)}</div>
          </td>
          <td>${escHtml(report.lab)}</td>
          <td><span class="badge ${statusClass(report.status)}">${escHtml(report.status)}</span></td>
          <td><span class="badge ${priorityClass(report.priority)}">${escHtml(report.priority)}</span></td>
          <td>${escHtml(report.assignee)}</td>
          <td>${escHtml(report.updatedAt)}</td>
          <td class="action-links">
            <a onclick="viewDamageReport(${realIdx})">[View]</a>
            <span> </span>
            <a onclick="advanceDamageReport(${realIdx})">[Advance]</a>
          </td>
        </tr>
      `;
    }).join('');
  }

  renderDamageReportPagination(totalPages);
}

function renderDamageReportPagination(totalPages) {
  const nums = document.getElementById('reportsPageNumbers');
  if (!nums) return;
  nums.innerHTML = '';
  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.className = 'page-num' + (i === currentDamageReportPage ? ' active' : '');
    btn.textContent = i;
    btn.onclick = () => { currentDamageReportPage = i; renderDamageReportTable(); };
    nums.appendChild(btn);
  }
  document.getElementById('reportsPrevBtn').disabled = currentDamageReportPage <= 1;
  document.getElementById('reportsNextBtn').disabled = currentDamageReportPage >= totalPages;
}

window.changeDamageReportPage = function(dir) {
  const totalPages = Math.ceil(filteredDamageReports.length / damageReportsPerPage);
  currentDamageReportPage = Math.max(1, Math.min(totalPages, currentDamageReportPage + dir));
  renderDamageReportTable();
};

window.filterDamageReports = function() {
  const q = valueLower('reportSearchInput');
  const lab = valueOf('reportLabFilter');
  const status = valueOf('reportStatusFilter');
  const priority = valueOf('reportPriorityFilter');

  filteredDamageReports = damageReports.filter(report => {
    const matchesText = !q || [report.id, report.item, report.lab, report.reporter, report.assignee, report.description]
      .some(value => String(value).toLowerCase().includes(q));
    const matchesLab = !lab || report.lab === lab;
    const matchesStatus = !status || report.status === status;
    const matchesPriority = !priority || report.priority === priority;
    return matchesText && matchesLab && matchesStatus && matchesPriority;
  });

  currentDamageReportPage = 1;
  renderDamageReports();
};

window.addDamageReport = function() {
  const item = valueOf('damageItemName').trim();
  const description = valueOf('damageDescription').trim();
  const lab = valueOf('damageLab');
  const priority = valueOf('damagePriority');
  const status = valueOf('damageStatus');
  const assignee = valueOf('damageAssignee').trim() || 'Unassigned';
  const reporter = valueOf('damageReporter').trim() || 'Unknown';

  if (!item || !description) {
    showToast('Please enter the item name and description.');
    return;
  }

  const report = {
    id: nextDamageReportId(),
    item,
    description,
    lab,
    status,
    priority,
    assignee,
    reporter,
    updatedAt: nowStr(),
    createdAt: nowStr(),
    overdue: priority === 'Critical' && status !== 'Resolved',
  };

  damageReports.unshift(report);
  filteredDamageReports = [...damageReports];
  closeModal('addDamageReportModal');
  renderDamageReports();
  updateStats();
  activities.unshift({
    type: 'warn',
    icon: '!',
    time: nowStr(),
    html: `<strong>${escHtml(reporter)}</strong> reported damage to ${escHtml(item)}`
  });
  renderActivities();
  resetDamageReportForm();
  showToast('✓ Damage report created successfully!');
};

window.viewDamageReport = function(idx) {
  const report = damageReports[idx];
  document.getElementById('viewDamageReportBody').innerHTML = `
    <div class="detail-list">
      <div class="detail-item"><span>Report ID</span><span>${escHtml(report.id)}</span></div>
      <div class="detail-item"><span>Item</span><span>${escHtml(report.item)}</span></div>
      <div class="detail-item"><span>Laboratory</span><span>${escHtml(report.lab)}</span></div>
      <div class="detail-item"><span>Status</span><span><span class="badge ${statusClass(report.status)}">${escHtml(report.status)}</span></span></div>
      <div class="detail-item"><span>Priority</span><span><span class="badge ${priorityClass(report.priority)}">${escHtml(report.priority)}</span></span></div>
      <div class="detail-item"><span>Assigned To</span><span>${escHtml(report.assignee)}</span></div>
      <div class="detail-item"><span>Reporter</span><span>${escHtml(report.reporter)}</span></div>
      <div class="detail-item"><span>Updated</span><span>${escHtml(report.updatedAt)}</span></div>
      <div class="detail-item" style="display:block">
        <span style="display:block;margin-bottom:8px;color:var(--text-muted)">Description</span>
        <span style="display:block;color:var(--text-primary);font-weight:500;line-height:1.6">${escHtml(report.description)}</span>
      </div>
    </div>
  `;
  openModal('viewDamageReportModal');
};

window.advanceDamageReport = function(idx) {
  const report = damageReports[idx];
  if (report.status === 'Open') report.status = 'In Progress';
  else if (report.status === 'In Progress') report.status = 'Resolved';
  else report.status = 'Open';
  report.updatedAt = nowStr();
  report.overdue = report.status !== 'Resolved' && (report.priority === 'Critical' || report.priority === 'High');
  renderDamageReports();
  updateStats();
  showToast('✓ Damage report updated successfully!');
};

function nextDamageReportId() {
  const max = damageReports.reduce((current, report) => Math.max(current, parseInt(report.id.replace(/\D/g, ''), 10) || 0), 0);
  return 'DR-' + String(max + 1).padStart(4, '0');
}

function resetDamageReportForm() {
  ['damageItemName', 'damageDescription', 'damageAssignee', 'damageReporter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const labEl = document.getElementById('damageLab');
  const priorityEl = document.getElementById('damagePriority');
  const statusEl = document.getElementById('damageStatus');
  if (labEl) labEl.value = 'Computer Lab';
  if (priorityEl) priorityEl.value = 'Medium';
  if (statusEl) statusEl.value = 'Open';
}

function totalPercent(value, total) {
  return Math.max(8, Math.round((value / total) * 100));
}

function priorityWeight(priority) {
  return { Critical: 4, High: 3, Medium: 2, Low: 1 }[priority] || 0;
}

function priorityClass(priority) {
  return { Critical: 'critical', High: 'high', Medium: 'medium', Low: 'low' }[priority] || 'low';
}

function statusClass(status) {
  return { Open: 'open', 'In Progress': 'progress', Resolved: 'resolved' }[status] || 'open';
}

function valueOf(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function valueLower(id) {
  return valueOf(id).toLowerCase();
}

function setTextIfExists(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/* ===========================
   MODALS
=========================== */
window.openModal = function(id) {
  document.getElementById(id).classList.add('open');
};
window.closeModal = function(id) {
  document.getElementById(id).classList.remove('open');
};
window.closeModalOutside = function(e) {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
};

/* ADD FACILITY */
window.addFacility = function() {
  const name = document.getElementById('facilityName').value.trim();
  const qty  = parseInt(document.getElementById('facilityQty').value) || 0;
  const cond = document.getElementById('facilityCondition').value;
  const lab  = document.getElementById('facilityLab').value;

  if (!name) { alert('Please enter a facility name.'); return; }

  facilities.push({ name, qty, condition: cond, lab });
  filteredFacilities = [...facilities];

  // Clear form
  ['facilityName','facilityQty'].forEach(id => document.getElementById(id).value = '');

  closeModal('addFacilityModal');
  updateStats();
  renderFacilities();

  // Log activity
  activities.unshift({
    type: 'add', icon: '+',
    time: nowStr(),
    html: `<strong>You</strong> added ${qty} ${escHtml(name)} to ${escHtml(lab)}`
  });
  renderActivities();
  showToast('✓ Facility added successfully!');
};

/* EDIT FACILITY */
window.editFacility = function(idx) {
  const f = facilities[idx];
  document.getElementById('editFacilityIndex').value = idx;
  document.getElementById('editFacilityName').value = f.name;
  document.getElementById('editFacilityQty').value  = f.qty;
  setSelectValue('editFacilityCondition', f.condition);
  setSelectValue('editFacilityLab', f.lab);
  openModal('editFacilityModal');
};

window.saveEditFacility = function() {
  const idx  = parseInt(document.getElementById('editFacilityIndex').value);
  const name = document.getElementById('editFacilityName').value.trim();
  const qty  = parseInt(document.getElementById('editFacilityQty').value) || 0;
  const cond = document.getElementById('editFacilityCondition').value;
  const lab  = document.getElementById('editFacilityLab').value;

  if (!name) { alert('Please enter a facility name.'); return; }

  facilities[idx] = { name, qty, condition: cond, lab };
  filteredFacilities = [...facilities];

  closeModal('editFacilityModal');
  updateStats();
  renderFacilities();

  activities.unshift({
    type: 'update', icon: '✓',
    time: nowStr(),
    html: `<strong>You</strong> updated ${escHtml(name)}`
  });
  renderActivities();
  showToast('✓ Facility updated successfully!');
};

/* VIEW FACILITY */
window.viewFacility = function(idx) {
  const f = facilities[idx];
  document.getElementById('viewModalBody').innerHTML = `
    <div class="detail-list">
      <div class="detail-item"><span>Name</span><span>${escHtml(f.name)}</span></div>
      <div class="detail-item"><span>Quantity</span><span>${f.qty}</span></div>
      <div class="detail-item"><span>Condition</span><span><span class="badge ${f.condition}">${f.condition}</span></span></div>
      <div class="detail-item"><span>Laboratory</span><span>${escHtml(f.lab)}</span></div>
    </div>
  `;
  openModal('viewFacilityModal');
};

/* ===========================
   SIDEBAR / NAV TOGGLES
=========================== */
window.toggleLabList = function() {
  const sub     = document.getElementById('labSubMenu');
  const chevron = document.getElementById('labChevron');
  sub.classList.toggle('open');
  chevron.classList.toggle('open');
};

window.toggleSidebar = function() {
  document.getElementById('sidebar').classList.toggle('mobile-open');
};

// Nav active state
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', function() {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    this.classList.add('active');
  });
});

/* ===========================
   USER DROPDOWN
=========================== */
window.toggleUserMenu = function() {
  document.getElementById('userDropdown').classList.toggle('open');
};

document.addEventListener('click', e => {
  const wrapper = document.querySelector('.user-avatar-wrapper');
  if (wrapper && !wrapper.contains(e.target)) {
    document.getElementById('userDropdown').classList.remove('open');
  }
});

/* ===========================
   UTILITIES
=========================== */
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function nowStr() {
  const d = new Date();
  return d.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' }) +
         ', ' + d.toLocaleDateString('en-US', { month:'short', day:'numeric' });
}

function setSelectValue(id, val) {
  const sel = document.getElementById(id);
  for (let o of sel.options) { if (o.value === val) { o.selected = true; break; } }
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

/* ===========================
   SETTINGS
=========================== */
function loadSettings() {
  const theme = localStorage.getItem('theme') || 'dark';
  const language = localStorage.getItem('language') || 'id';
  const notifications = localStorage.getItem('notifications') !== 'false';
  const autoSave = localStorage.getItem('autoSave') !== 'false';

  if (document.getElementById('themeSetting')) {
    document.getElementById('themeSetting').value = theme;
  }
  if (document.getElementById('languageSetting')) {
    document.getElementById('languageSetting').value = language;
  }
  if (document.getElementById('notificationSetting')) {
    document.getElementById('notificationSetting').checked = notifications;
  }
  if (document.getElementById('autoSaveSetting')) {
    document.getElementById('autoSaveSetting').checked = autoSave;
  }
  
  // Load user info
  const teacher = SESSION_TEACHER || 'Dr. Emily Carter';
  const email = SESSION_EMAIL || 'emily@labflow.id';
  const lab = SESSION_LAB || 'Computer Lab';
  
  if (document.getElementById('usernameSetting')) {
    document.getElementById('usernameSetting').value = teacher;
  }
  if (document.getElementById('emailSetting')) {
    document.getElementById('emailSetting').value = email;
  }
  if (document.getElementById('labProfileSetting')) {
    document.getElementById('labProfileSetting').value = lab;
  }
  
  updateStorageInfo();
}

function saveSettings() {
  const theme = document.getElementById('themeSetting')?.value || 'dark';
  const language = document.getElementById('languageSetting')?.value || 'id';
  const notifications = document.getElementById('notificationSetting')?.checked || false;
  const autoSave = document.getElementById('autoSaveSetting')?.checked || false;

  localStorage.setItem('theme', theme);
  localStorage.setItem('language', language);
  localStorage.setItem('notifications', notifications);
  localStorage.setItem('autoSave', autoSave);

  // Apply theme
  applyTheme(theme);

  showToast('Settings saved successfully!');
}

function resetSettings() {
  loadSettings();
  showToast('Settings reset to previous values');
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light') {
    root.style.setProperty('--bg-primary', '#ffffff');
    root.style.setProperty('--bg-secondary', '#f5f5f5');
    root.style.setProperty('--text-primary', '#1a1a1a');
    root.style.setProperty('--text-muted', '#666666');
  } else {
    root.style.setProperty('--bg-primary', '#0f172a');
    root.style.setProperty('--bg-secondary', '#1e293b');
    root.style.setProperty('--text-primary', '#e4e4e7');
    root.style.setProperty('--text-muted', '#94a3b8');
  }
}

function exportDataAsJSON() {
  const data = {
    facilities: facilities,
    damageReports: damageReports,
    exportDate: new Date().toISOString(),
    laboratory: SESSION_LAB || 'All Labs',
  };
  
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `labflow_backup_${new Date().getTime()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  
  showToast('Data exported as JSON successfully!');
}

function exportDataAsCSV() {
  let csv = 'NAME,QUANTITY,CONDITION,LAB\n';
  facilities.forEach(f => {
    csv += `"${f.name}",${f.qty},"${f.condition}","${f.lab}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `labflow_facilities_${new Date().getTime()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  
  showToast('Data exported as CSV successfully!');
}

function clearCache() {
  if (confirm('This will delete all cache. Continue?')) {
    sessionStorage.clear();
    localStorage.removeItem('theme');
    localStorage.removeItem('language');
    showToast('Cache cleared successfully!');
  }
}

function resetApplication() {
  if (confirm('WARNING: This will delete ALL data and reset to default. Are you sure?')) {
    if (confirm('Ini tidak dapat dibatalkan. Ketik "YA" untuk potong')) {
      sessionStorage.clear();
      localStorage.clear();
      location.href = 'index.html';
    }
  }
}

function changePassword() {
  const oldPass = document.getElementById('oldPassword')?.value;
  const newPass = document.getElementById('newPassword')?.value;
  const confirmPass = document.getElementById('confirmPassword')?.value;

  if (!oldPass || !newPass || !confirmPass) {
    showToast('All fields must be filled!');
    return;
  }

  if (newPass !== confirmPass) {
    showToast('New password does not match!');
    return;
  }

  if (newPass.length < 6) {
    showToast('Password must be at least 6 characters!');
    return;
  }

  // Simulate password change (in real app, validate with server)
  showToast('Password changed successfully!');
  closeModal('changePasswordModal');
  document.getElementById('oldPassword').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('confirmPassword').value = '';
}

function updateStorageInfo() {
  let storageSize = 0;
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      storageSize += localStorage[key].length + key.length;
    }
  }
  
  const sizeKB = (storageSize / 1024).toFixed(2);
  const info = document.getElementById('storageInfo');
  if (info) {
    info.textContent = `LocalStorage: ${sizeKB} KB / Total: Unlimited`;
  }
}

function showHelp() {
  const helpText = `LABFLOW PRO USER GUIDE

1. DASHBOARD
   - View lab statistics (total items, active reports, availability)
   - Monitor recent activity
   - Access facilities summary

2. FACILITY MANAGEMENT
   - Add new facility by clicking "+ Add New Facility"
   - Edit or view facility details
   - Filter by name or laboratory

3. DAMAGE REPORTS
   - Create new damage report by clicking "+ Create Report"
   - Track repair status (Open, In Progress, Resolved)
   - Filter by priority and status

4. SETTINGS
   - Configure application theme (dark/light)
   - Backup and restore data
   - Manage account and password

For assistance, contact support@labflow.id
  `;
  alert(helpText);
}

function showFeedback() {
  const feedback = prompt('Send your feedback or bug report:');
  if (feedback) {
    console.log('Feedback:', feedback);
    showToast('Thank you for your feedback!');
  }
}

// Initialize settings on page load
document.addEventListener('DOMContentLoaded', () => {
  // ... existing code ...
  setTimeout(loadSettings, 100);
});
