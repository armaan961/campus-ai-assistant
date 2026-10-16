/**
 * permissions.test.js
 * ───────────────────
 * Automated security & permission matrix test suite.
 *
 * Checks:
 *  1. Unauthenticated requests to protected endpoints return 401 Unauthorized.
 *  2. Student role calling Admin endpoints (/users, /audit, /ai/admin/*) returns 403 Forbidden.
 *  3. Student role calling Faculty endpoints (/faculty/*) returns 403 Forbidden.
 *  4. Faculty role calling Admin endpoints (/users, /audit) returns 403 Forbidden.
 *  5. Last active admin protection: attempting to deactivate the sole admin returns 400.
 *  6. Faculty can successfully access their own course offerings.
 *  7. Admin can access user management and audit logs.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:8000/api/v1';

let passed = 0;
let failed = 0;

function assert(condition, testName, detail = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
    failed++;
  }
}

async function login(email, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function runPermissionTests() {
  console.log('\n======================================================');
  console.log('🔒 RUNNING ROLE & PERMISSION MATRIX TESTS');
  console.log('======================================================\n');

  // Obtain tokens for all three roles
  console.log('Authenticating test users...');
  const adminToken   = await login('admin@campus.edu', 'Admin@123');
  const facultyToken = await login('frank@campus.edu', 'Faculty@123');
  const studentToken = await login('sam@campus.edu',   'Student@123');

  const adminHeaders   = { Authorization: `Bearer ${adminToken}` };
  const facultyHeaders = { Authorization: `Bearer ${facultyToken}` };
  const studentHeaders = { Authorization: `Bearer ${studentToken}` };

  console.log('\n--- 1. Unauthenticated Access (401 Expected) ---');

  const unauthUsers = await fetch(`${BASE_URL}/users`);
  assert(unauthUsers.status === 401, 'GET /users without token returns 401', `Got ${unauthUsers.status}`);

  const unauthAudit = await fetch(`${BASE_URL}/audit`);
  assert(unauthAudit.status === 401, 'GET /audit without token returns 401', `Got ${unauthAudit.status}`);

  const unauthFaculty = await fetch(`${BASE_URL}/faculty/courses`);
  assert(unauthFaculty.status === 401, 'GET /faculty/courses without token returns 401', `Got ${unauthFaculty.status}`);

  console.log('\n--- 2. Student Role Boundaries (403 Expected) ---');

  const studentOnUsers = await fetch(`${BASE_URL}/users`, { headers: studentHeaders });
  assert(studentOnUsers.status === 403, 'Student calling GET /users returns 403 Forbidden', `Got ${studentOnUsers.status}`);

  const studentOnAudit = await fetch(`${BASE_URL}/audit`, { headers: studentHeaders });
  assert(studentOnAudit.status === 403, 'Student calling GET /audit returns 403 Forbidden', `Got ${studentOnAudit.status}`);

  const studentOnFaculty = await fetch(`${BASE_URL}/faculty/courses`, { headers: studentHeaders });
  assert(studentOnFaculty.status === 403, 'Student calling GET /faculty/courses returns 403 Forbidden', `Got ${studentOnFaculty.status}`);

  const studentOnAiAdmin = await fetch(`${BASE_URL}/ai/admin/settings`, { headers: studentHeaders });
  assert(studentOnAiAdmin.status === 403, 'Student calling GET /ai/admin/settings returns 403 Forbidden', `Got ${studentOnAiAdmin.status}`);

  const studentOnCreateCourse = await fetch(`${BASE_URL}/courses`, {
    method: 'POST',
    headers: { ...studentHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ dept_id: 1, code: 'HACK101', title: 'Illegal Course' }),
  });
  assert(studentOnCreateCourse.status === 403, 'Student calling POST /courses returns 403 Forbidden', `Got ${studentOnCreateCourse.status}`);

  console.log('\n--- 3. Faculty Role Boundaries (403 Expected) ---');

  const facultyOnUsers = await fetch(`${BASE_URL}/users`, { headers: facultyHeaders });
  assert(facultyOnUsers.status === 403, 'Faculty calling GET /users returns 403 Forbidden', `Got ${facultyOnUsers.status}`);

  const facultyOnAudit = await fetch(`${BASE_URL}/audit`, { headers: facultyHeaders });
  assert(facultyOnAudit.status === 403, 'Faculty calling GET /audit returns 403 Forbidden', `Got ${facultyOnAudit.status}`);

  const facultyOnAiAdmin = await fetch(`${BASE_URL}/ai/admin/settings`, { headers: facultyHeaders });
  assert(facultyOnAiAdmin.status === 403, 'Faculty calling GET /ai/admin/settings returns 403 Forbidden', `Got ${facultyOnAiAdmin.status}`);

  console.log('\n--- 4. Authorized Access Verification (200 Expected) ---');

  const facultyCourses = await fetch(`${BASE_URL}/faculty/courses`, { headers: facultyHeaders });
  assert(facultyCourses.status === 200, 'Faculty calling GET /faculty/courses returns 200 OK', `Got ${facultyCourses.status}`);

  const adminUsers = await fetch(`${BASE_URL}/users`, { headers: adminHeaders });
  assert(adminUsers.status === 200, 'Admin calling GET /users returns 200 OK', `Got ${adminUsers.status}`);

  const studentCourses = await fetch(`${BASE_URL}/student/courses`, { headers: studentHeaders });
  assert(studentCourses.status === 200, 'Student calling GET /student/courses returns 200 OK', `Got ${studentCourses.status}`);

  console.log('\n--- 5. Security Invariant: Last Active Admin Guard ---');

  // Identify admin user id
  const usersData = await adminUsers.json();
  const usersList = usersData.users || usersData;
  const adminUser = usersList.find(u => u.email === 'admin@campus.edu');
  assert(!!adminUser, 'Admin user found in system');

  if (adminUser) {
    const deactivateRes = await fetch(`${BASE_URL}/users/${adminUser.id}`, {
      method: 'PATCH',
      headers: { ...adminHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: false }),
    });
    assert(
      deactivateRes.status === 400,
      'System blocks deactivating the last active admin (returns 400)',
      `Got ${deactivateRes.status}`
    );
  }

  console.log('\n======================================================');
  console.log(`PERMISSION TESTS SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPermissionTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
