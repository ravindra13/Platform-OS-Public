// js/components/ObjectCard.js
import { Theme } from '../theme.js';
import { initRouter } from '../router.js'; 

export const ObjectCard = (schema) => {
    const card = document.createElement('div');
    card.className = "p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow cursor-pointer group flex flex-col h-full";
    
    const color = schema.color || "indigo";

    card.innerHTML = `
        <div class="flex justify-between items-start mb-4">
            <div class="p-2.5 bg-${color}-50 rounded-xl text-${color}-600 group-hover:scale-110 transition-transform">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path>
                </svg>
            </div>
            <span class="text-slate-400 text-xs font-semibold bg-slate-100 px-2 py-1 rounded-md">
                ${schema.viewsCount || 0} Views
            </span>
        </div>
        <h3 class="text-lg font-bold text-slate-800 mb-1">${schema.label}</h3>
        <p class="text-sm text-slate-500 font-mono mb-4">${schema.object_name}</p>
        <div class="mt-auto pt-4 border-t border-slate-100 flex items-center text-sm font-semibold text-indigo-600">
            View Records 
            <svg class="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
        </div>
    `;
    
    card.addEventListener('click', () => {
        initRouter(schema.object_name, 'list'); 
    });

    return card;
};