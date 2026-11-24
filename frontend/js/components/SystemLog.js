import { Theme } from '../theme.js';

export const SystemLog = (schema) => {
  const log = document.createElement('div');
  log.className = Theme.dashboard.moduleWrapper;
  log.innerHTML = `
    <h3 class="${Theme.dashboard.moduleHeader}">
      <div class="w-2 h-2 bg-indigo-500 rounded-full"></div>
      Recent Platform Activity
    </h3>
    <div class="space-y-6">
      <!-- Log items -->
      <div class="flex gap-4">
        <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200"><span class="text-slate-500 font-bold text-sm">AS</span></div>
        <div>
          <p class="text-sm text-slate-800 font-medium">Alice Smith updated <span class="text-indigo-600 cursor-pointer">PurchaseOrder_092</span></p>
          <p class="text-xs text-slate-500 mt-1">Status changed from Pending to Approved</p>
        </div>
        <span class="ml-auto text-xs font-semibold text-slate-400">10m ago</span>
      </div>
    </div>
  `;
  return log;
};
