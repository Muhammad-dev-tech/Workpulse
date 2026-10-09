import { requestRepository, departmentRepository, notificationRepository, userRepository, auditRepository } from '../repositories';

let daemonInterval: NodeJS.Timeout | null = null;
const scannedBreaches = new Set<string>();

export async function runSlaScan(): Promise<{ scannedCount: number; breachesFound: number }> {
  try {
    const orgId = 'org-acme-1'; // Default organization
    const activeRequests = await requestRepository.findAll(orgId, {});

    const now = new Date();
    let breachesFound = 0;

    for (const req of activeRequests) {
      if (req.status === 'COMPLETED' || req.status === 'CANCELLED' || req.status === 'REJECTED') {
        continue;
      }

      if (req.dueDate) {
        const due = new Date(req.dueDate);
        if (due < now) {
          // It's overdue! Check if we already alerted for this request
          if (!scannedBreaches.has(req.requestId)) {
            scannedBreaches.add(req.requestId);
            breachesFound++;

            console.warn(`[SLA DAEMON] ⚠️ SLA Breach detected for ${req.requestId} ("${req.title}"). Due was ${req.dueDate}. Escalating...`);

            // Update request waiting status
            await requestRepository.update(orgId, req.id, {
              waitingOn: req.waitingOn || 'SLA Escalation: Overdue Deadline',
              waitingSince: req.waitingSince || now.toISOString()
            });

            // Add timeline event
            await requestRepository.addTimelineEvent(orgId, req.requestId, {
              actorId: 'system-sla-daemon',
              actorName: 'WorkPulse SLA Monitor',
              eventType: 'SLA_BREACH',
              title: 'SLA Escalation: Deadline Breached',
              details: `Request exceeded scheduled deadline (${due.toLocaleString()}). Automatically flagged as urgent blocker.`
            });

            // Find department manager to notify
            const dept = await departmentRepository.findById(orgId, req.departmentId);
            const managerId = dept?.managerId;

            if (managerId) {
              await notificationRepository.create({
                userId: managerId,
                organizationId: orgId,
                title: `🚨 Urgent SLA Breach: ${req.requestId}`,
                message: `Request "${req.title}" in ${dept?.name || 'Department'} has breached its SLA deadline. Immediate action required.`,
                type: 'SYSTEM',
                link: req.requestId,
                read: false
              });
            }

            // Notify assignee if assigned
            if (req.assigneeId && req.assigneeId !== managerId) {
              await notificationRepository.create({
                userId: req.assigneeId,
                organizationId: orgId,
                title: `🚨 SLA Overdue: ${req.requestId}`,
                message: `Your assigned request "${req.title}" has breached its SLA target.`,
                type: 'SYSTEM',
                link: req.requestId,
                read: false
              });
            }
          }
        }
      }
    }

    return { scannedCount: activeRequests.length, breachesFound };
  } catch (err) {
    console.error('[SLA DAEMON] Scan error:', err);
    return { scannedCount: 0, breachesFound: 0 };
  }
}

export function startSlaDaemon(intervalMs = 30000) {
  if (daemonInterval) return;

  console.log(`  ⏱️  SLA Escalation Daemon initialized (scanning every ${intervalMs / 1000}s)`);

  // Run initial scan after 5 seconds to let server finish bootstrapping
  setTimeout(() => {
    runSlaScan();
  }, 5000);

  daemonInterval = setInterval(runSlaScan, intervalMs);
}

export function stopSlaDaemon() {
  if (daemonInterval) {
    clearInterval(daemonInterval);
    daemonInterval = null;
  }
}
