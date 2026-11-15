const API_BASE = 'http://localhost:5001/api';
let allEventsCache = [];

function checkAuthNavbar() {
  const user = JSON.parse(localStorage.getItem('dazz_user'));
  const navAuthArea = document.getElementById('navAuthArea');
  const navDashboard = document.getElementById('navDashboard');

  if (user && navAuthArea) {
    navAuthArea.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="color: #1a1446; font-weight: 700; font-size: 13.5px;">${user.name} (${user.role})</span>
        <button onclick="logoutUser()" class="btn-primary-pill" style="padding: 6px 14px; font-size: 12px; background: #c53030;">Logout</button>
      </div>
    `;

    if (navDashboard) navDashboard.style.display = 'inline-block';
  }
}

function logoutUser() {
  localStorage.removeItem('dazz_user');
  window.location.reload();
}

async function loadCatalogEvents() {
  const city = document.getElementById('catalogCity').value;
  const category = document.getElementById('catalogCategory').value;
  const mode = document.getElementById('catalogMode').value;
  const container = document.getElementById('catalogGrid');

  container.innerHTML = `<div style="color: #c9c4eb; grid-column: 1/-1;">Executing relational query on database...</div>`;

  const url = new URL(`${API_BASE}/events`);
  if (city && city !== 'All cities') url.searchParams.append('city', city);
  if (category && category !== 'All categories') url.searchParams.append('category', category);

  try {
    const res = await fetch(url);
    let events = await res.json();

    if (mode !== 'All') {
      events = events.filter(e => e.participation_mode === mode);
    }

    allEventsCache = events;
    renderCatalogCards(events);
  } catch (err) {
    container.innerHTML = `<div style="color: #ff8b8b; grid-column: 1/-1;">Error resolving events: ${err.message}</div>`;
  }
}

function renderCatalogCards(events) {
  const container = document.getElementById('catalogGrid');

  if (!events || events.length === 0) {
    container.innerHTML = `<div style="color: #c9c4eb; grid-column: 1/-1; padding: 20px;">No events matching your filter selections.</div>`;
    return;
  }

  const currentUser = JSON.parse(localStorage.getItem('dazz_user'));
  const isNonStudent = currentUser && currentUser.role !== 'Student';

  container.innerHTML = '';
  events.forEach(ev => {
    const dateObj = new Date(ev.start_date);
    const dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const priceTag = ev.is_paid && ev.ticket_price > 0 ? `INR ${parseFloat(ev.ticket_price)}` : 'Free';

    // Strictly hide Register button for Organisers & Admins
    const registerActionHtml = isNonStudent
      ? `<span style="font-size: 11.5px; font-weight: 700; color: #64748b; padding: 9px 10px; background: #f1f5f9; border-radius: 8px; text-align: center; flex: 1;">View Only (${currentUser.role})</span>`
      : `<button class="btn-register" onclick="openRegisterModal(${ev.event_id}, '${ev.participation_mode}', '${escape(ev.title)}')">Register</button>`;

    const card = `
      <div class="event-card" style="min-width: 100%; max-width: 100%;">
        <div>
          <div class="card-top">
            <span class="badge-tag">${ev.category || 'General'}</span>
            <span class="card-price">${priceTag}</span>
          </div>
          <h3 class="event-name">${ev.title}</h3>
          <p class="event-inst">${ev.host_institution}</p>
          <div class="event-meta">
            <div class="meta-row">
              <i class="fa-regular fa-calendar"></i>
              <span>${dateStr}, ${timeStr}</span>
            </div>
            <div class="meta-row">
              <i class="fa-solid fa-location-dot"></i>
              <span>${ev.event_venue}, ${ev.event_city}</span>
            </div>
          </div>
          <div class="card-tags">
            <span class="sub-tag">${ev.scope}-college</span>
            <span class="sub-tag">${ev.participation_mode}</span>
          </div>
        </div>
        <div class="card-actions">
          <button class="btn-details" onclick="openDetailsModal(${ev.event_id})">View details</button>
          ${registerActionHtml}
        </div>
      </div>
    `;
    container.innerHTML += card;
  });
}

function filterLocalCatalog() {
  const q = document.getElementById('catalogSearch').value.toLowerCase();
  const filtered = allEventsCache.filter(e => e.title.toLowerCase().includes(q));
  renderCatalogCards(filtered);
}

function resetCatalogFilters() {
  document.getElementById('catalogCity').value = 'All cities';
  document.getElementById('catalogCategory').value = 'All categories';
  document.getElementById('catalogMode').value = 'All';
  document.getElementById('catalogSearch').value = '';
  loadCatalogEvents();
}

async function openDetailsModal(eventId) {
  const modal = document.getElementById('detailsModal');
  const body = document.getElementById('modalEventBody');
  const regBtn = document.getElementById('modalRegisterBtn');

  modal.classList.remove('d-none');
  body.innerHTML = `<p>Loading event record from MySQL...</p>`;

  try {
    const res = await fetch(`${API_BASE}/events/${eventId}`);
    const ev = await res.json();

    document.getElementById('modalEventTitle').innerText = ev.title;

    const startDate = new Date(ev.start_date).toLocaleString('en-GB', { 
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true 
    });
    const endDate = new Date(ev.end_date).toLocaleString('en-GB', { 
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true 
    });

    const degreesBadgeList = ev.eligible_degrees && ev.eligible_degrees.length > 0
      ? ev.eligible_degrees.map(d => `<span style="background: #eef2ff; color: #4338ca; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 12px; margin-right: 4px;">${d}</span>`).join('')
      : '<span style="color: #059669; font-weight: 600;">Unrestricted Course Eligibility</span>';

    const priceText = ev.is_paid && ev.ticket_price > 0 ? `INR ${parseFloat(ev.ticket_price)}` : 'Free Entry';

    body.innerHTML = `
      <div style="display: flex; gap: 8px; margin-bottom: 14px;">
        <span class="badge-tag" style="background: #e0e7ff; color: #4338ca;">${ev.category}</span>
        <span class="badge-tag" style="background: #fef3c7; color: #b45309;">${ev.scope}-College</span>
        <span class="badge-tag" style="background: #ecfdf5; color: #047857;">${priceText}</span>
      </div>

      <p style="margin-bottom: 16px; font-size: 14px; line-height: 1.6; color: #4b5563;">
        ${ev.description || 'No formal narrative supplied.'}
      </p>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; display: grid; gap: 8px; font-size: 13px;">
        <div><strong>Host Institution:</strong> ${ev.host_institution} (${ev.campus_address})</div>
        <div><strong>Scheduled Venue:</strong> ${ev.event_venue}, ${ev.event_city}</div>
        <div><strong>Commences:</strong> ${startDate}</div>
        <div><strong>Concludes:</strong> ${endDate}</div>
        <div><strong>Format:</strong> ${ev.participation_mode} (Team limits: ${ev.min_team_size} to ${ev.max_team_size} individuals)</div>
        <div><strong>Seating Quota:</strong> ${ev.max_seats} total</div>
        <div style="margin-top: 4px;"><strong>Degree Prerequisites:</strong> <div style="margin-top: 6px;">${degreesBadgeList}</div></div>
      </div>
    `;

    const currentUser = JSON.parse(localStorage.getItem('dazz_user'));
    if (currentUser && currentUser.role !== 'Student') {
      regBtn.style.display = 'none';
    } else {
      regBtn.style.display = 'inline-block';
      regBtn.onclick = () => {
        closeModal('detailsModal');
        openRegisterModal(ev.event_id, ev.participation_mode, escape(ev.title));
      };
    }

  } catch (err) {
    body.innerHTML = `<div style="color: #ef4444;">Failed to resolve event record: ${err.message}</div>`;
  }
}

function openRegisterModal(eventId, mode, unescapedTitle) {
  const user = JSON.parse(localStorage.getItem('dazz_user'));
  if (!user) {
    alert('Authentication required: Sign in or create an account to proceed with registration.');
    window.location.href = 'home.html';
    return;
  }

  // Strictly block Organisers and Admins from registering
  if (user.role !== 'Student') {
    alert(`Access Restricted: Logged in as ${user.role}. Only Student accounts can participate in events.`);
    return;
  }

  const title = unescape(unescapedTitle);
  document.getElementById('regEventId').value = eventId;
  document.getElementById('regEventMode').value = mode;
  document.getElementById('regModalTitle').innerText = `Register: ${title}`;

  document.getElementById('regStudentName').value = user.name;
  document.getElementById('regStudentEmail').value = user.email;

  const teamGroup = document.getElementById('teamNameGroup');
  if (mode === 'Team') {
    teamGroup.classList.remove('d-none');
  } else {
    teamGroup.classList.add('d-none');
  }

  const alertBox = document.getElementById('regAlert');
  alertBox.className = 'alert-box d-none';
  alertBox.innerText = '';

  document.getElementById('registerModal').classList.remove('d-none');
}

async function submitRegistration() {
  const user = JSON.parse(localStorage.getItem('dazz_user'));

  if (!user || user.role !== 'Student') {
    alert('Access Denied: Only Student accounts can submit registrations.');
    return;
  }

  const eventId = document.getElementById('regEventId').value;
  const mode = document.getElementById('regEventMode').value;
  const teamName = document.getElementById('regTeamName').value;
  const alertBox = document.getElementById('regAlert');

  if (mode === 'Team' && !teamName.trim()) {
    alertBox.className = 'alert-box error';
    alertBox.innerText = 'Team identifier is mandatory for team-based submissions.';
    return;
  }

  try {
    const payload = {
      event_id: parseInt(eventId),
      student_id: user ? user.user_id : 4,
      participation_mode: mode,
      team_name: mode === 'Team' ? teamName : null,
      members: mode === 'Team' ? [
        { name: user.name, email: user.email, degree: 'Student', roll: 'PRIMARY-LEAD' }
      ] : []
    };

    const res = await fetch(`${API_BASE}/registrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (res.ok) {
      alertBox.className = 'alert-box success';
      alertBox.innerHTML = `Transaction committed. Ticket Code: <strong>${result.ticket_code}</strong>`;
      setTimeout(() => {
        closeModal('registerModal');
      }, 2500);
    } else {
      alertBox.className = 'alert-box error';
      alertBox.innerText = result.error || 'Registration failed.';
    }
  } catch (err) {
    alertBox.className = 'alert-box error';
    alertBox.innerText = `Network communication fault: ${err.message}`;
  }
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.add('d-none');
}

window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const cat = params.get('category');
  if (cat) {
    const select = document.getElementById('catalogCategory');
    if (select) select.value = cat;
  }

  checkAuthNavbar();
  loadCatalogEvents();
});