const normalize = (value) => (value ?? '').toString().trim();
export function computePromotion(item) {
    const pt = normalize(item.ptStatus);
    const lead = normalize(item.leadStatus);
    const ae = normalize(item.aeStatus);
    const drill = normalize(item.drillStatus);
    const cd = normalize(item.cdStatus);
    const sda = normalize(item.sdaStatus);
    const requiresSDA = sda !== 'N/A';
    const requiredStatuses = [
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
    const missingDetails = [];
    if (pt === '') {
        missingDetails.push('CPFT within last 182 days');
    }
    if (lead === '') {
        missingDetails.push('Leadership: test and interactive module');
    }
    else if (lead === 'X') {
        if (!item.leadershipTestCompleted) {
            missingDetails.push('Leadership: complete the leadership test');
        }
        if (!item.leadershipModuleCompleted) {
            missingDetails.push('Leadership: complete the interactive module');
        }
    }
    if (ae === '') {
        missingDetails.push('Aerospace: test and interactive module');
    }
    else if (ae === 'X') {
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
    }
    else if (cd === '') {
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
