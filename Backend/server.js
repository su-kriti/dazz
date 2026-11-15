const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../Frontend')));
app.use('/Frontend', express.static(path.join(__dirname, '../Frontend')));
app.use('/frontend', express.static(path.join(__dirname, '../Frontend')));

app.get('/', (req, res) => {
  res.send('DAZZ Relational API Server Operational');
});

// ============================================================================
// 1. AUTHENTICATION MODULE
// ============================================================================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password credentials are required.' });
    }

    const [users] = await db.execute(`
      SELECT 
        u.user_id, 
        u.name, 
        u.email, 
        u.role, 
        u.institution_id,
        u.password_hash,
        u.is_email_verified,
        i.name AS college_name
      FROM users u
      LEFT JOIN institutions i ON u.institution_id = i.institution_id
      WHERE u.email = ?;
    `, [email]);

    if (users.length === 0) {
      return res.status(401).json({ error: 'No account registered with this email address.' });
    }

    const user = users[0];

    if (user.password_hash !== password) {
      return res.status(401).json({ error: 'Invalid password. Authentication rejected.' });
    }

    delete user.password_hash;
    res.json({ message: 'Authentication successful.', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { 
      name, 
      email, 
      password, 
      role, 
      institution_id, 
      meta_field1, 
      meta_field2 
    } = req.body;

    if (!name || !email || !password || !institution_id) {
      return res.status(400).json({ error: 'All primary fields are mandatory.' });
    }

    const [existing] = await db.execute('SELECT user_id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'This email is already associated with an account.' });
    }

    let assignedRole = 'Student';
    if (role === 'Organiser') assignedRole = 'Organiser';
    else if (role === 'Admin' || role === 'InstitutionAdmin') assignedRole = 'InstitutionAdmin';

    if (assignedRole === 'InstitutionAdmin') {
      const [existingAdmin] = await db.execute(`
        SELECT user_id, name FROM users 
        WHERE institution_id = ? AND role = 'InstitutionAdmin';
      `, [institution_id]);

      if (existingAdmin.length > 0) {
        return res.status(409).json({ 
          error: 'An official Institution Admin is already registered for this college. Only one admin is permitted per institution.' 
        });
      }
    }

    const isVerified = (assignedRole === 'Student' || assignedRole === 'InstitutionAdmin') ? 1 : 0;

    const degreeVal = assignedRole === 'Student' ? (meta_field1 || null) : null;
    const rollVal = assignedRole === 'Student' ? (meta_field2 || null) : null;
    const deptVal = assignedRole === 'Organiser' ? (meta_field1 || null) : null;
    const desigVal = assignedRole !== 'Student' ? (meta_field2 || null) : null;

    const [result] = await db.execute(`
      INSERT INTO users (
        name, email, password_hash, role, institution_id,
        is_email_verified, degree, roll_number, department_or_club, designation
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `, [name, email, password, assignedRole, institution_id, isVerified, degreeVal, rollVal, deptVal, desigVal]);

    res.status(201).json({
      message: 'User account created successfully.',
      userId: result.insertId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 2. INSTITUTION ADMIN GOVERNANCE
// ============================================================================

app.get('/api/admin/organizers/pending/:institutionId', async (req, res) => {
  try {
    const { institutionId } = req.params;
    const query = `
      SELECT 
        u.user_id,
        u.name,
        u.email,
        u.department_or_club,
        u.designation,
        u.created_at,
        i.name AS college_name
      FROM users u
      JOIN institutions i ON u.institution_id = i.institution_id
      WHERE u.role = 'Organiser' 
        AND (u.is_email_verified = 0 OR u.is_email_verified IS NULL)
        AND u.institution_id = ?
      ORDER BY u.created_at DESC;
    `;
    const [rows] = await db.execute(query, [institutionId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/organizers/verify/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    await db.execute(`UPDATE users SET is_email_verified = 1 WHERE user_id = ?;`, [userId]);
    res.json({ message: 'Organiser verified successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/events/pending/:institutionId', async (req, res) => {
  try {
    const { institutionId } = req.params;
    const query = `
      SELECT 
        e.event_id,
        e.title,
        e.category,
        e.scope,
        e.participation_mode,
        e.start_date,
        e.event_venue,
        e.event_city,
        e.max_seats,
        u.name AS organizer_name,
        u.department_or_club
      FROM events e
      JOIN users u ON e.organiser_id = u.user_id
      WHERE e.institution_id = ? AND e.status = 'PendingApproval'
      ORDER BY e.start_date ASC;
    `;
    const [rows] = await db.execute(query, [institutionId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/events/:eventId/status', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { status } = req.body;

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be Approved or Rejected' });
    }

    await db.execute(`UPDATE events SET status = ? WHERE event_id = ?;`, [status, eventId]);
    res.json({ message: `Event proposal marked as ${status}.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:userId/status', async (req, res) => {
  try {
    const { userId } = req.params;
    const [rows] = await db.execute(`SELECT user_id, name, role, is_email_verified FROM users WHERE user_id = ?;`, [userId]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 3. EVENTS CATALOG & FILTERING
// ============================================================================

app.get('/api/events', async (req, res) => {
  try {
    const { city, category, fromDate, toDate } = req.query;

    let query = `
      SELECT 
        e.event_id, 
        e.title, 
        e.category, 
        e.scope,
        e.participation_mode,
        e.is_paid,
        e.ticket_price,
        e.location_type, 
        e.event_venue, 
        e.event_city,
        i.name AS host_institution,
        e.start_date,
        e.end_date,
        e.max_seats
      FROM events e
      JOIN institutions i ON e.institution_id = i.institution_id
      WHERE e.status = 'Approved'
    `;

    const params = [];
    if (city && city !== 'All cities') {
      query += ` AND e.event_city = ?`;
      params.push(city);
    }
    if (category && category !== 'All categories') {
      query += ` AND e.category = ?`;
      params.push(category);
    }
    if (fromDate) {
      query += ` AND e.start_date >= ?`;
      params.push(`${fromDate} 00:00:00`);
    }
    if (toDate) {
      query += ` AND e.start_date <= ?`;
      params.push(`${toDate} 23:59:59`);
    }

    query += ` ORDER BY e.start_date ASC;`;

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [event] = await db.execute(`
      SELECT e.*, i.name AS host_institution, i.campus_address
      FROM events e
      JOIN institutions i ON e.institution_id = i.institution_id
      WHERE e.event_id = ?;
    `, [id]);

    if (event.length === 0) {
      return res.status(404).json({ message: 'Event record not found.' });
    }

    const [degrees] = await db.execute(`
      SELECT degree_name FROM event_eligible_degrees WHERE event_id = ?;
    `, [id]);

    res.json({
      ...event[0],
      eligible_degrees: degrees.map(d => d.degree_name)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/categories/count', async (req, res) => {
  try {
    const query = `
      SELECT category, COUNT(event_id) AS total_count
      FROM events
      WHERE status = 'Approved'
      GROUP BY category;
    `;
    const [rows] = await db.execute(query);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 4. ORGANISER EVENT SUBMISSION
// ============================================================================

app.post('/api/events', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const {
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
      institution_id,
      created_by_user_id,
      start_date,
      end_date,
      max_seats,
      eligible_degrees
    } = req.body;

    if (!title || !category || !start_date || !end_date || !event_venue || !event_city || !created_by_user_id) {
      await connection.rollback();
      return res.status(400).json({ error: 'Please supply all mandatory event details.' });
    }

    const startObj = new Date(start_date);
    const endObj = new Date(end_date);
    const now = new Date();

    if (startObj < now) {
      await connection.rollback();
      return res.status(400).json({ error: 'Scheduled start date cannot be placed in the past.' });
    }

    if (endObj <= startObj) {
      await connection.rollback();
      return res.status(400).json({ error: 'Event concluding time must occur strictly after the starting time.' });
    }

    let mappedLocation = 'OnCampus';
    if (location_type === 'Online' || location_type === 'Virtual') {
      mappedLocation = 'Online';
    } else if (location_type === 'OffCampus') {
      mappedLocation = 'OffCampus';
    }

    const [userRow] = await connection.execute(
      `SELECT role, is_email_verified, institution_id FROM users WHERE user_id = ?;`,
      [created_by_user_id]
    );

    if (userRow.length === 0 || (userRow[0].role === 'Organiser' && !userRow[0].is_email_verified)) {
      await connection.rollback();
      return res.status(403).json({ error: 'Publishing restricted: Your organiser profile is awaiting verification by the Institution Admin.' });
    }

    const assignedInstitution = institution_id || userRow[0].institution_id || 1;

    if (mappedLocation !== 'Online') {
      const [clashes] = await connection.execute(
        `SELECT event_id, title, start_date, end_date 
         FROM events 
         WHERE LOWER(TRIM(event_venue)) = LOWER(TRIM(?))
           AND LOWER(TRIM(event_city)) = LOWER(TRIM(?))
           AND status = 'Approved'
           AND (start_date < ? AND end_date > ?);`,
        [event_venue, event_city, end_date, start_date]
      );

      if (clashes.length > 0) {
        await connection.rollback();
        const conflict = clashes[0];
        const confStart = new Date(conflict.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const confEnd = new Date(conflict.end_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return res.status(409).json({
          error: `Venue Conflict: "${conflict.title}" is already scheduled at ${event_venue} between ${confStart} and ${confEnd}.`
        });
      }
    }

    const mode = participation_mode === 'Team' ? 'Team' : 'Solo';
    const minMembers = mode === 'Team' ? Math.max(2, parseInt(min_team_size) || 2) : 1;
    const maxMembers = mode === 'Team' ? Math.max(minMembers, parseInt(max_team_size) || minMembers) : 1;
    const isPaidEvent = Boolean(is_paid) && parseFloat(ticket_price) > 0;
    const finalPrice = isPaidEvent ? parseFloat(ticket_price) : 0.00;
    const seatsLimit = Math.max(10, parseInt(max_seats) || 100);
    const regDeadline = start_date;

    const [eventResult] = await connection.execute(
      `INSERT INTO events (
        title, description, category, scope, participation_mode,
        min_team_size, max_team_size, is_paid, ticket_price,
        location_type, event_venue, event_city, institution_id,
        organiser_id, start_date, end_date, registration_deadline, max_seats, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PendingApproval');`,
      [
        title.trim(),
        description ? description.trim() : '',
        category,
        scope || 'Inter',
        mode,
        minMembers,
        maxMembers,
        isPaidEvent ? 1 : 0,
        finalPrice,
        mappedLocation,
        event_venue.trim(),
        event_city.trim(),
        assignedInstitution,
        created_by_user_id,
        start_date,
        end_date,
        regDeadline,
        seatsLimit
      ]
    );

    const eventId = eventResult.insertId;

    if (Array.isArray(eligible_degrees) && eligible_degrees.length > 0) {
      for (const degree of eligible_degrees) {
        if (degree.trim()) {
          await connection.execute(
            `INSERT INTO event_eligible_degrees (event_id, degree_name) VALUES (?, ?);`,
            [eventId, degree.trim()]
          );
        }
      }
    }

    await connection.commit();
    res.status(201).json({
      message: 'Event proposal submitted successfully! Routed to your Institution Admin for approval.',
      eventId: eventId
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

app.get('/api/organizers/:userId/events', async (req, res) => {
  try {
    const { userId } = req.params;

    const query = `
      SELECT 
        e.event_id,
        e.title,
        e.category,
        e.scope,
        e.participation_mode,
        e.start_date,
        e.event_venue,
        e.event_city,
        e.max_seats,
        e.status,
        COALESCE(COUNT(r.registration_id), 0) AS total_registrations
      FROM events e
      LEFT JOIN registrations r ON e.event_id = r.event_id
      WHERE e.organiser_id = ?
      GROUP BY 
        e.event_id, e.title, e.category, e.scope, 
        e.participation_mode, e.start_date, e.event_venue, 
        e.event_city, e.max_seats, e.status
      ORDER BY e.start_date DESC;
    `;

    const [rows] = await db.execute(query, [userId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/events/:eventId/attendees', async (req, res) => {
  try {
    const { eventId } = req.params;

    const query = `
      SELECT 
        r.registration_id,
        r.ticket_code,
        r.participation_mode,
        r.team_name,
        u.name AS student_name,
        u.email AS student_email,
        u.degree,
        u.roll_number,
        i.name AS college_name
      FROM registrations r
      JOIN users u ON r.primary_student_id = u.user_id
      LEFT JOIN institutions i ON u.institution_id = i.institution_id
      WHERE r.event_id = ?
      ORDER BY r.registration_id ASC;
    `;

    const [rows] = await db.execute(query, [eventId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 5. REGISTRATIONS & GATE VERIFICATION (Strictly Students Only)
// ============================================================================

app.post('/api/registrations', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { event_id, student_id, participation_mode, team_name, members } = req.body;

    if (!event_id || !student_id) {
      await connection.rollback();
      return res.status(400).json({ error: 'Event ID and Student ID are required.' });
    }

    // 1. Verify that ONLY Students can register for events
    const [userCheck] = await connection.execute(
      `SELECT role FROM users WHERE user_id = ?;`,
      [student_id]
    );

    if (userCheck.length === 0 || userCheck[0].role !== 'Student') {
      await connection.rollback();
      return res.status(403).json({
        error: 'Access Denied: Only Student accounts are permitted to register and participate in events.'
      });
    }

    // 2. Prevent duplicate registrations
    const [existing] = await connection.execute(`
      SELECT registration_id, ticket_code 
      FROM registrations 
      WHERE event_id = ? AND primary_student_id = ?;
    `, [event_id, student_id]);

    if (existing.length > 0) {
      await connection.rollback();
      return res.status(409).json({ 
        error: `You are already registered for this event! Your ticket code is ${existing[0].ticket_code}.` 
      });
    }

    // 3. Enforce seat capacity limits
    const [seatCheck] = await connection.execute(`
      SELECT 
        e.max_seats, 
        COUNT(r.registration_id) AS booked
      FROM events e
      LEFT JOIN registrations r ON e.event_id = r.event_id
      WHERE e.event_id = ? AND e.status = 'Approved'
      GROUP BY e.max_seats;
    `, [event_id]);

    if (seatCheck.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'This event is not approved or open for booking.' });
    }

    if (seatCheck[0].booked >= seatCheck[0].max_seats) {
      await connection.rollback();
      return res.status(400).json({ error: 'This event is completely sold out.' });
    }

    const ticket_code = `DAZZ-${Date.now().toString().slice(-6)}`;

    const [regResult] = await connection.execute(`
      INSERT INTO registrations (
        event_id, 
        primary_student_id, 
        participation_mode, 
        team_name, 
        ticket_code, 
        payment_status, 
        amount_paid
      ) VALUES (?, ?, ?, ?, ?, 'Free', 0.00);
    `, [event_id, student_id, participation_mode, team_name || null, ticket_code]);

    const registrationId = regResult.insertId;

    if (participation_mode === 'Team' && Array.isArray(members) && members.length > 0) {
      for (const m of members) {
        await connection.execute(`
          INSERT INTO registration_team_members (
            registration_id, member_name, member_email, member_degree, member_roll_number
          ) VALUES (?, ?, ?, ?, ?);
        `, [registrationId, m.name, m.email, m.degree || 'Student', m.roll || 'N/A']);
      }
    }

    await connection.commit();
    res.status(201).json({
      message: 'Registration committed successfully.',
      ticket_code: ticket_code
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

app.get('/api/users/:userId/registrations', async (req, res) => {
  try {
    const { userId } = req.params;

    const query = `
      SELECT 
        r.registration_id,
        r.ticket_code,
        r.participation_mode,
        r.team_name,
        r.payment_status,
        r.amount_paid,
        e.event_id,
        e.title AS event_title,
        e.category,
        e.start_date,
        e.end_date,
        e.event_venue,
        e.event_city,
        i.name AS host_institution
      FROM registrations r
      JOIN events e ON r.event_id = e.event_id
      JOIN institutions i ON e.institution_id = i.institution_id
      WHERE r.primary_student_id = ?
      ORDER BY r.registration_id DESC;
    `;
    const [rows] = await db.execute(query, [userId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tickets/verify/:ticketCode', async (req, res) => {
  try {
    const { ticketCode } = req.params;
    const query = `
      SELECT 
        r.ticket_code,
        e.title AS event_title,
        e.event_venue,
        r.team_name,
        leader.name AS booked_by
      FROM registrations r
      JOIN events e ON r.event_id = e.event_id
      JOIN users leader ON r.primary_student_id = leader.user_id
      WHERE r.ticket_code = ?;
    `;
    const [rows] = await db.execute(query, [ticketCode]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Invalid Ticket Identifier' });
    }
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 6. PAST GALLERIES MODULE
// ============================================================================

app.get('/api/galleries', async (req, res) => {
  try {
    const query = `
      SELECT 
        g.gallery_id,
        g.title,
        g.event_date,
        g.description,
        i.name AS college_name,
        (SELECT gi.image_data FROM gallery_images gi WHERE gi.gallery_id = g.gallery_id ORDER BY gi.image_id ASC LIMIT 1) AS image_data,
        (SELECT gi.caption FROM gallery_images gi WHERE gi.gallery_id = g.gallery_id ORDER BY gi.image_id ASC LIMIT 1) AS caption
      FROM galleries g
      JOIN institutions i ON g.institution_id = i.institution_id
      ORDER BY g.event_date DESC;
    `;
    const [rows] = await db.execute(query);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/galleries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT 
        g.gallery_id,
        g.title AS album_title,
        g.event_date,
        g.description AS album_desc,
        i.name AS college_name,
        gi.image_id,
        gi.caption,
        gi.image_data
      FROM galleries g
      JOIN institutions i ON g.institution_id = i.institution_id
      LEFT JOIN gallery_images gi ON g.gallery_id = gi.gallery_id
      WHERE g.gallery_id = ?;
    `;
    const [rows] = await db.execute(query, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Gallery record not found.' });
    }
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/organizers/:userId/galleries', async (req, res) => {
  try {
    const { userId } = req.params;
    const query = `
      SELECT 
        g.gallery_id,
        g.title,
        g.event_date,
        g.description,
        (SELECT gi.image_data FROM gallery_images gi WHERE gi.gallery_id = g.gallery_id ORDER BY gi.image_id ASC LIMIT 1) AS image_data,
        (SELECT gi.caption FROM gallery_images gi WHERE gi.gallery_id = g.gallery_id ORDER BY gi.image_id ASC LIMIT 1) AS caption
      FROM galleries g
      WHERE g.organiser_id = ?
      ORDER BY g.event_date DESC;
    `;
    const [rows] = await db.execute(query, [userId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/galleries', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { title, event_date, description, institution_id, image_data, caption, user_id } = req.body;

    if (user_id) {
      const [u] = await connection.execute('SELECT role, is_email_verified FROM users WHERE user_id = ?', [user_id]);
      if (u.length > 0 && u[0].role === 'Organiser' && !u[0].is_email_verified) {
        await connection.rollback();
        return res.status(403).json({ error: 'Gallery upload restricted: Your organiser account is pending verification.' });
      }
    }

    if (!title || !event_date || !image_data) {
      await connection.rollback();
      return res.status(400).json({ error: 'Title, date, and direct image URL are mandatory.' });
    }

    if (image_data.includes('share.google') || image_data.includes('google.com/search')) {
      await connection.rollback();
      return res.status(400).json({ error: 'Please paste a direct image URL (right-click photo -> Copy Image Address), not a Google search share link.' });
    }

    const [galResult] = await connection.execute(`
      INSERT INTO galleries (title, event_date, description, institution_id, organiser_id)
      VALUES (?, ?, ?, ?, ?);
    `, [title, event_date, description || '', institution_id || 1, user_id || 1]);

    const galleryId = galResult.insertId;

    await connection.execute(`
      INSERT INTO gallery_images (gallery_id, image_data, caption)
      VALUES (?, ?, ?);
    `, [galleryId, image_data, caption || 'Event Highlight']);

    await connection.commit();
    res.status(201).json({ message: 'Gallery published successfully!', galleryId });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

app.delete('/api/galleries/:id', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;

    await connection.execute(`DELETE FROM gallery_images WHERE gallery_id = ?;`, [id]);
    await connection.execute(`DELETE FROM galleries WHERE gallery_id = ?;`, [id]);

    await connection.commit();
    res.json({ message: 'Past event gallery deleted successfully.' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

const PORT = 5001;
app.listen(PORT, () => {
  console.log(`DAZZ Server listening on port ${PORT}`);
});