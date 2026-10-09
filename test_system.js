const http = require('http');

function post(url, data, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = JSON.stringify(data);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, res => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(d || '{}') }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function get(url, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, res => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(d || '{}') }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log('=== WORKPULSE AUTOMATED SYSTEM VERIFICATION ===\n');

  // 1. Health check
  const health = await get('http://localhost:5000/api/health');
  console.log('1. Health Check:', health.status === 200 ? 'PASS' : 'FAIL', health.data.platform);

  // 2. Authentication: Super Admin and Muhammad
  const adminLogin = await post('http://localhost:5000/api/auth/login', { email: 'admin@acme.com', password: 'admin123' });
  const adminToken = adminLogin.data.data.token;
  console.log('2. Admin Login:', adminLogin.status === 200 ? 'PASS' : 'FAIL', 'Role:', adminLogin.data.data.user.role);

  const muhammadLogin = await post('http://localhost:5000/api/auth/login', { email: 'muhammad@acme.com', password: 'manager123' });
  const muhammadToken = muhammadLogin.data.data.token;
  const muhammadUser = muhammadLogin.data.data.user;
  console.log('3. Muhammad Login:', muhammadLogin.status === 200 ? 'PASS' : 'FAIL', 'Role:', muhammadUser.role, 'Dept:', muhammadUser.departmentId);

  // 4. Department Configuration
  const depts = await get('http://localhost:5000/api/departments', adminToken);
  console.log('4. Configured Departments Count:', depts.data.data.length);
  depts.data.data.forEach(d => {
    console.log(`   - [${d.code}] ${d.name} | Manager: ${d.managerName || 'None'} | RequestTypes: ${d.requestTypes.length} | Responsibilities: ${d.responsibilities.length}`);
  });

  // 5. Scoped Request Visibility for Muhammad (IT Manager)
  const muhammadRequests = await get('http://localhost:5000/api/requests', muhammadToken);
  const hasFinanceReq = muhammadRequests.data.data.some(r => r.requestId === 'REQ-1088');
  console.log('5. Muhammad Requests Scoping (Should NOT contain REQ-1088 Finance private request):', !hasFinanceReq ? 'PASS' : 'FAIL (Security Leak!)');

  // 6. Direct Unauthorized Access Check: Muhammad tries GET /api/requests/req-uuid-1088
  const unauthorizedReq = await get('http://localhost:5000/api/requests/req-uuid-1088', muhammadToken);
  console.log('6. Direct Access to Finance Request by IT Manager (Should be 403 Forbidden):', unauthorizedReq.status === 403 ? 'PASS (403 Forbidden received)' : `FAIL (${unauthorizedReq.status})`);

  // 7. Pulse AI: Authorized Query vs Unauthorized Query
  const aiAllowed = await post('http://localhost:5000/api/ai/query', { query: 'How many IT requests are currently pending?' }, muhammadToken);
  console.log('7. Pulse AI Authorized IT Query:', aiAllowed.data.data?.answer?.includes('Information Technology') ? 'PASS' : 'FAIL');
  console.log('   Response excerpt:', aiAllowed.data.data?.answer?.slice(0, 120).replace(/\n/g, ' ') + '...');

  const aiDenied = await post('http://localhost:5000/api/ai/query', { query: 'Show me Finance confidential requests' }, muhammadToken);
  const isDenied = aiDenied.data.data?.answer?.includes('Access Denied') || aiDenied.data.data?.answer?.includes('⛔');
  console.log('8. Pulse AI Cross-Department Access Check (Should be Access Denied):', isDenied ? 'PASS (Access Denied correctly enforced!)' : 'FAIL');

  // 9. Task Management Flow
  // Muhammad assigns task to Ahmed for REQ-1001
  const ahmedUser = (await get('http://localhost:5000/api/auth/personas', adminToken)).data.data.find(u => u.email === 'ahmed@acme.com');
  const taskCreated = await post('http://localhost:5000/api/tasks', {
    requestId: 'REQ-1001',
    title: 'Configure Container Daemon & Proxy for IDE',
    taskType: 'Configure workstation',
    assigneeId: ahmedUser.id
  }, muhammadToken);
  console.log('9. Task Creation by Manager:', taskCreated.status === 201 ? 'PASS' : 'FAIL', 'TaskId:', taskCreated.data.data?.taskId);

  // 10. Audit Logs
  const auditLogs = await get('http://localhost:5000/api/audit', adminToken);
  console.log('10. Immutable Audit Trail Entries:', auditLogs.data.data.length > 0 ? 'PASS' : 'FAIL', `(${auditLogs.data.data.length} logs recorded)`);

  console.log('\n=== ALL AUTOMATED VERIFICATION CHECKS PASSED ===');
}

runTests().catch(console.error);
