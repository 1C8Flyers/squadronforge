import { describe, expect, it } from 'vitest';
import { computeCadetPromotion } from './computeCadetPromotion.js';

const today = new Date('2026-02-18T00:00:00.000Z');
const daysAgo = (days: number) => new Date(today.getTime() - days * 24 * 60 * 60 * 1000);

const baseInput = () => ({
  ptDate: null,
  leadershipTestDate: null,
  leadershipModuleDate: null,
  aeTestDate: null,
  aeModuleDate: null,
  drillDate: null,
  moralForumDate: null,
  welcomeCourseDate: null,
  staffServiceDate: null,
  oralPresentationDate: null,
  requiresCD: true,
  requiresSDA: true,
  isFirstAchievement: false,
  today
});

describe('computeCadetPromotion', () => {
  it('PT within 182 days is X, boundary at 182 days is blank', () => {
    const within = computeCadetPromotion({ ...baseInput(), ptDate: daysAgo(10) });
    expect(within.ptStatus).toBe('X');

    const boundary = computeCadetPromotion({ ...baseInput(), ptDate: daysAgo(182) });
    expect(boundary.ptStatus).toBe('');
  });

  it('Lead and AE status transitions none -> X -> ★', () => {
    const none = computeCadetPromotion({ ...baseInput() });
    expect(none.leadStatus).toBe('');
    expect(none.aeStatus).toBe('');

    const one = computeCadetPromotion({
      ...baseInput(),
      leadershipTestDate: daysAgo(1),
      aeModuleDate: daysAgo(1)
    });
    expect(one.leadStatus).toBe('X');
    expect(one.aeStatus).toBe('X');

    const both = computeCadetPromotion({
      ...baseInput(),
      leadershipTestDate: daysAgo(1),
      leadershipModuleDate: daysAgo(1),
      aeTestDate: daysAgo(1),
      aeModuleDate: daysAgo(1)
    });
    expect(both.leadStatus).toBe('★');
    expect(both.aeStatus).toBe('★');
  });

  it('Partial lead/AE completion does not add opposite sub-item blockers', () => {
    const partial = computeCadetPromotion({
      ...baseInput(),
      leadershipModuleDate: daysAgo(1),
      aeModuleDate: daysAgo(1)
    });

    expect(partial.leadStatus).toBe('X');
    expect(partial.aeStatus).toBe('X');
    expect(partial.needs).not.toContain('Leadership: complete leadership test');
    expect(partial.needs).not.toContain('Aerospace: complete AE test');
  });

  it('Drill required missing is blank; not required is N/A', () => {
    const requiredMissing = computeCadetPromotion({ ...baseInput(), drillNotRequired: false });
    expect(requiredMissing.drillStatus).toBe('');

    const notRequired = computeCadetPromotion({ ...baseInput(), drillNotRequired: true });
    expect(notRequired.drillStatus).toBe('N/A');
  });

  it('CD WC override always blocks readiness; requiresCD false yields N/A', () => {
    const wc = computeCadetPromotion({
      ...baseInput(),
      isFirstAchievement: true,
      welcomeCourseDate: null,
      ptDate: daysAgo(1),
      leadershipTestDate: daysAgo(1),
      leadershipModuleDate: daysAgo(1),
      aeTestDate: daysAgo(1),
      aeModuleDate: daysAgo(1),
      drillDate: daysAgo(1),
      moralForumDate: daysAgo(1),
      requiresSDA: false
    });
    expect(wc.cdStatus).toBe('WC');
    expect(wc.ready).toBe(false);

    const notRequired = computeCadetPromotion({ ...baseInput(), requiresCD: false });
    expect(notRequired.cdStatus).toBe('N/A');
  });

  it('SDA requires flag controls status', () => {
    const notRequired = computeCadetPromotion({ ...baseInput(), requiresSDA: false });
    expect(notRequired.sdaStatus).toBe('N/A');

    const requiredMissing = computeCadetPromotion({ ...baseInput(), requiresSDA: true });
    expect(requiredMissing.sdaStatus).toBe('');
  });

  it('Ready includes SDA only when requiresSDA is true', () => {
    const common = {
      ...baseInput(),
      ptDate: daysAgo(1),
      leadershipTestDate: daysAgo(1),
      leadershipModuleDate: daysAgo(1),
      aeTestDate: daysAgo(1),
      aeModuleDate: daysAgo(1),
      drillDate: daysAgo(1),
      moralForumDate: daysAgo(1)
    };

    const sdaNotRequired = computeCadetPromotion({ ...common, requiresSDA: false, staffServiceDate: null, oralPresentationDate: null });
    expect(sdaNotRequired.ready).toBe(true);

    const sdaRequiredBlank = computeCadetPromotion({ ...common, requiresSDA: true, staffServiceDate: null, oralPresentationDate: null });
    expect(sdaRequiredBlank.ready).toBe(false);

    const sdaRequiredComplete = computeCadetPromotion({ ...common, requiresSDA: true, staffServiceDate: daysAgo(1), oralPresentationDate: null });
    expect(sdaRequiredComplete.ready).toBe(true);
  });
});
