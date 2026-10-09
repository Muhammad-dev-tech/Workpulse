import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, UserRole, RequestItem } from '../types';
import { userRepository } from '../repositories';

const JWT_SECRET = process.env.JWT_SECRET || 'workpulse-production-secret-jwt-key-2026';

// Extend Express Request
export interface AuthenticatedRequest extends Request {
  user?: User;
  organizationId?: string;
}

// Role Permission Hierarchy
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  SUPER_ADMIN: ['*'],
  ORG_ADMIN: [
    'organization:manage',
    'users:manage',
    'department:manage',
    'department:assign_manager',
    'workflow:manage',
    'request:view_all',
    'request:create',
    'request:update',
    'request:delete',
    'request:assign',
    'request:approve',
    'task:manage',
    'analytics:view',
    'audit:view'
  ],
  MANAGER: [
    'department:view',
    'workflow:view',
    'request:view_dept',
    'request:create',
    'request:update',
    'request:assign',
    'request:approve',
    'task:assign',
    'task:manage_dept',
    'analytics:view_dept'
  ],
  OPERATOR: [
    'department:view',
    'workflow:view',
    'request:view',
    'request:update',
    'task:work',
    'comment:create'
  ],
  EMPLOYEE: [
    'request:create',
    'request:view_own',
    'task:view_assigned',
    'task:update_assigned',
    'comment:create'
  ]
};

export const requireAuthentication = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Bearer token missing.' }
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; orgId: string };
    const user = await userRepository.findById(decoded.userId);

    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_USER', message: 'User session no longer valid.' }
      });
      return;
    }

    req.user = user;
    req.organizationId = user.organizationId;
    next();
  } catch (err) {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Token expired or invalid.' }
    });
    return;
  }
};

export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' }
      });
      return;
    }

    const permissions = ROLE_PERMISSIONS[req.user.role] || [];
    const hasPermission = permissions.includes('*') || permissions.includes(permission);

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Requires permission: '${permission}'.`
        }
      });
      return;
    }

    next();
  };
};

/**
 * Backend Department Scope Security Check
 * Verifies if user has authority to access data for a given department.
 */
export const canUserAccessDepartment = (user: User, departmentId: string): boolean => {
  if (user.role === 'SUPER_ADMIN' || user.role === 'ORG_ADMIN') {
    return true;
  }
  if (user.role === 'MANAGER') {
    return user.departmentId === departmentId;
  }
  // Employees can access their own department
  return user.departmentId === departmentId;
};

/**
 * Backend Request Resource Check
 * Implements: USER -> ROLE -> PERMISSIONS -> ORGANIZATION SCOPE -> DEPARTMENT SCOPE -> RESOURCE ACCESS
 */
export const canUserAccessRequest = (user: User, request: RequestItem): boolean => {
  if (user.role === 'SUPER_ADMIN' || user.role === 'ORG_ADMIN') {
    return true;
  }
  // If user is requester or assignee, always accessible
  if (request.requesterId === user.id || request.assigneeId === user.id) {
    return true;
  }
  // Check if any task inside is assigned to this user
  if (request.tasks && request.tasks.some(t => t.assigneeId === user.id)) {
    return true;
  }
  // If Manager, accessible only if request belongs to their department
  if (user.role === 'MANAGER' && user.departmentId === request.departmentId) {
    return true;
  }
  return false;
};

export const generateToken = (user: User): string => {
  return jwt.sign(
    { userId: user.id, orgId: user.organizationId, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};
