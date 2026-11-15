const API_BASE = 'http://localhost:5001/api';

function switchAuthTab(type) {
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const tabLogin = document.getElementById('tabLogin');
  const tabSignup = document.getElementById('tabSignup');
  const alertBox = document.getElementById('authAlert');

  alertBox.className = 'alert-box d-none';

  if (type === 'login') {
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    loginForm.classList.remove('d-none');
    signupForm.classList.add('d-none');
  } else {
    tabSignup.classList.add('active');
    tabLogin.classList.remove('active');
    signupForm.classList.remove('d-none');
    loginForm.classList.add('d-none');
  }
}

// 1. Handle Login
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const alertBox = document.getElementById('authAlert');

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (res.ok) {
      alertBox.className = 'alert-box success';
      alertBox.innerText = `Welcome back, ${data.user.name}! Redirecting...`;
      // Store session in localStorage
      localStorage.setItem('dazz_user', JSON.stringify(data.user));

      setTimeout(() => {
        window.location.href = 'home.html';
      }, 1200);
    } else {
      alertBox.className = 'alert-box error';
      alertBox.innerText = data.error || 'Login failed.';
    }
  } catch (err) {
    alertBox.className = 'alert-box error';
    alertBox.innerText = `Network error: ${err.message}`;
  }
}

// 2. Handle Sign Up
async function handleSignup(e) {
  e.preventDefault();
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value.trim();
  const role = document.getElementById('signupRole').value;
  const alertBox = document.getElementById('authAlert');

  try {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role, institution_id: 1 })
    });
    const data = await res.json();

    if (res.ok) {
      alertBox.className = 'alert-box success';
      alertBox.innerText = 'Account created successfully! Please sign in.';
      setTimeout(() => {
        switchAuthTab('login');
        document.getElementById('loginEmail').value = email;
      }, 1400);
    } else {
      alertBox.className = 'alert-box error';
      alertBox.innerText = data.error || 'Sign up failed.';
    }
  } catch (err) {
    alertBox.className = 'alert-box error';
    alertBox.innerText = `Network error: ${err.message}`;
  }
}