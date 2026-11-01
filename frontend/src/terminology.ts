import { UserRole } from './types';

/**
 * Mirrors backend/src/config/terminology.ts.
 * Maps internal roles to the titles used by each kind of organization.
 */
export type OrganizationType = 'COMPANY' | 'UNIVERSITY' | 'SCHOOL' | 'HOSPITAL' | 'GOVERNMENT' | 'NGO';

export interface OrgTerminology {
  label: string;
  description: string;
  namePlaceholder: string;
  roles: Record<UserRole, string>;
  roleDescriptions: Partial<Record<UserRole, string>>;
  unit: string;
  units: string;
  division: string;
}

export const ORG_TYPE_OPTIONS: OrganizationType[] = ['COMPANY', 'UNIVERSITY', 'SCHOOL', 'HOSPITAL', 'GOVERNMENT', 'NGO'];

export const TERMINOLOGY: Record<OrganizationType, OrgTerminology> = {
  COMPANY: {
    label: 'Company',
    description: 'Businesses, startups and corporate teams',
    namePlaceholder: 'e.g. Apex Technologies Ltd',
    roles: {
      SUPER_ADMIN: 'Platform Super Admin',
      ORG_ADMIN: 'Chief Executive Officer',
      DEAN: 'Director',
      MANAGER: 'Department Manager',
      EMPLOYEE: 'Employee',
      OPERATOR: 'Operator'
    },
    roleDescriptions: {
      EMPLOYEE: 'Submits requests and completes assigned tasks.',
      MANAGER: 'Reviews requests for their department and assigns work.',
      DEAN: 'Reviews requests escalated from department managers.'
    },
    unit: 'Department',
    units: 'Departments',
    division: 'Division'
  },
  UNIVERSITY: {
    label: 'University',
    description: 'Universities, polytechnics and colleges',
    namePlaceholder: 'e.g. University of Lagos',
    roles: {
      SUPER_ADMIN: 'Platform Super Admin',
      ORG_ADMIN: 'Vice-Chancellor',
      DEAN: 'Dean',
      MANAGER: 'Head of Department',
      EMPLOYEE: 'Staff',
      OPERATOR: 'Officer'
    },
    roleDescriptions: {
      EMPLOYEE: 'Submits requests and completes assigned tasks.',
      MANAGER: 'Reviews requests for their department and assigns work.',
      DEAN: 'Reviews requests escalated from heads of department.'
    },
    unit: 'Department',
    units: 'Departments',
    division: 'Faculty'
  },
  SCHOOL: {
    label: 'School',
    description: 'Primary and secondary schools',
    namePlaceholder: 'e.g. Greenfield Academy',
    roles: {
      SUPER_ADMIN: 'Platform Super Admin',
      ORG_ADMIN: 'Principal',
      DEAN: 'Vice Principal',
      MANAGER: 'Head of Department',
      EMPLOYEE: 'Teacher',
      OPERATOR: 'Support Staff'
    },
    roleDescriptions: {
      EMPLOYEE: 'Submits requests and completes assigned tasks.',
      MANAGER: 'Reviews requests for their department and assigns work.',
      DEAN: 'Reviews requests escalated from heads of department.'
    },
    unit: 'Department',
    units: 'Departments',
    division: 'Section'
  },
  HOSPITAL: {
    label: 'Hospital',
    description: 'Hospitals, clinics and health centres',
    namePlaceholder: 'e.g. St. Mary General Hospital',
    roles: {
      SUPER_ADMIN: 'Platform Super Admin',
      ORG_ADMIN: 'Chief Medical Director',
      DEAN: 'Clinical Director',
      MANAGER: 'Head of Unit',
      EMPLOYEE: 'Staff',
      OPERATOR: 'Technician'
    },
    roleDescriptions: {
      EMPLOYEE: 'Submits requests and completes assigned tasks.',
      MANAGER: 'Reviews requests for their unit and assigns work.',
      DEAN: 'Reviews requests escalated from heads of unit.'
    },
    unit: 'Unit',
    units: 'Units',
    division: 'Directorate'
  },
  GOVERNMENT: {
    label: 'Government Agency',
    description: 'Ministries, agencies and public bodies',
    namePlaceholder: 'e.g. Ministry of Education',
    roles: {
      SUPER_ADMIN: 'Platform Super Admin',
      ORG_ADMIN: 'Permanent Secretary',
      DEAN: 'Director',
      MANAGER: 'Head of Department',
      EMPLOYEE: 'Officer',
      OPERATOR: 'Clerk'
    },
    roleDescriptions: {
      EMPLOYEE: 'Submits requests and completes assigned tasks.',
      MANAGER: 'Reviews requests for their department and assigns work.',
      DEAN: 'Reviews requests escalated from heads of department.'
    },
    unit: 'Department',
    units: 'Departments',
    division: 'Directorate'
  },
  NGO: {
    label: 'Non-Profit',
    description: 'NGOs, foundations and charities',
    namePlaceholder: 'e.g. Hope Foundation',
    roles: {
      SUPER_ADMIN: 'Executive Director',
      ORG_ADMIN: 'Executive Director',
      DEAN: 'Program Director',
      MANAGER: 'Program Manager',
      EMPLOYEE: 'Staff',
      OPERATOR: 'Volunteer Coordinator'
    },
    roleDescriptions: {
      EMPLOYEE: 'Submits requests and completes assigned tasks.',
      MANAGER: 'Reviews requests for their program and assigns work.',
      DEAN: 'Reviews requests escalated from program managers.'
    },
    unit: 'Program',
    units: 'Programs',
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

export const getTerminology = (
  type?: string | null,
  orgName?: string | null,
  userContext?: { role?: string; faculty?: string; email?: string } | null
): OrgTerminology => {
  let resolved: OrganizationType = 'COMPANY';
  if (type && type in TERMINOLOGY && type !== 'COMPANY') {
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
  } else if (type && type in TERMINOLOGY) {
    resolved = type as OrganizationType;
  }
  return TERMINOLOGY[resolved];
};

export const roleTitle = (
  type: string | null | undefined,
  role: UserRole,
  orgName?: string | null,
  userContext?: { role?: string; faculty?: string; email?: string } | null
): string =>
  getTerminology(type, orgName, userContext).roles[role] || role;

/**
 * Safely strips any __WP_META__ or JSON metadata wrappers from department/request descriptions,
 * ensuring clean, human-readable text is always presented in the UI.
 */
export const cleanDeptDescription = (desc?: string | null): string => {
  if (!desc) return '';
  let cur = String(desc).trim();
  for (let i = 0; i < 5; i++) {
    if (cur.startsWith('__WP_META__:') || (cur.startsWith('{') && cur.includes('"text"'))) {
      try {
        const raw = cur.startsWith('__WP_META__:') ? cur.substring('__WP_META__:'.length) : cur;
        const parsed = JSON.parse(raw);
        if (parsed.text !== undefined) {
          cur = String(parsed.text).trim();
        } else {
          break;
        }
      } catch {
        const textMatch = cur.match(/"text"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
        if (textMatch) {
          cur = textMatch[1].replace(/\\"/g, '"').trim();
        }
        break;
      }
    } else {
      break;
    }
  }
  if (cur.startsWith('__WP_META__:')) {
    cur = cur.substring('__WP_META__:'.length).trim();
  }
  return cur;
};


