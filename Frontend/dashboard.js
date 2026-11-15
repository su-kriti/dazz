const API_BASE = 'http://localhost:5001/api';

function checkAuthSession() {
  const user = JSON.parse(localStorage.getItem('dazz_user'));
  const navAuthArea = document.getElementById('navAuthArea');
  const userProfileHeader = document.getElementById('userProfileHeader');

  if (!user) {
    alert('Access restricted: Please log in to view your dashboard.');
    window.location.href = 'home.html';
    return null;
  }

  if (navAuthArea) {
    navAuthArea.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="color: #1a1446; font-weight: 700; font-size: 13.5px;">${user.name} (${user.role})</span>
        <button onclick="logoutUser()" class="btn-primary-pill" style="padding: 6px 14px; font-size: 12px; background: #c53030;">Logout</button>
      </div>
    `;
  }

  if (userProfileHeader) {
    userProfileHeader.innerHTML = `
      <div><strong>${user.name}</strong></div>
      <div style="color: #c9c4eb; font-size: 12.5px;">${user.email} • ${user.college_name || 'Academic Institution'}</div>
    `;
  }

  return user;
}

function logoutUser() {
  localStorage.removeItem('dazz_user');
  window.location.href = 'home.html';
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.add('d-none');
}

// ============================================================================
// ROLE INITIALIZATION
// ============================================================================

async function initializeDashboard() {
  const user = checkAuthSession();
  if (!user) return;

  const isAdmin = (user.role === 'InstitutionAdmin' || user.role === 'Admin');
  const isOrganizer = (user.role === 'Organiser');

  if (isAdmin) {
    document.getElementById('dashboardTitle').innerText = 'Institution Admin Panel';
    document.getElementById('dashboardSubtitle').innerText = `Administrative oversight for ${user.college_name || 'your institution'}.`;
    document.getElementById('adminDashboardView').classList.remove('d-none');
    document.getElementById('organiserDashboardView').classList.add('d-none');
    document.getElementById('studentDashboardView').classList.add('d-none');
    loadPendingOrganisers();
    loadPendingEvents();

  } else if (isOrganizer) {
    document.getElementById('dashboardTitle').innerText = 'Organiser Dashboard';
    document.getElementById('dashboardSubtitle').innerText = 'Manage your events, verify gate tickets, and inspect rosters.';
    document.getElementById('organiserDashboardView').classList.remove('d-none');
    document.getElementById('adminDashboardView').classList.add('d-none');
    document.getElementById('studentDashboardView').classList.add('d-none');
    checkOrganiserVerificationStatus(user);
    loadOrganiserDashboard(user);
    loadOrganiserGalleries(user);

  } else {
    document.getElementById('dashboardTitle').innerText = 'Student Dashboard';
    document.getElementById('dashboardSubtitle').innerText = 'Your digital event passes and participation records.';
    document.getElementById('studentDashboardView').classList.remove('d-none');
    document.getElementById('organiserDashboardView').classList.add('d-none');
    document.getElementById('adminDashboardView').classList.add('d-none');
    loadStudentRegistrations(user);
  }
}

// ============================================================================
// 1. ORGANISER VERIFICATION STATUS
// ============================================================================

async function checkOrganiserVerificationStatus(user) {
  const banner = document.getElementById('orgVerificationBanner');
  const btnAddUpcoming = document.getElementById('btnAddUpcoming');
  const btnAddGallery = document.getElementById('btnAddGallery');

  try {
    const res = await fetch(`${API_BASE}/users/${user.user_id}/status`);
    const statusData = await res.json();
    const isVerified = statusData.is_email_verified === 1;

    user.is_email_verified = statusData.is_email_verified;
    localStorage.setItem('dazz_user', JSON.stringify(user));

    if (isVerified) {
      banner.style.background = '#f0fdf4';
      banner.style.borderLeft = '5px solid #16a34a';
      banner.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div>
            <strong style="color: #166534;">Account Status: Verified Organiser</strong>
            <p style="color: #4b5563; font-size: 13px; margin-top: 2px;">Your identity is authenticated by your Institution Administrator. You have full publishing privileges.</p>
          </div>
          <span class="badge-verified">VERIFIED</span>
        </div>
      `;
      btnAddUpcoming.style.pointerEvents = 'auto';
      btnAddUpcoming.style.opacity = '1';
      if (btnAddGallery) {
        btnAddGallery.disabled = false;
        btnAddGallery.style.opacity = '1';
        btnAddGallery.style.cursor = 'pointer';
      }
    } else {
      banner.style.background = '#fffbeb';
      banner.style.borderLeft = '5px solid #d97706';
      banner.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div>
            <strong style="color: #92400e;">Account Status: Pending Verification</strong>
            <p style="color: #6b7280; font-size: 13px; margin-top: 2px;">Your account is awaiting approval from your Institution Admin. Event publishing and gallery uploads are locked until verified.</p>
          </div>
          <span class="badge-pending">PENDING VERIFICATION</span>
        </div>
      `;
      btnAddUpcoming.style.pointerEvents = 'none';
      btnAddUpcoming.style.opacity = '0.4';
      if (btnAddGallery) {
        btnAddGallery.disabled = true;
        btnAddGallery.style.opacity = '0.4';
        btnAddGallery.style.cursor = 'not-allowed';
      }
    }
  } catch (err) {
    console.error('Failed to verify status:', err);
  }
}

// ============================================================================
// 2. INSTITUTION ADMIN FUNCTIONS
// ============================================================================

async function loadPendingOrganisers() {
  const user = JSON.parse(localStorage.getItem('dazz_user'));
  const tbody = document.getElementById('pendingOrganisersTbody');

  try {
    const res = await fetch(`${API_BASE}/admin/organizers/pending/${user.institution_id || 1}`);
    const requests = await res.json();

    if (!requests || requests.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #797e93; padding: 20px;">No pending organiser verification requests for your institution.</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    requests.forEach(r => {
      const row = `
        <tr>
          <td><strong>${r.name}</strong></td>
          <td>${r.email}</td>
          <td>${r.department_or_club || 'General Coordinator'}</td>
          <td>${r.designation || 'Organiser'}</td>
          <td>
            <button class="btn-primary-pill" style="padding: 6px 14px; font-size: 12px; background: #16a34a;" onclick="verifyOrganiser(${r.user_id}, '${escape(r.name)}')">
              Approve & Verify
            </button>
          </td>
        </tr>
      `;
      tbody.innerHTML += row;
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="color: #ef4444; padding: 20px;">Error loading requests: ${err.message}</td></tr>`;
  }
}

