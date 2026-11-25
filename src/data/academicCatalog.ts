import type { StudentProfile } from '../types/academic';

export interface BranchOption {
  value: string;
  shortLabel: string;
  category: string;
  codePrefix: string;
}

export const BRANCH_OPTIONS: BranchOption[] = [
  {
    value: 'B.Tech Computer Engineering',
    shortLabel: 'B.Tech CE',
    category: 'Engineering',
    codePrefix: 'CE',
  },
  {
    value: 'B.Tech Computer Science & Engineering',
    shortLabel: 'B.Tech CSE',
    category: 'Engineering',
    codePrefix: 'CS',
  },
  {
    value: 'B.Tech Information Technology',
    shortLabel: 'B.Tech IT',
    category: 'Engineering',
    codePrefix: 'IT',
  },
  {
    value: 'B.Tech Mechanical Engineering',
    shortLabel: 'B.Tech ME',
    category: 'Engineering',
    codePrefix: 'ME',
  },
  {
    value: 'B.Tech Civil Engineering',
    shortLabel: 'B.Tech Civil',
    category: 'Engineering',
    codePrefix: 'CV',
  },
  {
    value: 'B.Tech Electronics & Communication Engineering (ECE) — Section A',
    shortLabel: 'B.Tech ECE (Sec A)',
    category: 'Engineering',
    codePrefix: 'ECE',
  },
  {
    value: 'B.Tech Electronics & Communication',
    shortLabel: 'B.Tech ECE',
    category: 'Engineering',
    codePrefix: 'EC',
  },
  {
    value: 'B.Sc (Bachelor of Science)',
    shortLabel: 'B.Sc',
    category: 'Science',
    codePrefix: 'SC',
  },
  {
    value: 'BBA (Business Administration)',
    shortLabel: 'BBA',
    category: 'Management',
    codePrefix: 'BB',
  },
  {
    value: 'B.Com (Commerce & Finance)',
    shortLabel: 'B.Com',
    category: 'Commerce',
    codePrefix: 'CM',
  },
  {
    value: 'MBA (Master of Business Administration)',
    shortLabel: 'MBA',
    category: 'Postgraduate',
    codePrefix: 'MB',
  },
];

export interface OnboardingSampleSubject {
  code: string;
  name: string;
  credits: number;
  weeklyHours: number;
  attendedClasses: number;
  totalClasses: number;
}

export function extractSemesterNumber(semesterText?: string, explicitNum?: number): number {
  if (typeof explicitNum === 'number' && Number.isFinite(explicitNum) && explicitNum >= 1 && explicitNum <= 12) {
    return Math.round(explicitNum);
  }
  const text = (semesterText ?? '').trim();
  const digitMatch = text.match(/\b(\d{1,2})\b/);
  if (digitMatch) {
    const parsed = Number(digitMatch[1]);
    if (parsed >= 1 && parsed <= 12) return parsed;
  }
  const romanMap: Record<string, number> = {
    VIII: 8,
    VII: 7,
    VI: 6,
    IV: 4,
    V: 5,
    III: 3,
    II: 2,
    I: 1,
  };
  for (const [roman, num] of Object.entries(romanMap)) {
    if (new RegExp(`\\b${roman}\\b`, 'i').test(text)) {
      return num;
    }
  }
  return 5;
}

export function getShortBranchLabel(branchOrProgram?: string): string {
  const raw = (branchOrProgram ?? '').trim();
  if (!raw) return 'B.Tech CE';
  const exact = BRANCH_OPTIONS.find((b) => b.value.toLowerCase() === raw.toLowerCase());
  if (exact) return exact.shortLabel;

  const lower = raw.toLowerCase();
  if (lower.includes('computer engineering')) return 'B.Tech CE';
  if (lower.includes('computer science')) return 'B.Tech CSE';
  if (lower.includes('information technology')) return 'B.Tech IT';
  if (lower.includes('mechanical')) return 'B.Tech ME';
  if (lower.includes('civil')) return 'B.Tech Civil';
  if (lower.includes('electronic') || lower.includes('ece')) {
    return lower.includes('section a') ? 'B.Tech ECE (Sec A)' : 'B.Tech ECE';
  }
  if (lower.startsWith('b.sc') || lower.includes('bachelor of science')) return 'B.Sc';
  if (lower.startsWith('bba') || lower.includes('business administration')) return 'BBA';
  if (lower.startsWith('b.com') || lower.includes('commerce')) return 'B.Com';
  if (lower.startsWith('mba')) return 'MBA';

  return raw.length > 22 ? `${raw.slice(0, 20).trim()}…` : raw;
}

export function formatBranchSemesterBadge(student: Pick<StudentProfile, 'branch' | 'program' | 'semester' | 'semesterNumber'>): string {
  const shortBranch = getShortBranchLabel(student.branch || student.program);
  const semNum = extractSemesterNumber(student.semester, student.semesterNumber);
  return `${shortBranch} • Semester ${semNum}`;
}

