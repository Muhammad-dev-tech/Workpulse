import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { userRepository, organizationRepository, auditRepository, wipeOrgData } from '../repositories';
import { generateToken, requireAuthentication, AuthenticatedRequest } from '../middleware/auth';
import { UserRole } from '../types';

const router = Router();

// ──────────────────────────────────────────────────────────────────────
//  GET /api/auth/organizations — list available organizations for registration
// ──────────────────────────────────────────────────────────────────────
router.get('/organizations', async (req, res: Response) => {
  try {
    const orgs = await organizationRepository.findAll();
    res.json({
      success: true,
      data: orgs.map(o => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        plan: o.plan
      }))
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ORGS_FAILED', message: err.message || 'Failed to list organizations.' }
    });
  }
});

// ──────────────────────────────────────────────────────────────────────
//  POST /api/auth/register — sign up a new user or new organization admin
// ──────────────────────────────────────────────────────────────────────
router.post('/register', async (req, res: Response) => {
  const { name, email, password, organizationName, organizationId } = req.body;

  if (!name || !name.trim()) {
    res.status(400).json({
      success: false,
      error: { code: 'MISSING_NAME', message: 'Full name is required.' }
    });
    return;
  }

  if (!email || !email.trim()) {
    res.status(400).json({
      success: false,
      error: { code: 'MISSING_EMAIL', message: 'Email address is required.' }
    });
    return;
  }

  if (!password || password.length < 6) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_PASSWORD', message: 'Password must be at least 6 characters.' }
    });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();
  const existingUser = await userRepository.findByEmail(cleanEmail);
  if (existingUser) {
    res.status(409).json({
      success: false,
      error: { code: 'USER_EXISTS', message: 'An account with this email address already exists. Please sign in.' }
    });
    return;
  }

  try {
    let targetOrgId: string;
    let assignedRole: UserRole = 'EMPLOYEE';

    if (organizationName && organizationName.trim()) {
      // User is creating a brand new Organization -> Becomes Super Admin!
      const newOrg = await organizationRepository.create({ name: organizationName.trim() });
      targetOrgId = newOrg.id;
      assignedRole = 'SUPER_ADMIN';
    } else if (organizationId) {
      const existingOrg = await organizationRepository.findById(organizationId);
      if (!existingOrg) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ORG', message: 'Selected organization was not found.' }
        });
        return;
      }
      targetOrgId = existingOrg.id;
      // If no users exist yet in this org, make this user admin
      const orgUsers = await userRepository.findAll(targetOrgId);
      if (orgUsers.length === 0) {
        assignedRole = 'SUPER_ADMIN';
      }
    } else {
      // Fallback: check all organizations
      const allOrgs = await organizationRepository.findAll();
      if (allOrgs.length === 0) {
        const defaultOrg = await organizationRepository.create({ name: 'My Organization' });
        targetOrgId = defaultOrg.id;
        assignedRole = 'SUPER_ADMIN';
      } else {
        targetOrgId = allOrgs[0].id;
        const orgUsers = await userRepository.findAll(targetOrgId);
        if (orgUsers.length === 0) {
          assignedRole = 'SUPER_ADMIN';
        }
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await userRepository.create({
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      role: assignedRole,
      organizationId: targetOrgId,
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}`
    });

    try {
      await auditRepository.log(
        targetOrgId,
        { id: newUser.id, name: newUser.name, role: newUser.role },
        'USER_REGISTERED',
        'User',
        newUser.id,
        { email: newUser.email, role: newUser.role, organizationId: targetOrgId }
      );
    } catch {
      // Non-fatal if audit logging encounters schema check
    }

    const token = generateToken(newUser);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          departmentId: newUser.departmentId,
          organizationId: newUser.organizationId,
          avatarUrl: newUser.avatarUrl
        },
        token
      }
    });
  } catch (err: any) {
    console.error('Registration failed:', err);
    res.status(500).json({
      success: false,
      error: { code: 'REGISTRATION_FAILED', message: err.message || 'Failed to complete registration.' }
    });
  }
});

// ──────────────────────────────────────────────────────────────────────
//  POST /api/auth/login
//  Accepts: { email, password }
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

  // If user has a password hash -> verify with bcrypt
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
//  POST /api/auth/reset-data — clear all demo data and start afresh (Super Admin only)
// ──────────────────────────────────────────────────────────────────────
router.post('/reset-data', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  const u = req.user!;
  if (u.role !== 'SUPER_ADMIN' && u.role !== 'ORG_ADMIN') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Only Administrators can wipe organization data.' }
    });
    return;
  }

  try {
    const { wipeDepartments } = req.body;
    await wipeOrgData(u.organizationId, { wipeDepartments: !!wipeDepartments });

    await auditRepository.log(
      u.organizationId,
      { id: u.id, name: u.name, role: u.role },
      'DATA_CLEARED_FRESH_START',
      'Organization',
      u.organizationId,
      { wipeDepartments: !!wipeDepartments }
    );

    res.json({
      success: true,
      message: 'All demo and operational workflow records cleared. Clean slate initialized.'
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'RESET_FAILED', message: err.message || 'Failed to wipe data.' }
    });
  }
});

// ──────────────────────────────────────────────────────────────────────
//  GET /api/auth/personas  — list users for demonstration switch
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

