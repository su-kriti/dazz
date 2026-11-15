const API_BASE = 'http://localhost:5001/api';

function checkAuthSession() {
  const user = JSON.parse(localStorage.getItem('dazz_user'));
  const navAuthArea = document.getElementById('navAuthArea');
  const profileHeader = document.getElementById('studentProfileHeader');

  if (!user) {
    alert('Access restricted: Please log in to view your registrations.');
    window.location.href = 'home.html';
    return null;
  }

  if (navAuthArea) {
    navAuthArea.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="color: #1a1446; font-weight: 700; font-size: 13.5px;">${user.name}</span>
        <button onclick="logoutUser()" class="btn-primary-pill" style="padding: 6px 14px; font-size: 12px; background: #c53030;">Logout</button>
      </div>
    `;
  }

  if (profileHeader) {
    profileHeader.innerHTML = `
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

async function loadUserRegistrations() {
  const user = checkAuthSession();
  if (!user) return;

  const container = document.getElementById('ticketsList');
  container.innerHTML = `<div style="color: #c9c4eb; padding: 24px;">Fetching passes from database...</div>`;

  try {
    const res = await fetch(`${API_BASE}/users/${user.user_id}/registrations`);
    const data = await res.json();

    // If backend threw an error (like a column mismatch)
    if (!res.ok || !Array.isArray(data)) {
      container.innerHTML = `<div style="color: #ff8b8b; padding: 24px; font-weight: 600;">Backend Error: ${data.error || JSON.stringify(data)}</div>`;
      return;
    }

    if (data.length === 0) {
      container.innerHTML = `
        <div style="background: rgba(255,255,255,0.06); padding: 40px; border-radius: 16px; text-align: center; color: #c9c4eb;">
          <i class="fa-regular fa-ticket" style="font-size: 40px; margin-bottom: 14px; color: #a49ed1;"></i>
          <h3 style="color: #ffffff; margin-bottom: 8px;">No event passes allocated yet</h3>
          <p style="font-size: 14px; margin-bottom: 20px;">Browse upcoming inter-college competitions and register to acquire your entry pass.</p>
          <a href="events.html" class="btn-primary-pill">Explore Event Catalog</a>
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

window.addEventListener('DOMContentLoaded', () => {
  loadUserRegistrations();
});