async function verifyOrganiser(targetUserId, unescapedName) {
  const alertBox = document.getElementById('adminAlert');
  alertBox.className = 'alert-box d-none';

  try {
    const res = await fetch(`${API_BASE}/admin/organizers/verify/${targetUserId}`, {
      method: 'PUT'
    });
    const result = await res.json();

    if (res.ok) {
      alertBox.className = 'alert-box success';
      alertBox.innerText = `Verified ${unescape(unescapedName)} successfully!`;
      loadPendingOrganisers();
    } else {
      alertBox.className = 'alert-box error';
      alertBox.innerText = result.error || 'Verification failed.';
    }
  } catch (err) {
    alertBox.className = 'alert-box error';
    alertBox.innerText = `Network error: ${err.message}`;
  }
}

async function loadPendingEvents() {
  const user = JSON.parse(localStorage.getItem('dazz_user'));
  const tbody = document.getElementById('pendingEventsTbody');

  try {
    const res = await fetch(`${API_BASE}/admin/events/pending/${user.institution_id || 1}`);
    const events = await res.json();

    if (!events || events.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #797e93; padding: 20px;">No pending event proposals for your institution.</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    events.forEach(e => {
      const dateStr = new Date(e.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const row = `
        <tr>
          <td><strong>${e.title}</strong></td>
          <td>
            <div>${e.organizer_name}</div>
            <div style="font-size: 11.5px; color: #797e93;">${e.department_or_club || 'Club'}</div>
          </td>
          <td>
            <span class="badge-tag">${e.category}</span>
            <div style="font-size: 11.5px; color: #797e93;">${e.scope}-College • ${e.participation_mode}</div>
          </td>
          <td>
            <div>${dateStr}</div>
            <div style="font-size: 12px; color: #797e93;">${e.event_venue}, ${e.event_city}</div>
          </td>
          <td>
            <div style="display: flex; gap: 8px;">
              <button class="btn-primary-pill" style="padding: 6px 12px; font-size: 12px; background: #16a34a;" onclick="updateEventStatus(${e.event_id}, 'Approved', '${escape(e.title)}')">
                Approve
              </button>
              <button class="btn-primary-pill" style="padding: 6px 12px; font-size: 12px; background: #dc2626;" onclick="updateEventStatus(${e.event_id}, 'Rejected', '${escape(e.title)}')">
                Reject
              </button>
            </div>
          </td>
        </tr>
      `;
      tbody.innerHTML += row;
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="color: #ef4444; padding: 20px;">Error loading event requests: ${err.message}</td></tr>`;
  }
}

async function updateEventStatus(eventId, newStatus, unescapedTitle) {
  const alertBox = document.getElementById('adminAlert');
  alertBox.className = 'alert-box d-none';

  try {
    const res = await fetch(`${API_BASE}/admin/events/${eventId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const result = await res.json();

    if (res.ok) {
      alertBox.className = 'alert-box success';
      alertBox.innerText = `Event "${unescape(unescapedTitle)}" has been ${newStatus}.`;
      loadPendingEvents();
    } else {
      alertBox.className = 'alert-box error';
      alertBox.innerText = result.error || 'Failed to update event state.';
    }
  } catch (err) {
    alertBox.className = 'alert-box error';
    alertBox.innerText = `Network communication error: ${err.message}`;
  }
}

// ============================================================================
// 3. STUDENT REGISTRATIONS
// ============================================================================

async function loadStudentRegistrations(user) {
  const container = document.getElementById('ticketsList');
  container.innerHTML = `<div style="color: #c9c4eb; padding: 24px;">Fetching passes from database...</div>`;

  try {
    const res = await fetch(`${API_BASE}/users/${user.user_id}/registrations`);
    const data = await res.json();

    if (!res.ok || !Array.isArray(data)) {
      container.innerHTML = `<div style="color: #ff8b8b; padding: 24px;">Backend error: ${data.error || JSON.stringify(data)}</div>`;
      return;
    }

    if (data.length === 0) {
      container.innerHTML = `
        <div style="background: rgba(255,255,255,0.06); padding: 40px; border-radius: 16px; text-align: center; color: #c9c4eb;">
          <i class="fa-regular fa-ticket" style="font-size: 40px; margin-bottom: 14px; color: #a49ed1;"></i>
          <h3 style="color: #ffffff; margin-bottom: 8px;">No event passes allocated yet</h3>
          <p style="font-size: 14px; margin-bottom: 20px;">Browse upcoming competitions and register to acquire your entry pass.</p>
          <a href="events.html" class="btn-primary-pill">Explore Events</a>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    data.forEach(reg => {
      const startObj = new Date(reg.start_date);
      const startStr = startObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const timeStr = startObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      const teamRow = reg.team_name 
        ? `<div style="margin-top: 8px; color: #4b36d6; font-size: 13px; font-weight: 600;">Team: ${reg.team_name}</div>` 
        : '';

      const ticketHTML = `
        <div class="ticket-card">
          <div class="ticket-main">
            <span class="status-badge-confirmed">CONFIRMED ALLOCATION</span>
            <span class="badge-tag" style="margin-left: 8px;">${reg.category}</span>
            <span class="badge-tag">${reg.participation_mode} Entry</span>

            <h2 style="font-size: 20px; font-weight: 800; margin: 8px 0 4px 0; color: #171530;">${reg.event_title}</h2>
            <p style="font-size: 13.5px; color: #6d738a; margin-bottom: 14px;">${reg.host_institution}</p>

            <div style="font-size: 13px; color: #43485e; display: grid; gap: 6px;">
              <div><i class="fa-regular fa-calendar" style="width: 18px; color: #7b809a;"></i> ${startStr} at ${timeStr}</div>
              <div><i class="fa-solid fa-location-dot" style="width: 18px; color: #7b809a;"></i> ${reg.event_venue}, ${reg.event_city}</div>
            </div>

            ${teamRow}
          </div>

          <div class="ticket-stub">
            <i class="fa-solid fa-qrcode" style="font-size: 48px; color: #201b44; margin-bottom: 8px;"></i>
            <span style="font-size: 11px; text-transform: uppercase; color: #797e93; font-weight: 700;">Verification Code</span>
            <div class="ticket-code-pill">${reg.ticket_code}</div>
            <span style="font-size: 10px; color: #9da2b8; margin-top: 8px;">Present at Gate Check-in</span>
          </div>
        </div>
      `;
      container.innerHTML += ticketHTML;
    });

  } catch (err) {
    container.innerHTML = `<div style="color: #ff8b8b; padding: 24px;">Failed to load passes: ${err.message}</div>`;
  }
}

// ============================================================================
// 4. ORGANISER UPCOMING & PAST GALLERIES
// ============================================================================

async function loadOrganiserDashboard(user) {
  const tbody = document.getElementById('orgEventsTbody');

  try {
    const res = await fetch(`${API_BASE}/organizers/${user.user_id}/events`);
    const events = await res.json();

    if (!res.ok || !Array.isArray(events)) {
      tbody.innerHTML = `<tr><td colspan="6" style="color: #ef4444; padding: 20px;">Server query error: ${events.error || JSON.stringify(events)}</td></tr>`;
      return;
    }

    if (events.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 24px; color: #797e93;">You haven't hosted any events yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    events.forEach(ev => {
      const dateStr = new Date(ev.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const fillPercentage = Math.round(((ev.total_registrations || 0) / ev.max_seats) * 100);

      // Support 'PendingApproval' from MySQL schema
      let statusBadge = '<span class="badge-status-pending">PENDING APPROVAL</span>';
      if (ev.status === 'Approved') {
        statusBadge = '<span class="badge-status-approved">APPROVED</span>';
      } else if (ev.status === 'Rejected') {
        statusBadge = '<span class="badge-status-rejected">REJECTED</span>';
      }

      const row = `
        <tr>
          <td>
            <strong>${ev.title}</strong>
            <div style="font-size: 11.5px; color: #797e93;">${ev.scope}-College • ${ev.participation_mode}</div>
          </td>
          <td>${statusBadge}</td>
          <td><span class="badge-tag">${ev.category}</span></td>
          <td>
            <div>${dateStr}</div>
            <div style="font-size: 12px; color: #797e93;">${ev.event_venue}, ${ev.event_city}</div>
          </td>
          <td>
            <strong>${ev.total_registrations || 0}</strong> / ${ev.max_seats}
            <div style="font-size: 11.5px; color: #059669; font-weight: 600;">${fillPercentage}% Capacity</div>
          </td>
          <td>
            <button class="btn-primary-pill" style="padding: 6px 12px; font-size: 12px;" onclick="openRosterModal(${ev.event_id}, '${escape(ev.title)}')">
              View Attendees
            </button>
          </td>
        </tr>
      `;
      tbody.innerHTML += row;
    });

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="color: #ef4444; padding: 20px;">Error loading events: ${err.message}</td></tr>`;
  }
}

async function loadOrganiserGalleries(user) {
  const tbody = document.getElementById('orgGalleriesTbody');
  if (!tbody) return;

  try {
    const res = await fetch(`${API_BASE}/organizers/${user.user_id}/galleries`);
    const galleries = await res.json();

    if (!res.ok || !Array.isArray(galleries)) {
      tbody.innerHTML = `<tr><td colspan="5" style="color: #ef4444; padding: 20px;">Server query error: ${galleries.error || JSON.stringify(galleries)}</td></tr>`;
      return;
    }

    if (galleries.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 24px; color: #797e93;">You haven't uploaded any past event galleries yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    galleries.forEach(g => {
      const dateStr = new Date(g.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const imgHtml = g.image_data 
        ? `<img src="${g.image_data}" alt="thumbnail" style="width: 60px; height: 42px; object-fit: cover; border-radius: 6px;" onerror="this.src='https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=200'">`
        : `<span style="font-size: 11px; color: #999;">No image</span>`;

      const row = `
        <tr>
          <td>${imgHtml}</td>
          <td><strong>${g.title}</strong></td>
          <td>${dateStr}</td>
          <td>
            <div>${g.caption || 'Event Highlight'}</div>
            <div style="font-size: 11.5px; color: #797e93;">${g.description || ''}</div>
          </td>
          <td>
            <button class="btn-primary-pill" style="padding: 6px 12px; font-size: 12px; background: #dc2626;" onclick="deleteGallery(${g.gallery_id}, '${escape(g.title)}')">
              Delete
            </button>
          </td>
        </tr>
      `;
      tbody.innerHTML += row;
    });

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="color: #ef4444; padding: 20px;">Error loading galleries: ${err.message}</td></tr>`;
  }
}

async function deleteGallery(galleryId, escapedTitle) {
  const title = unescape(escapedTitle);
  if (!confirm(`Are you sure you want to permanently delete the gallery for "${title}"?`)) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/galleries/${galleryId}`, {
      method: 'DELETE'
    });
    const result = await res.json();

    if (res.ok) {
      alert(`Gallery "${title}" has been deleted.`);
      const user = JSON.parse(localStorage.getItem('dazz_user'));
      loadOrganiserGalleries(user);
    } else {
      alert(`Failed to delete gallery: ${result.error}`);
    }
  } catch (err) {
    alert(`Network communication error: ${err.message}`);
  }
}

async function openRosterModal(eventId, unescapedTitle) {
  const modal = document.getElementById('rosterModal');
  const body = document.getElementById('rosterModalBody');
  const title = document.getElementById('rosterModalTitle');

  title.innerText = `Roster: ${unescape(unescapedTitle)}`;
  modal.classList.remove('d-none');
  body.innerHTML = `<p>Loading participant records from database...</p>`;

  try {
    const res = await fetch(`${API_BASE}/events/${eventId}/attendees`);
    const attendees = await res.json();

    if (!attendees || attendees.length === 0) {
      body.innerHTML = `<p style="padding: 20px; text-align: center; color: #797e93;">No students have registered for this event yet.</p>`;
      return;
    }

    let html = `
      <table class="org-table">
        <thead>
          <tr>
            <th>Ticket Code</th>
            <th>Student Name</th>
            <th>Email</th>
            <th>Degree & Roll</th>
            <th>Mode</th>
          </tr>
        </thead>
        <tbody>
    `;

    attendees.forEach(a => {
      html += `
        <tr>
          <td><strong style="font-family: monospace; color: #4b36d6;">${a.ticket_code}</strong></td>
          <td><strong>${a.student_name}</strong></td>
          <td>${a.student_email}</td>
          <td>${a.degree || 'Student'} (${a.roll_number || 'N/A'})</td>
          <td>${a.participation_mode} ${a.team_name ? `• Team: ${a.team_name}` : ''}</td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    body.innerHTML = html;
  } catch (err) {
    body.innerHTML = `<div style="color: #ef4444;">Failed to load roster: ${err.message}</div>`;
  }
}

async function verifyGatePass() {
  const code = document.getElementById('verifyTicketInput').value.trim();
  const resBox = document.getElementById('verifyResult');

  if (!code) {
    alert('Please enter a ticket code to verify.');
    return;
  }

  resBox.className = 'alert-box';
  resBox.classList.remove('d-none');
  resBox.innerHTML = `Checking ticket ${code}...`;

  try {
    const res = await fetch(`${API_BASE}/tickets/verify/${code}`);
    const rows = await res.json();

    if (!res.ok || rows.length === 0) {
      resBox.className = 'alert-box error';
      resBox.innerHTML = `<strong>INVALID TICKET:</strong> No active registration found with code <code>${code}</code>.`;
      return;
    }

    const t = rows[0];
    resBox.className = 'alert-box success';
    resBox.innerHTML = `
      <div><strong>TICKET VALID: ACCESS GRANTED</strong></div>
      <div style="margin-top: 4px; font-size: 13px;">
        <strong>Event:</strong> ${t.event_title} (${t.event_venue})<br>
        <strong>Booked By:</strong> ${t.booked_by} ${t.team_name ? `(Team: ${t.team_name})` : ''}
      </div>
    `;
  } catch (err) {
    resBox.className = 'alert-box error';
    resBox.innerText = `Verification error: ${err.message}`;
  }
}

function openAddGalleryModal() {
  const user = JSON.parse(localStorage.getItem('dazz_user'));
  if (user && user.role === 'Organiser' && !user.is_email_verified) {
    alert('Action blocked: Your account is pending verification by the Institution Admin. You cannot post past event galleries yet.');
    return;
  }
  document.getElementById('addGalleryModal').classList.remove('d-none');
}

async function submitPastGallery(e) {
  e.preventDefault();
  const user = JSON.parse(localStorage.getItem('dazz_user'));
  const title = document.getElementById('galTitle').value.trim();
  const date = document.getElementById('galDate').value;
  const description = document.getElementById('galDesc').value.trim();
  const image_data = document.getElementById('galImageUrl').value.trim();
  const caption = document.getElementById('galCaption').value.trim();
  const alertBox = document.getElementById('galleryAlert');

  try {
    const res = await fetch(`${API_BASE}/galleries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        event_date: date,
        description,
        institution_id: user ? (user.institution_id || 1) : 1,
        image_data,
        caption,
        user_id: user ? user.user_id : 1
      })
    });

    const data = await res.json();

    if (res.ok) {
      alertBox.className = 'alert-box success';
      alertBox.innerText = 'Past event gallery published successfully!';
      setTimeout(() => {
        closeModal('addGalleryModal');
        alertBox.className = 'alert-box d-none';
        document.getElementById('addGalleryForm').reset();
        loadOrganiserGalleries(user);
      }, 1500);
    } else {
      alertBox.className = 'alert-box error';
      alertBox.innerText = data.error || 'Failed to publish gallery.';
    }
  } catch (err) {
    alertBox.className = 'alert-box error';
    alertBox.innerText = `Error: ${err.message}`;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initializeDashboard();
});