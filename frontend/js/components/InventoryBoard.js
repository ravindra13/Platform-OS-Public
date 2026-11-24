// js/components/InventoryBoard.js
import { fetchQuery, executeAction } from '../services/api.js';
import { renderLoading, renderError } from '../utils/ui.js';
import { FilterBuilder } from './FilterBuilder.js';

export const InventoryBoard = (schema) => {
    const mainContainer = document.createElement('div');
    mainContainer.className = "flex flex-col gap-6 h-full w-full";

    let activeFilters = schema.filters || [];
    if (typeof FilterBuilder === 'function') {
        mainContainer.appendChild(FilterBuilder(schema, (newFilters) => {
            activeFilters = newFilters;
            fetchInventory();
        }));
    }

    const header = document.createElement('div');
    header.className = "flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200";
    header.innerHTML = `
        <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider">Live Inventory Status</h3>
        <div class="flex gap-4 text-xs font-semibold">
            <span class="flex items-center gap-1"><div class="w-3 h-3 rounded-full bg-emerald-400"></div> Healthy</span>
            <span class="flex items-center gap-1"><div class="w-3 h-3 rounded-full bg-rose-400"></div> Reorder Needed</span>
        </div>
    `;
    mainContainer.appendChild(header);

    const boardContainer = document.createElement('div');
    boardContainer.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full";
    mainContainer.appendChild(boardContainer);

    // Keep it simple: define function inside the scope, attach to window once cleanly.
    window.updateStockHandler = async (recordId, currentQty, adjustment) => {
        const newQty = currentQty + adjustment;
        if (newQty < 0) return;

        try {
            await executeAction(schema.dataSource, {
                "Id": recordId,
                [schema.quantityField]: newQty
            });
            fetchInventory(); 
        } catch (error) {
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast(`Stock adjustment failed: ${error.message}`, 'error');
            }
        }
    };

    const fetchInventory = async () => {
        renderLoading(boardContainer, "Fetching inventory levels...");

        try {
            const fields = ["Id", schema.titleField, schema.quantityField, schema.thresholdField, schema.skuField];
            const records = await fetchQuery(schema.dataSource, fields, activeFilters);
            
            boardContainer.innerHTML = "";

            if (records.length === 0) {
                boardContainer.innerHTML = `<div class="col-span-full py-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200">No inventory items found.</div>`;
                return;
            }

            records.forEach(row => {
                const qty = row[schema.quantityField] || 0;
                const threshold = row[schema.thresholdField] || 0;
                const isLowStock = qty <= threshold;

                const card = document.createElement('div');
                card.className = `bg-white p-5 rounded-xl border-l-4 shadow-sm hover:shadow-md transition-all flex flex-col gap-4 cursor-pointer ${isLowStock ? 'border-l-rose-500 border-y-slate-200 border-r-slate-200' : 'border-l-emerald-500 border-y-slate-200 border-r-slate-200'}`;
                
                // Allow opening the record just like the old version
                card.onclick = (e) => {
                    if (typeof window.openQuickView === 'function') window.openQuickView(schema.dataSource, row.Id, e);
                };

                card.innerHTML = `
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="text-sm font-bold text-slate-800 line-clamp-1">${row[schema.titleField]}</h4>
                            <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">${row[schema.skuField] || 'NO-SKU'}</span>
                        </div>
                        ${isLowStock ? `<span class="bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">LOW</span>` : ''}
                    </div>

                    <div class="flex items-center justify-between mt-2">
                        <div class="flex flex-col">
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">In Stock</span>
                            <span class="text-2xl font-black ${isLowStock ? 'text-rose-600' : 'text-slate-800'}">${qty}</span>
                        </div>
                
                        <div class="flex items-center gap-1 bg-slate-50 rounded-lg p-1 border border-slate-100">
                            <button class="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-md text-slate-600 hover:bg-slate-100 hover:text-rose-600 transition-colors font-bold shadow-sm" onclick="event.stopPropagation(); window.updateStockHandler('${row.Id}', ${qty}, -1)">-</button>
                            <button class="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-md text-slate-600 hover:bg-slate-100 hover:text-emerald-600 transition-colors font-bold shadow-sm" onclick="event.stopPropagation(); window.updateStockHandler('${row.Id}', ${qty}, 1)">+</button>
                        </div>
                    </div>
                `;
                boardContainer.appendChild(card);
            });

        } catch (error) {
            renderError(boardContainer, "Failed to load inventory data.");
        }
    };

    fetchInventory();
    return mainContainer;
};