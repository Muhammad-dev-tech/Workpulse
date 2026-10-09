import { Router, Response } from 'express';
import { workflowRepository } from '../repositories';
import { requireAuthentication, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.get('/', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const workflows = await workflowRepository.findAll(orgId);
  res.json({ success: true, data: workflows });
});

router.get('/:id', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const wf = await workflowRepository.findById(orgId, req.params.id);
  if (!wf) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Workflow template not found' } });
    return;
  }
  res.json({ success: true, data: wf });
});

export default router;
