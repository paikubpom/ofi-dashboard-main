// src/services/dataService.js
export class OFIDataService {
    constructor(rawData) {
        this.db = rawData;
        this.ofis = this.db.ofiImprovements || [];
        this.departments = this.db.reference?.departments || [];
    }

    getExecutiveMetrics(phaseId) {
        let stats = { 'Not started': 0, 'In progress': 0, 'Done': 0, 'Qualified': 0, 'Delayed': 0 };
        this.ofis.forEach(o => {
            const status = o.phases[phaseId]?.status || 'Not started';
            if (stats[status] !== undefined) stats[status]++;
        });
        const completed = stats['Done'] + stats['Qualified'];
        
        const deptLabels = []; const completedData = []; const pendingData = [];
        this.departments.forEach(dept => {
            deptLabels.push(dept.shortNameThai);
            let done = 0, pending = 0;
            this.ofis.filter(o => o.departmentIds.includes(dept.id)).forEach(o => {
                const st = o.phases[phaseId]?.status;
                if (st === 'Done' || st === 'Qualified') done++; else pending++;
            });
            completedData.push(done); pendingData.push(pending);
        });

        return { 
            total: this.ofis.length, stats, 
            rate: this.ofis.length ? Math.round((completed / this.ofis.length) * 100) : 0,
            deptChart: { labels: deptLabels, completed: completedData, pending: pendingData }
        };
    }

    getOwnerMetrics() {
        let metrics = { total: this.ofis.length, l4l5: 0, withEvidence: 0, pending: 0 };
        this.ofis.forEach(o => {
            if (['L4', 'L5'].includes(o.ofiLevel)) metrics.l4l5++;
            if (o.improvementPlanLinks.length > 0) metrics.withEvidence++;
            if (o.overallStatus === 'In progress' || o.overallStatus === 'Not started') metrics.pending++;
        });

        const recentTasks = this.ofis.map(o => ({
            code: `${o.enablerCode}-${o.topicId.split('-')[1]}`,
            text: o.ofiText,
            level: o.ofiLevel,
            status: o.overallStatus
        }));
        return { metrics, recentTasks };
    }

    getAuditorMetrics() {
        let totalL5 = 0; let totalL4 = 0;
        let tagsCount = {}; let docCategories = {};
        this.ofis.forEach(o => {
            if (o.ofiLevel === 'L5') totalL5++;
            if (o.ofiLevel === 'L4') totalL4++;
            o.issueTags.forEach(tag => tagsCount[tag] = (tagsCount[tag] || 0) + 1);
            o.improvementPlanLinks.forEach(doc => {
                const cat = doc.documentCategory;
                docCategories[cat] = (docCategories[cat] || 0) + 1;
            });
        });
        return { totalL5, totalL4, tagsCount, docCategories };
    }
}