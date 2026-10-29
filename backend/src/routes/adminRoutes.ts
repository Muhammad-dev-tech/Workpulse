import { Router, Response } from 'express';
import {
  organizationRepository,
  userRepository,
  departmentRepository,
  requestRepository,
  taskRepository
} from '../repositories';
import { requireAuthentication, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Middleware: ensure caller is the overall Platform Super Admin
const requireSuperAdmin = (req: AuthenticatedRequest, res: Response, next: () => void) => {
  if (!req.user || req.user.role !== 'SUPER_ADMIN') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Platform Super Admin access required.' }
    });
    return;
  }
  next();
};

/**
 * GET /api/admin/organizations
 * Returns all organizations with their designated Org Admin / Superadmin,
 * along with department count, user count, and request metrics.
 */
router.get('/organizations', requireAuthentication, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgs = await organizationRepository.findAll();

    const results = await Promise.all(
      orgs.map(async (org) => {
        const [orgUsers, orgDepts, orgReqs, orgTasks] = await Promise.all([
          userRepository.findAll(org.id),
          departmentRepository.findAll(org.id),
          requestRepository.findAll(org.id),
          taskRepository.findAll(org.id)
        ]);

        // Find the primary Organization Admin / Superadmin of this org
        const primaryAdmin = orgUsers.find(u => u.role === 'SUPER_ADMIN' || u.role === 'ORG_ADMIN') || orgUsers[0] || null;

        const activeReqs = orgReqs.filter(r => r.status !== 'COMPLETED' && r.status !== 'CANCELLED');
        const waitingReqs = orgReqs.filter(r => r.status === 'WAITING' || !!r.waitingOn);
        const completedReqs = orgReqs.filter(r => r.status === 'COMPLETED');

        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          orgType: (org as any).orgType || 'COMPANY',
          plan: org.plan || 'standard',
          createdAt: org.createdAt,
          admin: primaryAdmin ? {
            id: primaryAdmin.id,
            name: primaryAdmin.name,
            email: primaryAdmin.email,
            role: primaryAdmin.role,
            avatarUrl: primaryAdmin.avatarUrl,
            departmentId: primaryAdmin.departmentId,
            createdAt: primaryAdmin.createdAt
          } : null,
          stats: {
            usersCount: orgUsers.length,
            departmentsCount: orgDepts.length,
            requestsCount: orgReqs.length,
            activeRequestsCount: activeReqs.length,
            waitingRequestsCount: waitingReqs.length,
            completedRequestsCount: completedReqs.length,
            tasksCount: orgTasks.length
          }
        };
      })
    );

    res.json({
      success: true,
      data: results
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ADMIN_ORGS_FAILED', message: err.message || 'Failed to list organizations.' }
    });
  }
});

/**
 * GET /api/admin/stats
 * Global platform KPI summary
 */
router.get('/stats', requireAuthentication, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgs = await organizationRepository.findAll();
    let totalUsers = 0;
    let totalDepartments = 0;
    let totalRequests = 0;
    let totalActive = 0;
    let totalWaiting = 0;
    let totalCompleted = 0;

    for (const org of orgs) {
      const [u, d, r] = await Promise.all([
        userRepository.findAll(org.id),
        departmentRepository.findAll(org.id),
        requestRepository.findAll(org.id)
      ]);
      totalUsers += u.length;
      totalDepartments += d.length;
      totalRequests += r.length;
      totalActive += r.filter(x => x.status !== 'COMPLETED' && x.status !== 'CANCELLED').length;
      totalWaiting += r.filter(x => x.status === 'WAITING' || !!x.waitingOn).length;
      totalCompleted += r.filter(x => x.status === 'COMPLETED').length;
    }

    res.json({
      success: true,
      data: {
        totalOrganizations: orgs.length,
        totalUsers,
        totalDepartments,
        totalRequests,
        totalActive,
        totalWaiting,
        totalCompleted,
        platformSuperAdmin: {
          name: req.user?.name,
          email: req.user?.email,
          role: req.user?.role
        }
      }
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ADMIN_STATS_FAILED', message: err.message || 'Failed to fetch platform stats.' }
    });
  }
});

export default router;
