import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { userRepository, organizationRepository, departmentRepository, auditRepository, wipeOrgData } from '../repositories';
import { generateToken, requireAuthentication, AuthenticatedRequest } from '../middleware/auth';
import { User, UserRole } from '../types';
import { ORGANIZATION_TYPES, normalizeOrgType, inferOrgTypeFromName } from '../config/terminology';
import { getFacultyForDean } from './departmentRoutes';

const router = Router();

/** Public user shape returned to the client, enriched with org context. */
async function toSessionUser(user: User) {
  let org = await organizationRepository.findById(user.organizationId);
  if (!org && user.organizationId) {
    const all = await organizationRepository.findAll();
    org = all.find(o => o.id === user.organizationId) || null;
  }
  const faculty = getFacultyForDean(user.organizationId, user.id, user.faculty);
  const resolvedOrgType = normalizeOrgType(
    org?.orgType,
    org?.name || (faculty || user.role === 'DEAN' || user.email.includes('.edu') ? 'University' : undefined)
  );
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    departmentId: user.departmentId,
    faculty,
    organizationId: user.organizationId,
    organizationName: org?.name || (resolvedOrgType === 'UNIVERSITY' ? 'University' : undefined),
    organizationType: resolvedOrgType,
    avatarUrl: user.avatarUrl
  };
}

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
        plan: o.plan,
        orgType: normalizeOrgType(o.orgType)
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
//  GET /api/auth/departments — list departments for an organization during registration
// ──────────────────────────────────────────────────────────────────────
router.get('/departments', async (req, res: Response) => {
  try {
    const orgId = req.query.organizationId as string;
    if (!orgId) {
      res.json({ success: true, data: [] });
      return;
    }
    const depts = await departmentRepository.findAll(orgId);
    res.json({
      success: true,
      data: depts.map(d => ({
        id: d.id,
        name: d.name,
        code: d.code
      }))
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_DEPTS_FAILED', message: err.message || 'Failed to list departments.' }
    });
  }
});

// ──────────────────────────────────────────────────────────────────────
//  POST /api/auth/register — sign up a new user or new organization admin
// ──────────────────────────────────────────────────────────────────────
router.post('/register', async (req, res: Response) => {
  const { name, email, password, organizationName, organizationType, organizationId, role, departmentId } = req.body;

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
      if (organizationType && !(ORGANIZATION_TYPES as string[]).includes(organizationType)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ORG_TYPE', message: 'Please choose a valid organization type.' }
        });
        return;
      }
      let resolvedOrgType = normalizeOrgType(organizationType);
      if (resolvedOrgType === 'COMPANY') {
        const inferred = inferOrgTypeFromName(organizationName);
        if (inferred !== 'COMPANY') {
          resolvedOrgType = inferred;
        }
      }
      const newOrg = await organizationRepository.create({
        name: organizationName.trim(),
        orgType: resolvedOrgType
      });
      targetOrgId = newOrg.id;
      assignedRole = 'ORG_ADMIN';
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
      // If no users exist yet in this org, make this user org admin
      const orgUsers = await userRepository.findAll(targetOrgId);
      if (orgUsers.length === 0) {
        assignedRole = 'ORG_ADMIN';
      } else {
        // Enforce bottom hierarchy rule: every member joining an existing organization
        // enters at the bottom tier (EMPLOYEE = Staff in University, Employee in Company).
        // The Org Admin appoints representatives and elevated roles.
        assignedRole = 'EMPLOYEE';
      }
    } else {
      // Fallback: check all organizations
      const allOrgs = await organizationRepository.findAll();
      if (allOrgs.length === 0) {
        const defaultOrg = await organizationRepository.create({ name: 'My Organization' });
        targetOrgId = defaultOrg.id;
        assignedRole = 'ORG_ADMIN';
      } else {
        targetOrgId = allOrgs[0].id;
        const orgUsers = await userRepository.findAll(targetOrgId);
        if (orgUsers.length === 0) {
          assignedRole = 'ORG_ADMIN';
        } else {
          assignedRole = 'EMPLOYEE';
        }
      }
    }

    // Platform Security Rule: admin@acme.com is the ONLY account permitted as overall platform SUPER_ADMIN
    if (cleanEmail === 'admin@acme.com') {
      assignedRole = 'SUPER_ADMIN';
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await userRepository.create({
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      role: assignedRole,
      departmentId: departmentId || undefined,
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
        user: await toSessionUser(newUser),
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
      user: await toSessionUser(user),
      token
    }
  });
});

// ──────────────────────────────────────────────────────────────────────
//  GET /api/auth/me  — return current session user
// ──────────────────────────────────────────────────────────────────────
router.get('/me', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: await toSessionUser(req.user!)
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
//  GET /api/auth/personas  — list members of the signed-in user's organization
// ──────────────────────────────────────────────────────────────────────
router.get('/personas', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  const users = await userRepository.findAll(req.user!.organizationId);
  res.json({
    success: true,
    data: users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      departmentId: u.departmentId,
      faculty: getFacultyForDean(u.organizationId, u.id, u.faculty),
      avatarUrl: u.avatarUrl
    }))
  });
});

export default router;

