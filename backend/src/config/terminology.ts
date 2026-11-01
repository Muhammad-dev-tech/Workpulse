import { UserRole } from '../types';

/**
 * Organization types supported by WorkPulse.
 * Each type maps the generic internal roles to the titles people in that
 * kind of organization actually use, so the UI never shows mashed-up
 * labels like "Vice-Chancellor / CEO / Super Admin".
 */
export type OrganizationType =
  | 'COMPANY'
  | 'UNIVERSITY'
  | 'SCHOOL'
  | 'HOSPITAL'
  | 'GOVERNMENT'
  | 'NGO';

export const ORGANIZATION_TYPES: OrganizationType[] = [
  'COMPANY',
  'UNIVERSITY',
  'SCHOOL',
  'HOSPITAL',
  'GOVERNMENT',
  'NGO'
];

export const DEFAULT_ORGANIZATION_TYPE: OrganizationType = 'COMPANY';

export interface OrgTerminology {
  label: string;
  roles: Record<UserRole, string>;
  /** Name for a single unit (e.g. Department, Unit, Program). */
  unit: string;
  /** Name for the grouping a Tier-2 approver oversees (e.g. Faculty, Division). */
  division: string;
}

export const TERMINOLOGY: Record<OrganizationType, OrgTerminology> = {
  COMPANY: {
    label: 'Company',
    roles: {
      SUPER_ADMIN: 'Platform Super Admin',
      ORG_ADMIN: 'Chief Executive Officer',
      DEAN: 'Director',
      MANAGER: 'Department Manager',
      EMPLOYEE: 'Employee',
      OPERATOR: 'Operator'
    },
    unit: 'Department',
    division: 'Division'
  },
  UNIVERSITY: {
    label: 'University',
    roles: {
      SUPER_ADMIN: 'Platform Super Admin',
      ORG_ADMIN: 'Vice-Chancellor',
      DEAN: 'Dean',
      MANAGER: 'Head of Department',
      EMPLOYEE: 'Staff',
      OPERATOR: 'Officer'
    },
    unit: 'Department',
    division: 'Faculty'
  },
  SCHOOL: {
    label: 'School',
    roles: {
      SUPER_ADMIN: 'Platform Super Admin',
      ORG_ADMIN: 'Principal',
      DEAN: 'Vice Principal',
      MANAGER: 'Head of Department',
      EMPLOYEE: 'Teacher',
      OPERATOR: 'Support Staff'
    },
    unit: 'Department',
    division: 'Section'
  },
  HOSPITAL: {
    label: 'Hospital',
    roles: {
      SUPER_ADMIN: 'Platform Super Admin',
      ORG_ADMIN: 'Chief Medical Director',
      DEAN: 'Clinical Director',
      MANAGER: 'Head of Unit',
      EMPLOYEE: 'Staff',
      OPERATOR: 'Technician'
    },
    unit: 'Unit',
    division: 'Directorate'
  },
  GOVERNMENT: {
    label: 'Government Agency',
    roles: {
      SUPER_ADMIN: 'Platform Super Admin',
      ORG_ADMIN: 'Permanent Secretary',
      DEAN: 'Director',
      MANAGER: 'Head of Department',
      EMPLOYEE: 'Officer',
      OPERATOR: 'Clerk'
    },
    unit: 'Department',
    division: 'Directorate'
  },
  NGO: {
    label: 'Non-Profit',
    roles: {
      SUPER_ADMIN: 'Platform Super Admin',
      ORG_ADMIN: 'Executive Director',
      DEAN: 'Program Director',
      MANAGER: 'Program Manager',
      EMPLOYEE: 'Staff',
      OPERATOR: 'Volunteer Coordinator'
    },
    unit: 'Program',
    division: 'Division'
  }
};

export const inferOrgTypeFromName = (name?: string | null): OrganizationType => {
  if (!name) return 'COMPANY';
  const lower = name.toLowerCase();
  if (
    lower.includes('islamiyya') ||
    lower.includes('islamic') ||
    lower.includes('school') ||
    /\bsch\b/i.test(name) ||
    lower.includes('academy') ||
    lower.includes('primary') ||
    lower.includes('secondary') ||
    lower.includes('madrasa') ||
    lower.includes('madrasah') ||
    lower.includes('nursery') ||
    lower.includes('kindergarten') ||
    lower.includes('tahfiz') ||
    (lower.includes('college') && !lower.includes('university'))
  ) {
    return 'SCHOOL';
  }
  if (
    lower.includes('university') ||
    /\buni\b/i.test(name) ||
    lower.includes('polytechnic') ||
    lower.includes('institute') ||
    lower.includes('faculty') ||
    lower.includes('campus')
  ) {
    return 'UNIVERSITY';
  }
  if (lower.includes('hospital') || lower.includes('clinic') || lower.includes('medical') || lower.includes('health') || lower.includes('infirmary')) {
    return 'HOSPITAL';
  }
  if (lower.includes('ministry') || lower.includes('agency') || lower.includes('government') || lower.includes('parastatal') || lower.includes('department of')) {
    return 'GOVERNMENT';
  }
  if (lower.includes('foundation') || lower.includes('ngo') || lower.includes('charity') || lower.includes('initiative') || lower.includes('non-profit')) {
    return 'NGO';
  }
  return 'COMPANY';
};

export const normalizeOrgType = (value?: string | null, name?: string | null): OrganizationType => {
  if (value && (ORGANIZATION_TYPES as string[]).includes(value) && value !== 'COMPANY') {
    return value as OrganizationType;
  }
  if (name) {
    const inferred = inferOrgTypeFromName(name);
    if (inferred !== 'COMPANY') return inferred;
  }
  if (value && (ORGANIZATION_TYPES as string[]).includes(value)) {
    return value as OrganizationType;
  }
  return DEFAULT_ORGANIZATION_TYPE;
};

export const getTerminology = (
  type?: string | null,
  orgName?: string | null,
  userContext?: { role?: string; faculty?: string; email?: string } | null
): OrgTerminology => {
  let resolved: OrganizationType = 'COMPANY';
  if (type && (ORGANIZATION_TYPES as string[]).includes(type) && type !== 'COMPANY') {
    resolved = type as OrganizationType;
  } else if (orgName && inferOrgTypeFromName(orgName) !== 'COMPANY') {
    resolved = inferOrgTypeFromName(orgName);
  } else if (
    userContext?.faculty ||
    userContext?.role === 'DEAN' ||
    (userContext?.email && (
      userContext.email.endsWith('.edu') ||
      userContext.email.endsWith('.ac.ng') ||
      userContext.email.includes('university') ||
      userContext.email.includes('faculty')
    ))
  ) {
    resolved = 'UNIVERSITY';
  } else if (orgName) {
    resolved = inferOrgTypeFromName(orgName);
  } else if (type && (ORGANIZATION_TYPES as string[]).includes(type)) {
    resolved = type as OrganizationType;
  }
  return TERMINOLOGY[resolved];
};

export const roleTitle = (type: string | null | undefined, role: UserRole, orgName?: string | null): string =>
  getTerminology(type, orgName).roles[role] || role;


