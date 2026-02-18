const normalize = (value) => value
    .trim()
    .toUpperCase()
    .replaceAll('.', '')
    .replace(/\s+/g, ' ');
const cadetRankName = (code) => {
    switch (code) {
        case 'AB':
            return 'Cadet Airman Basic';
        case 'AMN':
            return 'Cadet Airman';
        case 'A1C':
            return 'Cadet Airman First Class';
        case 'SRA':
            return 'Cadet Senior Airman';
        case 'SSGT':
            return 'Cadet Staff Sergeant';
        case 'TSGT':
            return 'Cadet Technical Sergeant';
        case 'MSGT':
            return 'Cadet Master Sergeant';
        case 'SMSGT':
            return 'Cadet Senior Master Sergeant';
        case 'CMSGT':
            return 'Cadet Chief Master Sergeant';
        case '2DLT':
        case '2LT':
            return 'Cadet Second Lieutenant';
        case '1STLT':
        case '1LT':
            return 'Cadet First Lieutenant';
        case 'CAPT':
            return 'Cadet Captain';
        case 'MAJ':
            return 'Cadet Major';
        case 'LTCOL':
            return 'Cadet Lieutenant Colonel';
        case 'COL':
            return 'Cadet Colonel';
        default:
            return null;
    }
};
const seniorRankName = (code) => {
    switch (code) {
        case 'SM':
            return 'Senior Member';
        case 'FO':
            return 'Flight Officer';
        case 'TFO':
            return 'Technical Flight Officer';
        case 'SFO':
            return 'Senior Flight Officer';
        case '2DLT':
        case '2LT':
            return 'Second Lieutenant';
        case '1STLT':
        case '1LT':
            return 'First Lieutenant';
        case 'CAPT':
            return 'Captain';
        case 'MAJ':
            return 'Major';
        case 'LTCOL':
            return 'Lieutenant Colonel';
        case 'COL':
            return 'Colonel';
        case 'BG':
            return 'Brigadier General';
        case 'MG':
            return 'Major General';
        case 'LTGEN':
            return 'Lieutenant General';
        case 'GEN':
            return 'General';
        default:
            return null;
    }
};
export const formatRankDisplay = (value) => {
    const raw = (value ?? '').trim();
    if (!raw)
        return '—';
    const normalized = normalize(raw);
    const compact = normalized.replace(/\s+/g, '');
    if (compact.startsWith('C/')) {
        const code = compact.slice(2);
        const name = cadetRankName(code);
        return name ? `${raw} (${name})` : raw;
    }
    const name = seniorRankName(compact);
    return name ? `${raw} (${name})` : raw;
};
