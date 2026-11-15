const API_BASE = 'http://localhost:5001/api';

// ============================================================================
// 0. SAFE IMAGE HELPER & DATE RANGE SYNC
// ============================================================================

function getSafeGalleryImage(rawImg) {
  if (
    !rawImg ||
    (!rawImg.startsWith('http') && !rawImg.startsWith('data:image')) ||
    rawImg.includes('share.google') ||
    rawImg.includes('google.com/search')
  ) {
    return 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=900&q=80';
  }
  return rawImg;
}

function setupSearchDateBounds() {
  const fromInput = document.getElementById('fromDateInput');
  const toInput = document.getElementById('toDateInput');
  if (!fromInput || !toInput) return;

  fromInput.addEventListener('change', () => {
    if (fromInput.value) {
      toInput.min = fromInput.value;
      if (toInput.value && toInput.value < fromInput.value) {
        toInput.value = fromInput.value;
      }
    } else {
      toInput.removeAttribute('min');
    }
  });

  toInput.addEventListener('change', () => {
    if (toInput.value && fromInput.value && toInput.value < fromInput.value) {
      alert('End date ("To") cannot be earlier than Start date ("From").');
      toInput.value = fromInput.value;
    }
  });
}

// ============================================================================
// 1. AUTHENTICATION & MODAL CONTROLS
// ============================================================================

function openAuthModal(mode) {
  if (mode === 'signup') {
    document.getElementById('signupModal').classList.remove('d-none');
    document.getElementById('loginModal').classList.add('d-none');
  } else {
    document.getElementById('loginModal').classList.remove('d-none');
    document.getElementById('signupModal').classList.add('d-none');
  }
}

function switchModal(fromId, toId) {
  closeModal(fromId);
  document.getElementById(toId).classList.remove('d-none');
}

function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  input.type = input.type === 'password' ? 'text' : 'password';
}

function setRoleTab(role) {
  document.getElementById('selectedRole').value = role;

  document.getElementById('tab-student').classList.remove('active');
  document.getElementById('tab-organiser').classList.remove('active');
  document.getElementById('tab-admin').classList.remove('active');

  const infoText = document.getElementById('roleInfoText');
  const labelName = document.getElementById('labelName');
  const labelEmail = document.getElementById('labelEmail');
  const labelPhone = document.getElementById('labelPhone');
  const labelField1 = document.getElementById('labelField1');
  const labelField2 = document.getElementById('labelField2');
  const regField1 = document.getElementById('regField1');
  const regField2 = document.getElementById('regField2');
  const groupField1 = document.getElementById('groupField1');
  const groupField2 = document.getElementById('groupField2');
  const groupField3 = document.getElementById('groupField3');

  if (role === 'Student') {
    document.getElementById('tab-student').classList.add('active');
    infoText.innerHTML = '<i class="fa-regular fa-circle-info"></i> Register for events and receive digital access tickets.';
    labelName.innerText = 'Full name';
    labelEmail.innerText = 'Email address';
    labelPhone.innerText = 'Phone number (optional)';
    
    groupField1.style.display = 'block';
    labelField1.innerText = 'Degree / course';
    regField1.placeholder = 'e.g., MCA, B.Tech';

    groupField2.style.display = 'block';
    labelField2.innerText = 'Roll number';
    regField2.placeholder = 'e.g., 2026-CS-014';

    groupField3.style.display = 'block';

  } else if (role === 'Organiser') {
    document.getElementById('tab-organiser').classList.add('active');
    infoText.innerHTML = '<i class="fa-regular fa-circle-info"></i> Publish events for your club, society, or academic department.';
    labelName.innerText = 'Coordinator name';
    labelEmail.innerText = 'Official email';
    labelPhone.innerText = 'Contact telephone';

    groupField1.style.display = 'block';
    labelField1.innerText = 'Club / Society / Department';
    regField1.placeholder = 'e.g., Coding Club, Cultural Committee';

    groupField2.style.display = 'block';
    labelField2.innerText = 'Executive designation';
    regField2.placeholder = 'e.g., Club Lead, Vice President';

    groupField3.style.display = 'none';

  } else if (role === 'Admin') {
    document.getElementById('tab-admin').classList.add('active');
    infoText.innerHTML = '<i class="fa-regular fa-circle-info"></i> Manage institutional affiliation and verify campus organisers.';
    labelName.innerText = 'Administrator name';
    labelEmail.innerText = 'Official institutional email';
    labelPhone.innerText = 'Official contact number';

    groupField1.style.display = 'none';

    groupField2.style.display = 'block';
    labelField2.innerText = 'Office / Designation';
    regField2.placeholder = 'e.g., Dean of Student Welfare, Faculty Advisor';

    groupField3.style.display = 'none';
  }
}