export function getSampleSubjectsForBranchAndSem(
  branch: string,
  semNumber: number,
): OnboardingSampleSubject[] {
  const sem = Math.min(8, Math.max(1, Math.round(semNumber || 1)));
  const lower = branch.toLowerCase();

  const make = (prefix: string, titles: string[]): OnboardingSampleSubject[] =>
    titles.map((name, idx) => ({
      code: `${prefix}${sem}0${idx + 1}`,
      name,
      credits: idx < 3 ? 4 : 3,
      weeklyHours: idx < 3 ? 4 : 3,
      attendedClasses: 0,
      totalClasses: 0,
    }));

  if (lower.includes('mechanical') || lower === 'me') {
    if (sem <= 2) {
      return make('ME', [
        'Engineering Mathematics',
        'Engineering Mechanics',
        'Engineering Thermodynamics',
        'Workshop & Manufacturing Practice',
        'Engineering Drawing & CAD',
      ]);
    }
    if (sem <= 4) {
      return make('ME', [
        'Strength of Materials',
        'Fluid Mechanics',
        'Kinematics of Machinery',
        'Material Science & Metallurgy',
        'Manufacturing Technology',
      ]);
    }
    return make('ME', [
      'Heat & Mass Transfer',
      'Design of Machine Elements',
      'Dynamics of Machinery',
      'Internal Combustion Engines',
      'Industrial Automation & Robotics',
    ]);
  }

  if (lower.includes('civil')) {
    if (sem <= 2) {
      return make('CV', [
        'Engineering Mathematics',
        'Engineering Mechanics',
        'Building Materials & Construction',
        'Environmental Engineering Basics',
        'Engineering Graphics',
      ]);
    }
    if (sem <= 4) {
      return make('CV', [
        'Surveying & Geomatics',
        'Mechanics of Solids',
        'Fluid Mechanics & Hydraulics',
        'Concrete Technology',
        'Engineering Geology',
      ]);
    }
    return make('CV', [
      'Structural Analysis',
      'Geotechnical Engineering',
      'Design of Reinforced Concrete',
      'Transportation Engineering',
      'Water Resources Engineering',
    ]);
  }

  if (lower.includes('electronic') || lower.includes('ece')) {
    if (sem === 1) {
      return [
        { code: 'DTI-101', name: 'Design Thinking and Innovation', credits: 3, weeklyHours: 3, attendedClasses: 0, totalClasses: 0 },
        { code: 'BEEE-102', name: 'Basic of Electrical and Electronics Engineering', credits: 4, weeklyHours: 4, attendedClasses: 0, totalClasses: 0 },
        { code: 'MATH-101', name: 'Engineering Mathematics-1', credits: 4, weeklyHours: 4, attendedClasses: 0, totalClasses: 0 },
        { code: 'PPS-103', name: 'Programming for Problem Solving', credits: 4, weeklyHours: 3, attendedClasses: 0, totalClasses: 0 },
        { code: 'EDWP-104', name: 'Engineering Design and Workshop Practice', credits: 3, weeklyHours: 4, attendedClasses: 0, totalClasses: 0 },
        { code: 'FAI-105', name: 'Fundamentals of AI', credits: 3, weeklyHours: 4, attendedClasses: 0, totalClasses: 0 },
        { code: 'PDC-106', name: 'Personality Development and Communication', credits: 2, weeklyHours: 2, attendedClasses: 0, totalClasses: 0 },
      ];
    }
    if (sem === 2) {
      return make('EC', [
        'Linear Algebra & Calculus',
        'Basic Electrical Circuits',
        'Semiconductor Physics',
        'Programming Fundamentals',
        'Digital Logic Design',
      ]);
    }
    if (sem <= 4) {
      return make('EC', [
        'Signals & Systems',
        'Analog Electronic Circuits',
        'Electromagnetic Fields',
        'Microprocessors & Microcontrollers',
        'Network Analysis & Synthesis',
      ]);
    }
    return make('EC', [
      'Digital Signal Processing',
      'Communication Systems',
      'VLSI Design',
      'Embedded Systems Architecture',
      'Control Systems Engineering',
    ]);
  }

  if (lower.includes('bba') || lower.includes('mba') || lower.includes('business')) {
    const prefix = lower.includes('mba') ? 'MB' : 'BB';
    if (sem <= 2) {
      return make(prefix, [
        'Principles of Management',
        'Financial Accounting',
        'Microeconomics for Business',
        'Business Statistics',
        'Organizational Behavior',
      ]);
    }
    return make(prefix, [
      'Corporate Finance',
      'Marketing Management',
      'Operations & Supply Chain',
      'Human Resource Strategy',
      'Business Analytics & Decision Making',
    ]);
  }

  if (lower.includes('b.com') || lower.includes('commerce')) {
    return make('CM', [
      'Corporate Accounting',
      'Direct & Indirect Taxation',
      'Auditing & Assurance',
      'Financial Markets & Banking',
      'Business & Company Law',
    ]);
  }

  if (lower.includes('b.sc')) {
    return make('SC', [
      'Applied Mathematics & Calculus',
      'Data Structures & Algorithms',
      'Quantum & Modern Physics',
      'Statistical Inference',
      'Scientific Computing Lab',
    ]);
  }

  // Default: Computer Engineering / CSE / IT
  const prefix = lower.includes('information technology')
    ? 'IT'
    : lower.includes('computer science')
      ? 'CS'
      : 'CE';

  if (sem <= 2) {
    return make(prefix, [
      'Calculus & Linear Algebra',
      'Programming in C & Problem Solving',
      'Digital Logic & Computer Organization',
      'Discrete Mathematics',
      'Data Structures',
    ]);
  }
  if (sem <= 4) {
    return make(prefix, [
      'Design & Analysis of Algorithms',
      'Object-Oriented Programming',
      'Computer Architecture',
      'Probability & Statistics',
      'Web Application Engineering',
    ]);
  }
  return make(prefix, [
    'Operating Systems',
    'Database Management Systems',
    'Computer Networks',
    'Software Engineering',
    'Theory of Computation',
  ]);
}
