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
export declare function computePromotion(item: CadetPromotionItem): ComputedPromotion;