async function submitSignup(e) {
  e.preventDefault();
  const alertBox = document.getElementById('signupAlert');
  alertBox.className = 'alert-box d-none';

  const role = document.getElementById('selectedRole').value;
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const institution_id = document.getElementById('regInstitution').value;
  const field1 = document.getElementById('regField1').value;
  const field2 = document.getElementById('regField2').value.trim();

  if (!institution_id) {
    alertBox.className = 'alert-box error';
    alertBox.innerText = 'Please designate your institution.';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        password,
        role: role === 'Admin' ? 'Admin' : (role === 'Organiser' ? 'Organiser' : 'Student'),
        phone,
        institution_id: parseInt(institution_id),
        meta_field1: field1 || null,
        meta_field2: field2 || null
      })
    });

    const data = await res.json();

    if (res.ok) {
      alertBox.className = 'alert-box success';
      alertBox.innerText = 'Account provisioned successfully. Please proceed to sign in.';
      setTimeout(() => {
        switchModal('signupModal', 'loginModal');
        document.getElementById('loginEmail').value = email;
      }, 1500);
    } else {
      alertBox.className = 'alert-box error';
      alertBox.innerText = data.error || 'Account registration failed.';
    }
  } catch (err) {
    alertBox.className = 'alert-box error';
    alertBox.innerText = `Network communication error: ${err.message}`;
  }
}

async function submitLogin(e) {
  e.preventDefault();
  const alertBox = document.getElementById('loginAlert');
  alertBox.className = 'alert-box d-none';

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (res.ok) {
      alertBox.className = 'alert-box success';
      alertBox.innerText = `Authentication successful. Welcome, ${data.user.name}.`;

      localStorage.setItem('dazz_user', JSON.stringify(data.user));

      setTimeout(() => {
        closeModal('loginModal');
        if (data.user.role === 'Organiser' || data.user.role === 'InstitutionAdmin' || data.user.role === 'Admin') {
          window.location.href = 'dashboard.html';
        } else {
          checkAuthNavbar();
          fetchEvents();
        }
      }, 1000);
    } else {
      alertBox.className = 'alert-box error';
      alertBox.innerText = data.error || 'Authentication rejected.';
    }
  } catch (err) {
    alertBox.className = 'alert-box error';
    alertBox.innerText = `Network error: ${err.message}`;
  }
}

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
  } else {
    if (navDashboard) navDashboard.style.display = 'none';
  }
}

function logoutUser() {
  localStorage.removeItem('dazz_user');
  window.location.reload();
}

// ============================================================================
// 2. UPCOMING EVENTS
// ============================================================================

