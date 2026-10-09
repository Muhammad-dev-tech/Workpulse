import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { userRepository } from '../repositories';
import { generateToken, requireAuthentication, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// ──────────────────────────────────────────────────────────────────────
//  POST /api/auth/login
//  Accepts: { email, password }
//  Falls back to email-only (no password) for in-memory demo mode when
//  passwordHash is not set on the user record.
// ──────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res: Response) => {
  const { email, password } = req.body;

  if (!email) {
    res.status(400).json({
      success: false,
      error: { code: 'MISSING_EMAIL', message: 'Email is required.' }
    });
    return;
  }

  const user = await userRepository.findByEmail(email.trim().toLowerCase());

  if (!user) {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' }
    });
    return;
  }

  // If user has a password hash (Supabase mode) → verify with bcrypt
  if (user.passwordHash) {
    if (!password) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_PASSWORD', message: 'Password is required.' }
      });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' }
      });
      return;
    }
  }
  // If no passwordHash (in-memory demo mode) → email-only login allowed

  const token = generateToken(user);

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId: user.departmentId,
        organizationId: user.organizationId,
        avatarUrl: user.avatarUrl
      },
      token
    }
  });
});

// ──────────────────────────────────────────────────────────────────────
//  GET /api/auth/me  — return current session user
// ──────────────────────────────────────────────────────────────────────
router.get('/me', requireAuthentication, (req: AuthenticatedRequest, res: Response) => {
  const u = req.user!;
  res.json({
    success: true,
    data: {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      departmentId: u.departmentId,
      organizationId: u.organizationId,
      avatarUrl: u.avatarUrl
    }
  });
});

// ──────────────────────────────────────────────────────────────────────
//  GET /api/auth/personas  — list demo users (dev helper, remove in prod)
// ──────────────────────────────────────────────────────────────────────
router.get('/personas', async (req, res: Response) => {
  const users = await userRepository.findAll('org-acme-1');
  res.json({
    success: true,
    data: users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      departmentId: u.departmentId,
      avatarUrl: u.avatarUrl
    }))
  });
});

export default router;
