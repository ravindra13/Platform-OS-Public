// js/components/KanbanBoard.js
import { fetchQuery, executeAction, fetchBlueprint } from '../services/api.js';
import { renderError } from '../utils/ui.js'; // renderLoading removed in favor of skeletons
import { FilterBuilder } from './FilterBuilder.js';

export const KanbanBoard = (schema) => {
    const mainContainer = document.createElement('div');
    mainContainer.className = "flex flex-col gap-4 h-full w-full";

    const wrapper = document.createElement('div');
    // Added relative positioning for the scroll container
    wrapper.className = "flex h-full w-full gap-6 overflow-x-auto pb-4 custom-scrollbar items-start relative";

    let objectBlueprint = null;
    let currentData = [];
    let activeFilters = schema.filters || [];

    // --- EDGE AUTO-SCROLLING ON DRAG ---
    wrapper.addEventListener('dragover', (e) => {
        const edgeThreshold = 100; // pixels from the edge to trigger scroll
        const scrollSpeed = 15;
        const rect = wrapper.getBoundingClientRect();
        
        // Scroll Right
        if (e.clientX > rect.right - edgeThreshold) {
            wrapper.scrollBy({ left: scrollSpeed });
        } 
        // Scroll Left
        else if (e.clientX < rect.left + edgeThreshold) {
            wrapper.scrollBy({ left: -scrollSpeed });
        }
    });

    const filterComponent = FilterBuilder(schema, (newFilters) => {
        activeFilters = newFilters;
        if (objectBlueprint) {
            renderSkeletons();
            fetchTableData();
        }
    });

    mainContainer.appendChild(filterComponent);
    mainContainer.appendChild(wrapper);

    const initBoard = async () => {
        // Initial generic skeleton before blueprint loads
        wrapper.innerHTML = `<div class="w-full p-8 text-center text-slate-400 font-bold animate-pulse">Loading Board Architecture...</div>`;

        try {
            objectBlueprint = await fetchBlueprint(schema.dataSource);

            const groupFieldDef = Array.isArray(objectBlueprint.fields)
                ? objectBlueprint.fields.find(f => f.field_name === schema.groupByField)
                : objectBlueprint.fields[schema.groupByField];

            if (!groupFieldDef || groupFieldDef.data_type !== 'PICKLIST') {
                throw new Error(`Field '${schema.groupByField}' is not a valid Picklist.`);
            }

            const allowedValues = groupFieldDef.config.allowed_values;
            buildColumns(allowedValues);
            renderSkeletons(); // Show skeleton cards in the actual columns
            
            await fetchTableData();

        } catch (err) {
            renderError(wrapper, `Failed to load Kanban configuration: ${err.message}`);
        }
    };

    const buildColumns = (columns) => {
        wrapper.innerHTML = "";

        columns.forEach(colValue => {
            const colWrapper = document.createElement('div');
            colWrapper.className = "flex flex-col flex-shrink-0 w-80 bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden max-h-full shadow-sm relative";

            // --- STICKY HEADER ---
            const colHeader = document.createElement('div');
            colHeader.className = "sticky top-0 z-20 p-4 border-b border-slate-200 bg-white shadow-sm flex flex-col gap-2";
            
            colHeader.innerHTML = `
                <div class="flex justify-between items-center w-full">
                    <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider">${colValue}</h3>
                    <span class="text-xs font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full border border-slate-200" id="count-${colValue}">0</span>
                </div>
                ${schema.aggregateField ? `<div class="text-xs font-bold text-indigo-600 truncate" id="aggregate-${colValue}">$0.00</div>` : ''}
            `;
            colWrapper.appendChild(colHeader);

            const dropZoneContainer = document.createElement('div');
            dropZoneContainer.className = "flex-1 overflow-y-auto custom-scrollbar p-3 relative";
            
            const dropZone = document.createElement('div');
            dropZone.className = "flex flex-col gap-3 min-h-[150px] transition-all rounded-xl border-2 border-transparent relative z-10";
            dropZone.dataset.columnValue = colValue;

            // Empty State Placeholder
            const emptyState = document.createElement('div');
            emptyState.id = `empty-${colValue}`;
            emptyState.className = "hidden h-24 border-2 border-dashed border-slate-300 rounded-xl items-center justify-center text-xs font-bold text-slate-400 uppercase tracking-widest";
            emptyState.innerText = "Drop Here";
            dropZone.appendChild(emptyState);

            dropZone.addEventListener('dragover', e => {
                e.preventDefault();
                dropZone.classList.add('bg-indigo-50/50', 'border-indigo-200');
            });

            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('bg-indigo-50/50', 'border-indigo-200');
            });

            dropZone.addEventListener('drop', async e => {
                e.preventDefault();
                dropZone.classList.remove('bg-indigo-50/50', 'border-indigo-200');

                const recordId = e.dataTransfer.getData('text/plain');
                const cardEl = document.getElementById(`kanban-card-${recordId}`);
                if (!cardEl) return;

                const oldZone = cardEl.parentElement;
                const oldColValue = oldZone.dataset.columnValue;

                if (oldColValue === colValue) return;

                dropZone.appendChild(cardEl);
                updateCounts();

                try {
                    const updatePayload = {
                        "Id": recordId,
                        [schema.groupByField]: colValue
                    };
                    await executeAction(schema.dataSource, [updatePayload]);
                } catch (error) {
                    if (window.showToast) window.showToast(`Move Failed: ${error.message}`, "error");
                    else alert(`Move Failed: ${error.message}`);
                    
                    oldZone.appendChild(cardEl);
                    updateCounts();
                }
            });

            dropZoneContainer.appendChild(dropZone);
            colWrapper.appendChild(dropZoneContainer);
            wrapper.appendChild(colWrapper);
        });
    };

    // --- SKELETON LOADING STATE ---
    const renderSkeletons = () => {
        wrapper.querySelectorAll('[data-column-value]').forEach(zone => {
            clearCards(zone); // Clears real cards
            for (let i = 0; i < 3; i++) {
                const skeleton = document.createElement('div');
                skeleton.className = "skeleton-card bg-white p-4 rounded-xl border border-slate-200 shadow-sm animate-pulse h-28 flex flex-col gap-3";
                skeleton.innerHTML = `
                    <div class="h-3 bg-slate-200 rounded w-1/4"></div>
                    <div class="h-4 bg-slate-200 rounded w-3/4 mt-2"></div>
                    <div class="h-3 bg-slate-200 rounded w-1/2"></div>
                `;
                zone.appendChild(skeleton);
            }
        });
    };

    const clearCards = (specificZone = null) => {
        const zones = specificZone ? [specificZone] : wrapper.querySelectorAll('[data-column-value]');
        zones.forEach(zone => {
            Array.from(zone.children).forEach(child => {
                if (!child.id.startsWith('empty-')) child.remove();
            });
        });
        if (!specificZone) updateCounts();
    };

    const fetchTableData = async () => {
        try {
            const queryFields = [...new Set([...schema.cardFields, 'Id', schema.groupByField])];
            if (schema.aggregateField && !queryFields.includes(schema.aggregateField)) queryFields.push(schema.aggregateField);
            if (schema.tagField && !queryFields.includes(schema.tagField)) queryFields.push(schema.tagField);

            currentData = await fetchQuery(schema.dataSource, queryFields, activeFilters);
            
            // Clear skeletons and render real data
            clearCards();

            currentData.forEach(row => {
                const colValue = row[schema.groupByField];
                const dropZone = wrapper.querySelector(`[data-column-value="${colValue}"]`);
                if (dropZone) {
                    dropZone.appendChild(createCard(row));
                }
            });

            updateCounts();
        } catch (error) {
            console.error("Failed to load Kanban data", error);
        }
    };

    const createCard = (row) => {
        const card = document.createElement('div');
        card.id = `kanban-card-${row.Id}`;
        card.draggable = schema.allowDragAndDrop !== false;
        
        // --- VISUAL TAGS / PRIORITY ---
        let tagColorClass = 'border-l-transparent';
        if (schema.tagField && row[schema.tagField]) {
            const tagVal = String(row[schema.tagField]).toLowerCase();
            if (tagVal.includes('high') || tagVal.includes('urgent')) tagColorClass = 'border-l-rose-500';
            else if (tagVal.includes('medium')) tagColorClass = 'border-l-amber-400';
            else if (tagVal.includes('low')) tagColorClass = 'border-l-emerald-400';
            else tagColorClass = 'border-l-indigo-400'; // Default tag color
        }
        
        card.className = `bg-white p-4 rounded-xl border border-slate-200 border-l-4 ${tagColorClass} shadow-sm transition-all group flex flex-col gap-3 relative overflow-hidden ${card.draggable ? 'cursor-grab active:cursor-grabbing hover:shadow-md hover:border-r-indigo-300 hover:border-y-indigo-300 hover:-translate-y-0.5' : 'cursor-pointer'}`;

        // Save aggregate value to dataset for easy calculation
        if (schema.aggregateField) {
            card.dataset.aggregateValue = parseFloat(row[schema.aggregateField]) || 0;
        }

        card.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', row.Id);
            setTimeout(() => card.classList.add('opacity-40', 'scale-95'), 0);
        });

        card.addEventListener('dragend', () => card.classList.remove('opacity-40', 'scale-95'));

        card.dataset.quickViewTrigger = "true";
        card.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof openQuickView === 'function') openQuickView(schema.dataSource, row.Id, e);
        });

        let html = `
            <div class="flex justify-between items-start border-b border-slate-100 pb-2">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest"># ${row.Id}</span>
                ${schema.tagField && row[schema.tagField] ? `<span class="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded uppercase">${row[schema.tagField]}</span>` : ''}
            </div>
            <div class="flex flex-col gap-2">
        `;

        schema.cardFields.forEach((col, index) => {
            if (col === 'Id' || col === schema.groupByField) return;
            const val = row[col];
            const displayVal = (val && typeof val === 'object') ? (val.Name || val.Id) : (val !== undefined && val !== null ? val : '-');
            
            if (index === 0) {
                html += `
                    <div class="mb-1">
                        <span class="text-sm font-bold text-slate-800 line-clamp-2 leading-tight">${displayVal}</span>
                    </div>
                `;
            } else {
                html += `
                    <div>
                        <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest block truncate">${col}</span>
                        <span class="text-xs font-semibold text-slate-600 truncate block">${displayVal}</span>
                    </div>
                `;
            }
        });

        html += `</div>`;
        card.innerHTML = html;
        return card;
    };

    const updateCounts = () => {
        wrapper.querySelectorAll('[data-column-value]').forEach(zone => {
            const colValue = zone.dataset.columnValue;
            const cards = Array.from(zone.children).filter(child => !child.id.startsWith('empty-') && !child.classList.contains('skeleton-card'));
            
            // 1. Update Header Count
            const countEl = document.getElementById(`count-${colValue}`);
            if (countEl) countEl.innerText = cards.length;

            // 2. Update Value Aggregation Pipeline
            if (schema.aggregateField) {
                const aggregateEl = document.getElementById(`aggregate-${colValue}`);
                if (aggregateEl) {
                    const totalValue = cards.reduce((sum, card) => sum + (parseFloat(card.dataset.aggregateValue) || 0), 0);
                    
                    // Format as Currency (assuming USD for example, but adapts nicely)
                    const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
                    aggregateEl.innerText = formatter.format(totalValue);
                }
            }

            // 3. Toggle Empty State Visibility
            const emptyEl = document.getElementById(`empty-${colValue}`);
            if (emptyEl) {
                emptyEl.style.display = cards.length === 0 ? 'flex' : 'none';
            }
        });
    };

    initBoard();
    return mainContainer;
};