const API_BASE = 'http://localhost:5001/api';

function checkOrganiserAccess() {
  const user = JSON.parse(localStorage.getItem('dazz_user'));
  if (!user) {
    alert('Access restricted: Please log in to publish events.');
    window.location.href = 'home.html';
    return null;
  }

  if (user.role !== 'Organiser' && user.role !== 'InstitutionAdmin' && user.role !== 'Admin') {
    alert('Access restricted: Only verified event organisers can publish events.');
    window.location.href = 'dashboard.html';
    return null;
  }

  if (user.role === 'Organiser' && !user.is_email_verified) {
    alert('Access restricted: Your organiser account is pending verification by the Institution Admin.');
    window.location.href = 'dashboard.html';
    return null;
  }

  return user;
}

function initializeDateTimeLimits() {
  const now = new Date();
  
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  const currentLocalISO = `${year}-${month}-${day}T${hours}:${minutes}`;

  const startInput = document.getElementById('evStartDate');
  const endInput = document.getElementById('evEndDate');

  if (startInput) {
    startInput.min = currentLocalISO;
    startInput.value = currentLocalISO;
  }

  if (endInput) {
    endInput.min = currentLocalISO;
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const endH = String(twoHoursLater.getHours()).padStart(2, '0');
    const endM = String(twoHoursLater.getMinutes()).padStart(2, '0');
    endInput.value = `${year}-${month}-${day}T${endH}:${endM}`;
  }
}

function handleStartDateChange() {
  const startVal = document.getElementById('evStartDate').value;
  const endInput = document.getElementById('evEndDate');

  if (startVal && endInput) {
    endInput.min = startVal;
    if (endInput.value && endInput.value <= startVal) {
      endInput.value = startVal;
    }
  }
}

function toggleTeamSizeInputs() {
  const mode = document.getElementById('evMode').value;
  const minTeam = document.getElementById('evMinTeam');
  const maxTeam = document.getElementById('evMaxTeam');

  if (mode === 'Team') {
    minTeam.disabled = false;
    maxTeam.disabled = false;
    minTeam.value = '2';
    maxTeam.value = '4';
  } else {
    minTeam.disabled = true;
    maxTeam.disabled = true;
    minTeam.value = '1';
    maxTeam.value = '1';
  }
}

function togglePriceInput() {
  const paidSelect = document.getElementById('evPaidSelect').value;
  const priceInput = document.getElementById('evPrice');

  if (paidSelect === 'Paid') {
    priceInput.disabled = false;
    priceInput.value = '100';
  } else {
    priceInput.disabled = true;
    priceInput.value = '0';
  }
}

function toggleVenueFields() {
  const locType = document.getElementById('evLocationType').value;
  const venueLabel = document.getElementById('labelVenue');
  const venueInput = document.getElementById('evVenue');

  if (locType === 'Online') {
    venueLabel.innerText = 'Online Platform / Meeting Link *';
    venueInput.placeholder = 'e.g. Google Meet or Zoom Conference URL';
  } else {
    venueLabel.innerText = 'Auditorium / Hall / Venue *';
    venueInput.placeholder = 'e.g. Main Auditorium, Ground Floor';
  }
}

async function handleEventPublish(e) {
  e.preventDefault();
  const alertBox = document.getElementById('publishAlert');
  alertBox.className = 'alert-box d-none';

  const user = checkOrganiserAccess();
  if (!user) return;

  const title = document.getElementById('evTitle').value.trim();
  const category = document.getElementById('evCategory').value;
  const scope = document.getElementById('evScope').value;
  const description = document.getElementById('evDescription').value.trim();

  const start_date = document.getElementById('evStartDate').value;
  const end_date = document.getElementById('evEndDate').value;
  const location_type = document.getElementById('evLocationType').value;
  const event_venue = document.getElementById('evVenue').value.trim();
  const event_city = document.getElementById('evCity').value;

  const participation_mode = document.getElementById('evMode').value;
  const min_team_size = parseInt(document.getElementById('evMinTeam').value) || 1;
  const max_team_size = parseInt(document.getElementById('evMaxTeam').value) || 1;

  const max_seats = parseInt(document.getElementById('evMaxSeats').value) || 100;
  const is_paid = document.getElementById('evPaidSelect').value === 'Paid';
  const ticket_price = is_paid ? parseFloat(document.getElementById('evPrice').value) || 0 : 0;

  const selectedDegrees = [];
  document.querySelectorAll('input[name="degOption"]:checked').forEach(cb => {
    selectedDegrees.push(cb.value);
  });

  if (new Date(end_date) <= new Date(start_date)) {
    alertBox.className = 'alert-box error';
    alertBox.innerText = 'Event ending time must be scheduled strictly after the start time.';
    return;
  }

  const submitBtn = document.getElementById('btnSubmitPublish');
  submitBtn.disabled = true;
  submitBtn.innerText = 'Submitting proposal...';

  try {
    const res = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        category,
        scope,
        participation_mode,
        min_team_size,
        max_team_size,
        is_paid,
        ticket_price,
        location_type,
        event_venue,
        event_city,
        institution_id: user.institution_id || 1,
        created_by_user_id: user.user_id,
        start_date: start_date.replace('T', ' ') + ':00',
        end_date: end_date.replace('T', ' ') + ':00',
        max_seats,
        eligible_degrees: selectedDegrees
      })
    });

    const data = await res.json();

    if (res.ok) {
      alertBox.className = 'alert-box success';
      alertBox.innerText = 'Event proposal submitted! It is now in Pending status awaiting Admin approval.';
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1400);
    } else {
      alertBox.className = 'alert-box error';
      alertBox.innerText = data.error || 'Failed to submit event.';
      submitBtn.disabled = false;
      submitBtn.innerText = 'Publish Event Immediately';
    }
  } catch (err) {
    alertBox.className = 'alert-box error';
    alertBox.innerText = `Network communication fault: ${err.message}`;
    submitBtn.disabled = false;
    submitBtn.innerText = 'Publish Event Immediately';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  checkOrganiserAccess();
  initializeDateTimeLimits();
});