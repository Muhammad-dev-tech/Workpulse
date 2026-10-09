import { Router, Response } from 'express';
import { pulseAiService } from '../ai/pulseAi';
import { requireAuthentication, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Ask Pulse AI
router.post('/query', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const user = req.user!;
  const { query, history } = req.body;

  if (!query || typeof query !== 'string') {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_QUERY', message: 'Query string is required.' }
    });
    return;
  }

  try {
    const response = await pulseAiService.processQuery(user, orgId, query, history);
    res.json({
      success: true,
      data: response
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'AI_ERROR', message: error.message || 'Error processing AI query.' }
    });
  }
});

// Confirm AI Mutating Action
router.post('/confirm-action', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const user = req.user!;
  const { action, parameters } = req.body;

  try {
    const result = await pulseAiService.executeConfirmedAction(user, orgId, action, parameters);
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { code: 'ACTION_FAILED', message: error.message || 'Could not execute action.' }
    });
  }
});

export default router;