async function fetchEvents() {
  const city = document.getElementById('citySelect').value;
  const fromDate = document.getElementById('fromDateInput').value;
  const toDate = document.getElementById('toDateInput').value;
  const category = document.getElementById('categorySelect').value;

  if (fromDate && toDate && toDate < fromDate) {
    alert('Invalid Date Range: "To" date cannot be earlier than "From" date.');
    return;
  }

  const url = new URL(`${API_BASE}/events`);
  if (city && city !== 'All cities') url.searchParams.append('city', city);
  if (category && category !== 'All categories') url.searchParams.append('category', category);
  if (fromDate) url.searchParams.append('fromDate', fromDate);
  if (toDate) url.searchParams.append('toDate', toDate);

  const container = document.getElementById('upcomingCarousel');
  container.innerHTML = `<div style="color: #c9c4eb; padding: 24px;">Executing query on MySQL instance...</div>`;

  try {
    const res = await fetch(url);
    const events = await res.json();

    if (!events || events.length === 0) {
      container.innerHTML = `<div style="color: #c9c4eb; padding: 24px;">No approved events found matching the specified parameters.</div>`;
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

      const registerActionHtml = isNonStudent
        ? `<span style="font-size: 11.5px; font-weight: 700; color: #64748b; padding: 9px 10px; background: #f1f5f9; border-radius: 8px; text-align: center; flex: 1;">View Only (${currentUser.role})</span>`
        : `<button class="btn-register" onclick="openRegisterModal(${ev.event_id}, '${ev.participation_mode}', '${escape(ev.title)}')">Register</button>`;

      const card = `
        <div class="event-card">
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

  } catch (err) {
    container.innerHTML = `<div style="color: #ff8b8b; padding: 24px;">Database connectivity error: ${err.message}</div>`;
  }
}

function navigateToCategory(catName) {
  window.location.href = `events.html?category=${encodeURIComponent(catName)}`;
}

async function fetchCategoryCounts() {
  try {
    const res = await fetch(`${API_BASE}/categories/count`);
    const counts = await res.json();

    counts.forEach(item => {
      const el = document.getElementById(`count-${item.category}`);
      if (el) el.innerText = `${item.total_count} upcoming`;
    });
  } catch (err) {
    console.error('Failed to update category counters:', err);
  }
}

// ============================================================================
// 3. PAST EVENTS GALLERIES (Dynamic Fetch from DB)
// ============================================================================

async function fetchPastGalleries() {
  const grid = document.getElementById('pastEventsGrid');
  if (!grid) return;

  try {
    const res = await fetch(`${API_BASE}/galleries`);
    const galleries = await res.json();

    if (!res.ok || !Array.isArray(galleries) || galleries.length === 0) {
      return;
    }

    grid.innerHTML = '';
    galleries.slice(0, 4).forEach(g => {
      const imgUrl = getSafeGalleryImage(g.image_data);
      const card = `
        <div class="past-card" onclick="openGalleryModal(${g.gallery_id})">
          <div class="past-media" style="background-image: url('${imgUrl}'); background-size: cover; background-position: center; border-radius: 12px 12px 0 0; min-height: 140px; position: relative;">
            <span class="past-badge-center" style="position: absolute; bottom: 8px; left: 8px; font-size: 11px; padding: 3px 8px; border-radius: 4px; background: rgba(0,0,0,0.65); color: #fff;">HIGHLIGHTS</span>
          </div>
          <div class="past-info">
            <h4 class="past-title">${g.title}</h4>
            <p class="past-subtitle">${g.college_name || 'Academic Institution'} • Concluded</p>
          </div>
        </div>
      `;
      grid.innerHTML += card;
    });
  } catch (err) {
    console.error('Failed to load past galleries:', err);
  }
}

// ============================================================================
// 4. MODALS (Details, Registration, Gallery)
// ============================================================================

async function openDetailsModal(eventId) {
  const modal = document.getElementById('detailsModal');
  const body = document.getElementById('modalEventBody');
  const regBtn = document.getElementById('modalRegisterBtn');

  modal.classList.remove('d-none');
  body.innerHTML = `
    <div style="text-align: center; padding: 20px; color: #6d738a;">
      <i class="fa-solid fa-spinner fa-spin" style="font-size: 20px; margin-bottom: 8px;"></i>
      <p>Retrieving event specifications from database schema...</p>
    </div>
  `;

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

async function openGalleryModal(galleryId) {
  const modal = document.getElementById('galleryModal');
  const body = document.getElementById('galleryModalBody');
  const title = document.getElementById('galleryModalTitle');

  modal.classList.remove('d-none');
  body.innerHTML = '<p>Loading gallery archive...</p>';

  try {
    const res = await fetch(`${API_BASE}/galleries/${galleryId}`);
    const rows = await res.json();

    if (!rows || rows.length === 0) {
      body.innerHTML = '<p>No gallery images documented for this event archive.</p>';
      return;
    }

    const first = rows[0];
    title.innerText = `${first.album_title} - ${first.college_name}`;

    let html = `
      <p style="color: #6d738a; margin-bottom: 14px; font-size: 13.5px;">${first.album_desc || ''}</p>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
    `;

    rows.forEach(r => {
      if (r.image_data) {
        const safeImg = getSafeGalleryImage(r.image_data);
        html += `
          <div style="background: #f1f3f9; border-radius: 8px; padding: 8px; text-align: center;">
            <img src="${safeImg}" alt="Gallery" style="width: 100%; height: 130px; object-fit: cover; border-radius: 6px;" onerror="this.src='https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=300'">
            <p style="font-size: 11.5px; margin-top: 6px; color: #555;">${r.caption || 'Event Photograph'}</p>
          </div>
        `;
      }
    });

    html += `</div>`;
    body.innerHTML = html;
  } catch (err) {
    body.innerHTML = `<div style="color: #ef4444;">Failed to retrieve album: ${err.message}</div>`;
  }
}

function openRegisterModal(eventId, mode, unescapedTitle) {
  const user = JSON.parse(localStorage.getItem('dazz_user'));
  if (!user) {
    alert('Authentication required: Sign in or create an account to proceed with registration.');
    openAuthModal('login');
    return;
  }

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
      student_id: user.user_id,
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

function scrollCarousel(id, offset) {
  const container = document.getElementById(id);
  container.scrollBy({ left: offset, behavior: 'smooth' });
}

window.addEventListener('DOMContentLoaded', () => {
  checkAuthNavbar();
  setupSearchDateBounds();
  fetchEvents();
  fetchPastGalleries();
  fetchCategoryCounts();
});