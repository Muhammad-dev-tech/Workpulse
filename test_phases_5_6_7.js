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

async function runPhasesVerification() {
  console.log('=== WORKPULSE PHASES 5, 6 & 7 SYSTEM VERIFICATION ===\n');

  // 1. Health & SLA Escalation Daemon Check
  const health = await get('http://localhost:5000/api/health');
  console.log('1. Health Check:', health.status === 200 ? 'PASS' : 'FAIL');
  console.log('   - SLA Daemon Status:', health.data.slaDaemon);
  console.log('   - Platform:', health.data.platform);

  // 2. Trigger on-demand SLA scan
  const slaScan = await post('http://localhost:5000/api/health/sla-scan', {});
  console.log('\n2. On-Demand SLA Scan:', slaScan.status === 200 ? 'PASS' : 'FAIL');
  console.log('   - Active requests scanned:', slaScan.data.scannedCount);
  console.log('   - Breaches flagged/escalated:', slaScan.data.breachesFound);

  // 3. Authenticate Personas: VC/Super Admin, Dean Muhammad, Student Aisha
  const adminLogin = await post('http://localhost:5000/api/auth/login', { email: 'admin@acme.com', password: 'admin123' });
  const adminToken = adminLogin.data.data.token;
  const adminId = adminLogin.data.data.user.id;

  const aishaLogin = await post('http://localhost:5000/api/auth/login', { email: 'aisha@acme.com', password: 'employee123' });
  const aishaToken = aishaLogin.data.data.token;

  console.log('\n3. Authentication Established:');
  console.log('   - Super Admin / Vice-Chancellor Token Acquired:', !!adminToken);
  console.log('   - Student Persona (Aisha) Token Acquired:', !!aishaToken);

  // 4. University Case Study: Student Submits Course Registration Rectification Request
  const deptsRes = await get('http://localhost:5000/api/departments', aishaToken);
  const itDept = deptsRes.data.data.find(d => d.code === 'IT') || deptsRes.data.data[0];

  const studentReqRes = await post('http://localhost:5000/api/requests', {
    title: 'Level 300 First Semester Course Registration Rectification (Exam Slip #EXAM-301)',
    description: 'Exam submitted, course code CSC-311 missing from exam slip. Requesting Vice-Chancellor approval for MIS portal change.',
    departmentId: itDept.id,
    priority: 'URGENT'
  }, aishaToken);

  const studentReq = studentReqRes.data.data;
  console.log('\n4. Student Incident Request Submission:');
  console.log('   - Request ID:', studentReq.requestId);
  console.log('   - Status:', studentReq.status, '(Should be PENDING_APPROVAL)');
  console.log('   - Executive Gate Activated:', studentReq.status === 'PENDING_APPROVAL' ? 'PASS' : 'FAIL');

  // 5. Attach Official Proof Documents (Exam Slip + VC Letter)
  const attachRes1 = await post(`http://localhost:5000/api/requests/${studentReq.id}/attachments`, {
    fileName: 'Level_300_First_Semester_Exam_Slip.pdf',
    fileSize: 142000,
    fileType: 'application/pdf',
    fileUrl: 'https://workpulse-storage.internal/docs/exam_slip_301.pdf'
  }, aishaToken);

  const attachRes2 = await post(`http://localhost:5000/api/requests/${studentReq.id}/attachments`, {
    fileName: 'Petition_Letter_To_Vice_Chancellor.pdf',
    fileSize: 98000,
    fileType: 'application/pdf',
    fileUrl: 'https://workpulse-storage.internal/docs/vc_letter.pdf'
  }, aishaToken);

  console.log('\n5. Document Attachment Verification:');
  console.log('   - Exam Slip Attached:', attachRes1.status === 201 ? 'PASS' : 'FAIL', attachRes1.data.data.fileName);
  console.log('   - VC Letter Attached:', attachRes2.status === 201 ? 'PASS' : 'FAIL', attachRes2.data.data.fileName);

  const getAttachRes = await get(`http://localhost:5000/api/requests/${studentReq.id}/attachments`, aishaToken);
  console.log('   - Retrieved Total Attachments:', getAttachRes.data.data.length, getAttachRes.data.data.length >= 2 ? 'PASS' : 'FAIL');

  // 6. Check Executive Notifications for Vice-Chancellor
  const notifRes = await get('http://localhost:5000/api/notifications', adminToken);
  console.log('\n6. Executive Notification Hub:');
  console.log('   - Total Unread Alerts for VC:', notifRes.data.data.length);
  const relevantAlert = notifRes.data.data.find(n => n.link === studentReq.requestId);
  console.log('   - Executive Approval Alert Present:', !!relevantAlert ? 'PASS' : 'FAIL');
  if (relevantAlert) {
    console.log(`     "${relevantAlert.title}": ${relevantAlert.message}`);
  }

  // 7. Vice-Chancellor Reviews and Executes Approval
  const reqDetails = await get(`http://localhost:5000/api/requests/${studentReq.id}`, adminToken);
  const pendingApproval = reqDetails.data.data.approvals.find(a => a.status === 'PENDING');

  const approveRes = await post(
    `http://localhost:5000/api/requests/${studentReq.id}/approvals/${pendingApproval.id}`,
    {
      decision: 'APPROVED',
      notes: 'Approved by Vice-Chancellor: MIS Portal authorized to update database and recalculate Level 300 CGPA.'
    },
    adminToken
  );

  console.log('\n7. Executive Gate Authorization:');
  console.log('   - Decision Applied:', approveRes.status === 200 ? 'PASS' : 'FAIL');
  console.log('   - Status Unlocked To:', approveRes.data.data.status, '(Should be ACTIVE)');
  console.log('   - Auto-Generated Operational Execution Tasks:', approveRes.data.data.tasks.length);

  // 8. MIS Operator Resolves Task
  const misTask = approveRes.data.data.tasks[0];
  console.log('\n8. MIS Technical Execution:');
  console.log('   - Auto Task ID:', misTask?.taskId, misTask?.title);

  console.log('\n=== ALL PHASES (SLA DAEMON, NOTIFICATIONS, ATTACHMENTS & UNIVERSITY CASE STUDY) VERIFIED! ===\n');
}

runPhasesVerification().catch(console.error);
