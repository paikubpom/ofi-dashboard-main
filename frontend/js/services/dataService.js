export class OFIDataService {
    constructor(data) {
        this.db = data || {};
        this.ofis = data?.ofiImprovements || [];
        this.owners = data?.reference?.elementOwners || [];
        this.scores = data?.topicScoreMaster?.enablers || [];
        this.phasesInfo = data?.reference?.phases || [];
    }

    getKPIs() {
        const total = this.ofis.length;
        const completed = this.ofis.filter(o => ['Done', 'Qualified'].includes(o?.overallStatus)).length;
        const delayed = this.ofis.filter(o => o?.overallStatus === 'Delayed').length;
        return { total, successRate: total ? Math.round((completed / total) * 100) : 0, delayed };
    }

    detectRedFlags(apiBaseUrl) {
        let flags = [];
        
        // 5.1 คะแนนดิ่งเหว (Severe Drop > 1.0)
        let dropAlerts = [];
        this.scores.forEach(enabler => {
            enabler.topics?.forEach(topic => {
                const score67 = topic.scoreByYear?.['2567'];
                const score68 = topic.scoreByYear?.['2568'];
                if (score67 && score68 && (score67 - score68 > 1.0)) {
                    dropAlerts.push(`${topic.topicName} (ปี67: ${score67} 📉 ปี68: ${score68})`);
                }
            });
        });
        if (dropAlerts.length > 0) {
            flags.push({ type: 'score-drop', title: 'ตรวจพบหัวข้อคะแนนที่ต้องระวัง (Severe Drop)', detail: dropAlerts.join('<br>') });
        }

        // 5.2 งานไร้เจ้าภาพ (Orphaned Task) พ่วงลิงก์ทะลุมิติดาวน์โหลดไฟล์ย้อนกลับ
        const orphans = this.ofis.filter(o => !o.elementOwnerId || (o.departmentIds && o.departmentIds.length === 0));
        if (orphans.length > 0) {
            const detailHtml = orphans.map(o => {
                const fileName = o._source_file || 'data.json'; 
                return `
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-white/5 rounded-xl border border-white/10 mt-1.5">
                        <div>
                            <span class="font-mono bg-rose-700 px-1.5 py-0.5 rounded text-[10px] mr-2 font-bold">ID: ${o.id || 'ไม่ระบุ'}</span>
                            <span class="text-xs">หมวด: ${o.enablerCode || 'ไม่ระบุ'} - ${o.topicName || ''}</span>
                        </div>
                        <a href="${apiBaseUrl}/static-data/${fileName}" target="_blank" class="px-3 py-1 bg-white/20 hover:bg-white/40 text-[11px] font-bold rounded-lg transition-colors text-center shrink-0">
                            📂 เปิดดูไฟล์: ${fileName}
                        </a>
                    </div>`;
            }).join('');

            flags.push({ 
                type: 'orphan', 
                title: `พบใบงานที่มีปัญหา ${orphans.length} รายการ`, 
                detail: `<div class="space-y-1.5 mt-2">${detailHtml}</div>` 
            });
        }

        // 5.3 ข้อมูลสูญหาย (Missing Data)
        let missingCount = 0;
        this.scores.forEach(en => en.topics?.forEach(t => t.subTopics?.forEach(st => {
            if (st.scoreByYear && st.scoreByYear['2568'] === null) missingCount++;
        })));
        if (missingCount > 0) {
            flags.push({ type: 'missing', title: 'ฐานข้อมูลย่อย (Sub-topic) สูญหาย', detail: `ตรวจพบค่า Null ใน Sub-topic จำนวน ${missingCount} จุด ส่งผลต่อการประเมินความต่อเนื่อง` });
        }

        return flags;
    }
}