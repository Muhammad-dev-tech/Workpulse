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
      headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
    }, res => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(d || '{}') }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function verifyApprovalPolicyEngine() {
  console.log('=== WORKPULSE UNIVERSAL APPROVAL POLICY VERIFICATION ===\n');

  // 1. Authenticate Personas: Super Admin (VC/Executive), Manager (Muhammad), Employee (Aisha)
  const adminLogin = await post('http://localhost:5000/api/auth/login', { email: 'admin@acme.com', password: 'admin123' });
  const adminToken = adminLogin.data.data.token;
  const adminUser = adminLogin.data.data.user;

  const muhammadLogin = await post('http://localhost:5000/api/auth/login', { email: 'muhammad@acme.com', password: 'manager123' });
  const muhammadToken = muhammadLogin.data.data.token;

  const aishaLogin = await post('http://localhost:5000/api/auth/login', { email: 'aisha@acme.com', password: 'employee123' });
  const aishaToken = aishaLogin.data.data.token;

  console.log('1. Authentication established: Super Admin (Executive), Muhammad (Manager), Aisha (Requester).');

  // 2. Fetch IT Department
  const depts = (await get('http://localhost:5000/api/departments', adminToken)).data.data;
  const itDept = depts.find(d => d.code === 'IT');

  // 3. Test Direct Request: Aisha submits a routine operational request
  // (Software Installation: Direct dispatch, no executive sign-off)
  const directReq = await post('http://localhost:5000/api/requests', {
    title: 'Routine Workstation Setup & Display Config',
    description: 'Direct operational ticket requiring technician setup.',
    departmentId: itDept.id,
    requestTypeId: 'rt-it-1', // Software Installation
    priority: 'MEDIUM'
  }, aishaToken);

  console.log('2. Direct Routine Request Submission:');
  console.log('   - Request ID:', directReq.data.data.requestId);
  console.log('   - Status:', directReq.data.data.status, '(Should be ACTIVE immediately)');
  console.log('   - Step Name:', directReq.data.data.currentStepName);
  console.log('   - Approval Gate Bypassed (Direct):', directReq.data.data.status === 'ACTIVE' ? 'PASS' : 'FAIL');

  // 4. Test Executive Gate Request: Aisha submits an Executive Gate request
  // (Account Access / Special System Override requiring Executive Authorization)
  const execReq = await post('http://localhost:5000/api/requests', {
    title: 'Special System Access & Database Course Rectification',
    description: 'High-stakes student portal course code modification requiring Executive / VC sign-off.',
    departmentId: itDept.id,
    requestTypeId: 'rt-it-2', // Account Access (Requires approval)
    priority: 'HIGH'
  }, aishaToken);

  const reqItem = execReq.data.data;
  console.log('\n3. High-Stakes Governance Request Submission:');
  console.log('   - Request ID:', reqItem.requestId);
  console.log('   - Status:', reqItem.status, '(Should be PENDING_APPROVAL)');
  console.log('   - Step Name:', reqItem.currentStepName);
  console.log('   - Pending Approvals Count:', (reqItem.approvals || []).length);
  console.log('   - Approval Gate Engaged:', reqItem.status === 'PENDING_APPROVAL' ? 'PASS' : 'FAIL');

  const pendingApproval = (reqItem.approvals || [])[0];
  if (!pendingApproval) {
    console.error('FAIL: No pending approval record generated!');
    return;
  }

  // 5. Test Unauthorized Approval Attempt: Aisha (Employee) tries to sign the approval
  const unauthorizedDecision = await post(
    `http://localhost:5000/api/requests/${reqItem.id}/approvals/${pendingApproval.id}`,
    { decision: 'APPROVED', notes: 'Self-approval attempt' },
    aishaToken
  );
  console.log('\n4. Unauthorized Approval Attempt (Employee):');
  console.log('   - HTTP Status:', unauthorizedDecision.status, '(Should be 403 Forbidden)');
  console.log('   - Security Boundary Enforced:', unauthorizedDecision.status === 403 ? 'PASS' : 'FAIL');

  // 6. Test Authorized Approval by Executive (Super Admin / VC)
  const authorizedDecision = await post(
    `http://localhost:5000/api/requests/${reqItem.id}/approvals/${pendingApproval.id}`,
    { decision: 'APPROVED', notes: 'Authorized by Executive Authority. Proceed with operational unlock.' },
    adminToken
  );

  console.log('\n5. Executive Authorization (Super Admin / VC):');
  console.log('   - HTTP Status:', authorizedDecision.status);
  console.log('   - Updated Status:', authorizedDecision.data.data.status, '(Should transition to ACTIVE)');
  console.log('   - Current Step:', authorizedDecision.data.data.currentStepName);
  console.log('   - Transition to ACTIVE on Approval:', authorizedDecision.data.data.status === 'ACTIVE' ? 'PASS' : 'FAIL');

  // 7. Verify Actionable Task Auto-Generated for Department Technicians
  const deptTasks = (await get(`http://localhost:5000/api/tasks?requestId=${reqItem.requestId}`, muhammadToken)).data.data;
  console.log('\n6. Automated Actionable Task Generation:');
  console.log('   - Generated Tasks Count for Request:', deptTasks.length);
  if (deptTasks.length > 0) {
    console.log('   - Task Title:', deptTasks[0].title);
    console.log('   - Task Type:', deptTasks[0].taskType);
    console.log('   - Auto-Task Generated for Technicians:', 'PASS');
  } else {
    console.log('   - Auto-Task Generated for Technicians: FAIL');
  }

  console.log('\n=== UNIVERSAL APPROVAL POLICY & ROUTING VERIFICATION COMPLETE ===');
}

verifyApprovalPolicyEngine().catch(console.error);
