import { Theme } from '../theme.js';

export const KPI_Card = (schema) => {
    const card = document.createElement('div');
    card.className = Theme.dashboard.card;
    const color = schema.color || "indigo";

    card.innerHTML = `
        <div class="flex justify-between items-start mb-4">
            <div class="p-2.5 bg-${color}-50 rounded-xl text-${color}-600">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
            </div>
            <span class="text-emerald-500 text-sm font-bold bg-emerald-50 px-2 py-1 rounded-md flex items-center gap-1">${schema.trend}</span>
        </div>
        <h3 class="${Theme.dashboard.kpiLabel}">${schema.label}</h3>
        <p class="${Theme.dashboard.kpiValue}">${schema.value}</p>
    `;
    
    return card;
};
