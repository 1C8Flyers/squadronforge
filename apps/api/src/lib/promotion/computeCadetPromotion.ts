export type Status = '' | 'X' | '★' | 'N/A' | 'WC';

export interface ComputeInputs {
  ptDate: Date | null;
  leadershipTestDate: Date | null;
  leadershipModuleDate: Date | null;
  aeTestDate: Date | null;
  aeModuleDate: Date | null;
  drillDate: Date | null;
  moralForumDate: Date | null;
  welcomeCourseDate: Date | null;
  staffServiceDate: Date | null;
  oralPresentationDate: Date | null;
  requiresCD: boolean;
  requiresSDA: boolean;
  isFirstAchievement: boolean;
  today: Date;
  leadershipTestNotRequired?: boolean;
  leadershipModuleNotRequired?: boolean;
  aeTestNotRequired?: boolean;
  aeModuleNotRequired?: boolean;
  drillNotRequired?: boolean;
}

export interface ComputeOutputs {
  ptStatus: Status;
  leadStatus: Status;
  aeStatus: Status;
  drillStatus: Status;
  cdStatus: Status;
  sdaStatus: Status;
  ready: boolean;
  missingKeys: string[];
  needs: string[];
  explain: string[];
}

const utcDay = (date: Date): Date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const plusDaysUtc = (date: Date, days: number): Date => {
  const d = utcDay(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

const hasDate = (value: Date | null): value is Date => value instanceof Date;

export const computeCadetPromotion = (input: ComputeInputs): ComputeOutputs => {
  const explain: string[] = [];
  const todayDay = utcDay(input.today);
  const ptExpiry = hasDate(input.ptDate) ? plusDaysUtc(input.ptDate, 182) : null;

  const ptStatus: Status = !ptExpiry ? '' : ptExpiry > todayDay ? 'X' : '';
  explain.push(
    `PT: ${!ptExpiry ? 'missing' : ptExpiry > todayDay ? 'valid within 182 days (X)' : 'expired (blank)'}`
  );

  const leadTestNA = input.leadershipTestNotRequired === true;
  const leadModuleNA = input.leadershipModuleNotRequired === true;
  const leadHasTest = hasDate(input.leadershipTestDate);
  const leadHasModule = hasDate(input.leadershipModuleDate);

  const leadStatus: Status = leadTestNA && leadModuleNA
    ? 'N/A'
    : leadHasTest && leadHasModule
      ? '★'
      : leadHasTest || leadHasModule
        ? 'X'
        : '';
  explain.push(`Lead: ${leadStatus || 'blank'}`);

  const aeTestNA = input.aeTestNotRequired === true;
  const aeModuleNA = input.aeModuleNotRequired === true;
  const aeHasTest = hasDate(input.aeTestDate);
  const aeHasModule = hasDate(input.aeModuleDate);

  const aeStatus: Status = aeTestNA && aeModuleNA
    ? 'N/A'
    : aeHasTest && aeHasModule
      ? '★'
      : aeHasTest || aeHasModule
        ? 'X'
        : '';
  explain.push(`AE: ${aeStatus || 'blank'}`);

  const drillStatus: Status = input.drillNotRequired === true
    ? 'N/A'
    : hasDate(input.drillDate)
      ? 'X'
      : '';
  explain.push(`Drill: ${drillStatus || 'blank'}`);

  const cdStatus: Status = input.isFirstAchievement && !hasDate(input.welcomeCourseDate)
    ? 'WC'
    : !input.requiresCD
      ? 'N/A'
      : hasDate(input.moralForumDate)
        ? 'X'
        : '';
  explain.push(`CD: ${cdStatus || 'blank'}`);

  const sdaStatus: Status = !input.requiresSDA
    ? 'N/A'
    : hasDate(input.staffServiceDate) || hasDate(input.oralPresentationDate)
      ? 'X'
      : '';
  explain.push(`SDA: ${sdaStatus || 'blank'}`);

  const requiredStatuses: Array<{ key: string; value: Status }> = [
    { key: 'PT', value: ptStatus },
    { key: 'Leadership', value: leadStatus },
    { key: 'AE', value: aeStatus },
    { key: 'Drill', value: drillStatus },
    { key: 'CD', value: cdStatus }
  ];

  if (input.requiresSDA) {
    requiredStatuses.push({ key: 'SDA', value: sdaStatus });
  }

  const missingKeys = requiredStatuses.filter((item) => item.value === '').map((item) => item.key);

  const needs: string[] = [];
  if (ptStatus === '') needs.push('CPFT within last 182 days');

  if (leadStatus === '') {
    needs.push('Leadership: test and interactive module');
  } else if (leadStatus === 'X') {
    if (!leadHasTest && !leadTestNA) needs.push('Leadership: complete leadership test');
    if (!leadHasModule && !leadModuleNA) needs.push('Leadership: complete interactive module');
  }

  if (aeStatus === '') {
    needs.push('Aerospace: test and interactive module');
  } else if (aeStatus === 'X') {
    if (!aeHasTest && !aeTestNA) needs.push('Aerospace: complete AE test');
    if (!aeHasModule && !aeModuleNA) needs.push('Aerospace: complete interactive module');
  }

  if (drillStatus === '') needs.push('Drill test');

  if (cdStatus === 'WC') {
    needs.push('Welcome Course');
  } else if (cdStatus === '') {
    needs.push('Character Development forum');
  }

  if (input.requiresSDA && sdaStatus === '') {
    needs.push('Staff Duty Analysis (SDA)');
  }

  const ready = cdStatus !== 'WC' && !requiredStatuses.some((item) => item.value === '');
  explain.push(`Ready: ${ready ? 'true' : 'false'}${cdStatus === 'WC' ? ' (blocked by WC)' : ''}`);

  return {
    ptStatus,
    leadStatus,
    aeStatus,
    drillStatus,
    cdStatus,
    sdaStatus,
    ready,
    missingKeys,
    needs,
    explain
  };
};
