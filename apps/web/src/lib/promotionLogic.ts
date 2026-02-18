export type Status = '★' | 'X' | 'N/A' | 'WC' | '' | null | undefined;

export interface CadetPromotionItem {
  id: string;
  capid: string;
  memberName: string | null;
  rank: string | null;
  achievementName: string | null;
  datePromotionEligible: string | null;
  lastPtDate: string | null;
  inactive: boolean;
  ready: boolean;
  readyStatus: string | null;
  leadershipTestCompleted: boolean;
  leadershipModuleCompleted: boolean;
  aeTestCompleted: boolean | null;
  aeModuleCompleted: boolean | null;
  chiefSpeechEssayCompleted: boolean;
  sdaCompleted: boolean;
  ptStatus: Status;
  leadStatus: Status;
  aeStatus: Status;
  drillStatus: Status;
  cdStatus: Status;
  sdaStatus: Status;
  comments: string | null;
}

export interface ComputedPromotion {
  readyComputed: boolean;
  requiresSDA: boolean;
  missingKeys: string[];
  missingDetails: string[];
}

const normalize = (value: Status): string => (value ?? '').toString().trim();

export function computePromotion(item: CadetPromotionItem): ComputedPromotion {
  const pt = normalize(item.ptStatus);
  const lead = normalize(item.leadStatus);
  const ae = normalize(item.aeStatus);
  const drill = normalize(item.drillStatus);
  const cd = normalize(item.cdStatus);
  const sda = normalize(item.sdaStatus);

  const requiresSDA = sda !== 'N/A';

  const requiredStatuses: Array<{ key: string; value: string }> = [
    { key: 'PT', value: pt },
    { key: 'Leadership', value: lead },
    { key: 'AE', value: ae },
    { key: 'Drill', value: drill },
    { key: 'CD', value: cd }
  ];

  if (requiresSDA) {
    requiredStatuses.push({ key: 'SDA', value: sda });
  }

  const missingKeys = requiredStatuses.filter((s) => s.value === '').map((s) => s.key);
  const hasWelcomeCourseBlock = cd.toUpperCase() === 'WC';
  const readyComputed = !hasWelcomeCourseBlock && missingKeys.length === 0;

  const missingDetails: string[] = [];

  if (pt === '') {
    missingDetails.push('CPFT within last 182 days');
  }

  if (lead === '') {
    missingDetails.push('Leadership: test and interactive module');
  } else if (lead === 'X') {
    if (!item.leadershipTestCompleted) {
      missingDetails.push('Leadership: complete the leadership test');
    }
    if (!item.leadershipModuleCompleted) {
      missingDetails.push('Leadership: complete the interactive module');
    }
  }

  if (ae === '') {
    missingDetails.push('Aerospace: test and interactive module');
  } else if (ae === 'X') {
    if (item.aeTestCompleted !== true) {
      missingDetails.push('Aerospace: complete the AE test');
    }
    if (item.aeModuleCompleted !== true) {
      missingDetails.push('Aerospace: complete the interactive module');
    }
  }

  if (drill === '') {
    missingDetails.push('Drill test');
  }

  if (cd.toUpperCase() === 'WC') {
    missingDetails.push('Welcome Course');
  } else if (cd === '') {
    missingDetails.push('Character Development forum');
  }

  if (requiresSDA && sda === '') {
    missingDetails.push('Staff Duty Analysis (SDA)');
  }

  return {
    readyComputed,
    requiresSDA,
    missingKeys,
    missingDetails
  };
}
