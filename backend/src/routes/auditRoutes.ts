import { Router, Response } from 'express';
import { auditRepository } from '../repositories';
import { requireAuthentication, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.get('/', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const user = req.user!;
  const { limit, actorId, resourceType } = req.query;

  // Authorization check: Only Admins and Managers can inspect audit trail
  if (user.role === 'EMPLOYEE' || user.role === 'OPERATOR') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Audit logs are restricted to Managers and Administrators.' }
    });
    return;
  }

  const logs = await auditRepository.findAll(orgId, {
    actorId: actorId ? String(actorId) : undefined,
    resourceType: resourceType ? String(resourceType) : undefined,
    limit: limit ? Number(limit) : 100
  });

  res.json({ success: true, data: logs });
});

export default router;
