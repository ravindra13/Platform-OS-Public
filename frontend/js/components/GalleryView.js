// js/components/GalleryView.js
import { fetchQuery } from '../services/api.js';
import { renderLoading, renderError } from '../utils/ui.js';
import { FilterBuilder } from './FilterBuilder.js';

export const GalleryView = (schema) => {
    const wrapper = document.createElement('div');
    wrapper.className = "flex flex-col gap-6 w-full h-full";

    let currentData = [];

    // --- 1. FILTER BUILDER ---
    const filterComponent = FilterBuilder(schema, (newFilters) => {
        fetchTableData(newFilters);
    });
    wrapper.appendChild(filterComponent);

    // --- 2. VERTICAL GRID CONTAINER ---
    const cardContainer = document.createElement('div');
    cardContainer.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full pb-8";
    wrapper.appendChild(cardContainer);

    // --- 3. VERTICAL CARD RENDERING ---
    const renderCards = () => {
        cardContainer.innerHTML = "";
        
        if (currentData.length === 0) {
            // Temporarily break the grid for the empty state
            cardContainer.className = "flex w-full"; 
            cardContainer.innerHTML = `<div class="p-12 w-full text-center text-slate-500 bg-white rounded-xl border border-slate-200">No records found.</div>`;
            return;
        }
        
        // Restore grid classes if data exists
        cardContainer.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full pb-8";

        // Filter out system fields and the image field from the standard text loop
        const displayColumns = schema.columns.filter(c => c !== 'Id' && c !== 'RECORD ID' && c !== schema.imageField);

        currentData.forEach(row => {
            const card = document.createElement('div');
            card.className = "bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-indigo-300 transition-all cursor-pointer group flex flex-col h-full overflow-hidden";
            card.onclick = () => {
                const idVal = row['Id'] || row['RECORD ID'];
                if (typeof openRecordDetail === 'function' && idVal) openRecordDetail(schema.dataSource, idVal);
            };

            const rowId = row['Id'] || row['RECORD ID'] || 'Unknown';
            
            let html = '';

            // Render Image Header if configured
            if (schema.imageField && row[schema.imageField]) {
                html += `<img src="${row[schema.imageField]}" class="w-full h-48 object-cover border-b border-slate-100" alt="Card image" />`;
            } else if (schema.imageField) {
                html += `<div class="w-full h-48 bg-slate-50 flex items-center justify-center text-slate-400 font-semibold text-xs border-b border-slate-100 uppercase tracking-widest">No Image</div>`;
            }

            html += `<div class="p-5 flex flex-col flex-1 gap-3">`;
            
            // Record ID & Action Icon
            html += `
                <div class="flex justify-between items-center pb-2 mb-2 border-b border-slate-100">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest block"># ${rowId}</span>
                    <svg class="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </div>
            `;

            // Body Fields
            displayColumns.forEach((col, index) => {
                const value = row[col];
                const displayValue = (value && typeof value === 'object') ? (value.Name || value.Id) : (value !== undefined && value !== null ? value : '-');
                
                // Treat the first column as a prominent Title
                if (index === 0) {
                    html += `
                        <div class="mb-1">
                            <span class="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-0.5 truncate">${col}</span>
                            <span class="text-lg text-slate-800 font-bold line-clamp-2" title="${displayValue}">${displayValue}</span>
                        </div>
                    `;
                } else {
                    // Standard fields
                    html += `
                        <div>
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5 truncate">${col}</span>
                            <span class="text-sm text-slate-600 font-medium truncate block" title="${displayValue}">${displayValue}</span>
                        </div>
                    `;
                }
            });

            html += `</div>`;
            card.innerHTML = html;
            cardContainer.appendChild(card);
        });
    };

    // --- 4. FETCH DATA ---
    const fetchTableData = async (activeFilters = []) => {
        renderLoading(cardContainer, "Fetching records...");
        try {
            // Ensure the image field is fetched even if it wasn't explicitly listed in columns
            const queryFields = [...schema.columns];
            if (schema.imageField && !queryFields.includes(schema.imageField)) {
                queryFields.push(schema.imageField);
            }
            // Add ID if missing to ensure routing works
            if (!queryFields.includes('Id') && !queryFields.includes('RECORD ID')) {
                queryFields.push('Id'); 
            }
            
            currentData = await fetchQuery(schema.dataSource, queryFields, activeFilters);
            renderCards();
        } catch (error) {
            renderError(cardContainer, "Failed to load data.");
        }
    }
    
    // Initial load
    fetchTableData(schema.filters || []);

    return wrapper;
};