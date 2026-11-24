import { Theme } from '../theme.js';

export const QuickActions = (schema) => {
    const actions = document.createElement('div');
    actions.className = Theme.dashboard.moduleWrapper;
    actions.innerHTML = `
        <h3 class="${Theme.dashboard.moduleHeader}">
            <div class="w-2 h-2 bg-emerald-500 rounded-full"></div>
            Quick Actions
        </h3>
        <div class="space-y-3">
            <button onclick="Installer.toggleModal()" class="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all group">
                <div class="flex items-center gap-3">
                    <div class="text-indigo-500 bg-white p-2 rounded-lg shadow-sm group-hover:scale-110 transition-transform"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg></div>
                    <span class="text-sm font-semibold text-slate-700">Deploy AI Package</span>
                </div>
                <svg class="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
            </button>
        </div>
    `;
    return actions;
};
