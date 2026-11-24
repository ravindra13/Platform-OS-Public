// js/components/ActivityStream.js
import { renderLoading, renderError } from '../utils/ui.js';

export const ActivityStream = (schema) => {
    const wrapper = document.createElement('div');
    wrapper.className = "flex flex-col gap-4 w-full p-6 bg-white rounded-xl border border-slate-200 shadow-sm";

    const header = document.createElement('h3');
    header.className = "text-sm font-bold text-slate-700 uppercase tracking-widest border-b border-slate-100 pb-3 mb-2 flex items-center gap-2";
    header.innerHTML = `<svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>Audit History`;
    wrapper.appendChild(header);

    const timelineContainer = document.createElement('div');
    timelineContainer.className = "relative border-l-2 border-slate-100 ml-2 space-y-6 pb-2";
    wrapper.appendChild(timelineContainer);

    const fetchHistory = async () => {
        renderLoading(timelineContainer, "Loading audit trail...");
        try {
            const tenantId = document.getElementById('currentTenant').innerText;

            // Fetch from the ledger_router endpoint
            const res = await fetch(`/api/ledger/${tenantId}/${schema.recordId}`);
            if (!res.ok) throw new Error("Failed to fetch ledger");

            const data = await res.json();
            renderTimeline(data.history || []);
        } catch (error) {
            renderError(timelineContainer, "Unable to load history.");
        }
    };

    const renderTimeline = (history) => {
        timelineContainer.innerHTML = "";
        if (history.length === 0) {
            timelineContainer.innerHTML = `<div class="pl-6 text-sm text-slate-500">No activity recorded yet.</div>`;
            return;
        }

        // Reverse the array so the newest actions appear at the top
        [...history].reverse().forEach(entry => {
            const item = document.createElement('div');
            item.className = "relative pl-6";

            // Color code the timeline dots based on the action
            let dotColor = "bg-blue-400"; // Default Update
            if (entry.action === "CREATE") dotColor = "bg-emerald-400";
            if (entry.action === "HARD_DELETE") dotColor = "bg-rose-400";

            const dateStr = new Date(entry.timestamp).toLocaleString();

            let contentHTML = `
                <div class="text-sm font-bold text-slate-800">${entry.action} by ${entry.actor_id}</div>
                <div class="text-[11px] font-medium text-slate-400 mb-2">${dateStr}</div>
            `;

            // Render field-level deltas if they exist
            if (entry.deltas && entry.deltas.length > 0) {
                const changes = entry.deltas.map(d => `
                    <div class="text-sm text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 mt-1.5 flex flex-col gap-1">
                        <span class="font-bold text-slate-700 text-xs uppercase tracking-wider">${d.field_name}</span>
                
                        <div class="flex items-center gap-2 text-xs">
                            <span class="line-through text-slate-400">${d.old_value !== null ? d.old_value : 'empty'}</span>
                            <svg class="w-3 h-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                            <span class="text-indigo-600 font-semibold">${d.new_value !== null ? d.new_value : 'empty'}</span>
                        </div>
                    </div>
                `).join("");
                contentHTML += `<div class="mt-2">${changes}</div>`;
            }

            item.innerHTML = `
                <div class="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ${dotColor} ring-4 ring-white"></div>
                ${contentHTML}
            `;
            timelineContainer.appendChild(item);
        });
    };

    if (schema.recordId && schema.recordId !== "__NEW_RECORD__") {
        fetchHistory();
    } else {
        timelineContainer.innerHTML = `<div class="pl-6 py-4 text-sm text-slate-400 bg-slate-50 rounded-lg border border-slate-100 text-center">Save this record to begin tracking history.</div>`;
    }

    return wrapper;
};
