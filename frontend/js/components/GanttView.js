// js/components/GanttView.js
import { fetchQuery, executeAction, fetchBlueprint } from '../services/api.js';
import { renderLoading, renderError } from '../utils/ui.js';
import { FilterBuilder } from './FilterBuilder.js';

export const GanttView = (schema) => {
    const mainContainer = document.createElement('div');
    mainContainer.className = "flex flex-col gap-4 h-full w-full";

    const wrapper = document.createElement('div');
    wrapper.className = "flex flex-col flex-1 overflow-hidden bg-white border border-slate-200 rounded-xl shadow-sm";

    let objectBlueprint = null;
    let currentData = [];
    let activeFilters = schema.filters || [];
    
    // Time Scale Configuration
    let currentScale = 'days';
    const scaleConfig = {
        days: { pxPerDay: 40, label: 'Days' },
        weeks: { pxPerDay: 12, label: 'Weeks' },
        months: { pxPerDay: 4, label: 'Months' }
    };
    
    let minGlobalDate = new Date();
    let maxGlobalDate = new Date();
    let totalDays = 0;

    const filterComponent = FilterBuilder(schema, (newFilters) => {
        activeFilters = newFilters;
        if (objectBlueprint) {
            renderLoading(wrapper, "Refreshing...");
            fetchTableData();
        }
    });

    mainContainer.appendChild(filterComponent);
    mainContainer.appendChild(wrapper);

    const initBoard = async () => {
        renderLoading(wrapper, "Initializing Gantt Timeline...");
        try {
            objectBlueprint = await fetchBlueprint(schema.dataSource);

            const validateField = (fieldName, expectedTypes) => {
                const fieldDef = Array.isArray(objectBlueprint.fields)
                    ? objectBlueprint.fields.find(f => f.field_name === fieldName)
                    : objectBlueprint.fields[fieldName];
                
                if (!fieldDef || !expectedTypes.includes(fieldDef.data_type)) {
                    throw new Error(`Field '${fieldName}' is missing or not one of types: ${expectedTypes.join(', ')}.`);
                }
            };

            validateField(schema.startDateField, ['DATE', 'DATETIME']);
            validateField(schema.endDateField, ['DATE', 'DATETIME']);

            await fetchTableData();
        } catch (err) {
            renderError(wrapper, `Failed to load Gantt configuration: ${err.message}`);
        }
    };

    const fetchTableData = async () => {
        try {
            const rawFields = [
                'Id',
                schema.titleField,
                schema.startDateField,
                schema.endDateField,
                schema.progressField
            ];
            
            const queryFields = [...new Set(rawFields.filter(field => field != null))];
            currentData = await fetchQuery(schema.dataSource, queryFields, activeFilters);
            
            calculateTimelineBounds();
            renderGantt();
        } catch (error) {
            console.error("Failed to load Gantt data", error);
            renderError(wrapper, `Error loading timeline data: ${error.message}`);
        }
    };

    const calculateTimelineBounds = () => {
        if (!currentData || currentData.length === 0) return;

        let min = new Date(8640000000000000);
        let max = new Date(-8640000000000000);

        currentData.forEach(row => {
            const start = row[schema.startDateField] ? new Date(row[schema.startDateField]) : null;
            const end = row[schema.endDateField] ? new Date(row[schema.endDateField]) : null;

            if (start && !isNaN(start) && start < min) min = start;
            if (end && !isNaN(end) && end > max) max = end;
        });

        if (min > max) {
            min = new Date();
            max = new Date();
        }

        minGlobalDate = new Date(min);
        minGlobalDate.setDate(minGlobalDate.getDate() - 7);
        maxGlobalDate = new Date(max);
        maxGlobalDate.setDate(maxGlobalDate.getDate() + 14);

        const diffTime = Math.abs(maxGlobalDate - minGlobalDate);
        totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const renderGantt = () => {
        wrapper.innerHTML = "";
        
        // --- 1. Controls Header ---
        const controlsHeader = document.createElement('div');
        controlsHeader.className = "flex justify-between items-center p-3 border-b border-slate-200 bg-slate-50 shrink-0";
        
        const titleSpan = document.createElement('span');
        titleSpan.className = "text-sm font-semibold text-slate-700";
        titleSpan.innerText = "Timeline View";
        controlsHeader.appendChild(titleSpan);

        const scaleToggleGroup = document.createElement('div');
        scaleToggleGroup.className = "flex bg-slate-200/50 p-1 rounded-lg gap-1 border border-slate-200";
        
        Object.keys(scaleConfig).forEach(scale => {
            const btn = document.createElement('button');
            btn.innerText = scaleConfig[scale].label;
            btn.className = `px-3 py-1 text-xs font-semibold rounded-md transition-colors ${currentScale === scale ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'}`;
            btn.onclick = () => { 
                currentScale = scale; 
                renderGantt(); 
            };
            scaleToggleGroup.appendChild(btn);
        });
        controlsHeader.appendChild(scaleToggleGroup);
        wrapper.appendChild(controlsHeader);

        if (currentData.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = "text-slate-500 italic p-4 flex justify-center items-center h-full w-full flex-1";
            emptyState.innerText = "No timeline records found.";
            wrapper.appendChild(emptyState);
            return;
        }

        // --- 2. Main Timeline Area ---
        const contentArea = document.createElement('div');
        contentArea.className = "flex flex-1 overflow-hidden relative";

        // Sidebar (Task Names)
        const sidebar = document.createElement('div');
        sidebar.className = "w-64 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col z-20 shadow-[2px_0_5px_rgba(0,0,0,0.02)]";
        
        const sidebarHeader = document.createElement('div');
        sidebarHeader.className = "h-14 border-b border-slate-200 flex items-center px-4 font-bold text-xs text-slate-500 uppercase tracking-wider bg-slate-50";
        sidebarHeader.innerText = "Task";
        sidebar.appendChild(sidebarHeader);

        const sidebarList = document.createElement('div');
        sidebarList.className = "flex-1 overflow-y-hidden flex flex-col"; 
        sidebar.appendChild(sidebarList);

        // Timeline Container
        const timelineContainer = document.createElement('div');
        timelineContainer.className = "flex-1 overflow-auto custom-scrollbar flex flex-col relative bg-slate-50/50";
        
        timelineContainer.addEventListener('scroll', () => {
            sidebarList.scrollTop = timelineContainer.scrollTop;
        });

        // Timeline Header & Background Grid
        const timelineHeader = document.createElement('div');
        timelineHeader.className = "h-14 border-b border-slate-200 flex sticky top-0 bg-slate-50 z-10 flex-shrink-0 min-w-max";
        
        const timelineGrid = document.createElement('div');
        timelineGrid.className = "flex flex-col relative min-w-max";
        
        const bgGrid = document.createElement('div');
        bgGrid.className = "absolute inset-0 flex pointer-events-none";

        const pxPerDay = scaleConfig[currentScale].pxPerDay;
        let currentIterDate = new Date(minGlobalDate);
        
        while (currentIterDate <= maxGlobalDate) {
            const col = document.createElement('div');
            let daysInBucket = 1;
            let labelHtml = '';

            if (currentScale === 'days') {
                daysInBucket = 1;
                const isToday = currentIterDate.toDateString() === new Date().toDateString();
                if (isToday) col.classList.add("bg-indigo-50", "text-indigo-600", "font-bold");
                labelHtml = `
                    <span>${currentIterDate.toLocaleDateString('en-US', { weekday: 'narrow' })}</span>
                    <span class="${isToday ? 'bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center' : 'text-slate-700'} mt-0.5 font-semibold text-xs">${currentIterDate.getDate()}</span>
                `;
            } else if (currentScale === 'weeks') {
                daysInBucket = 7;
                labelHtml = `<span class="font-semibold text-xs text-slate-600">Week of ${currentIterDate.toLocaleDateString('en-US', { month:'short', day:'numeric' })}</span>`;
            } else if (currentScale === 'months') {
                const year = currentIterDate.getFullYear();
                const month = currentIterDate.getMonth();
                const nextMonth = new Date(year, month + 1, 1);
                daysInBucket = Math.round((nextMonth - currentIterDate) / (1000*60*60*24));
                labelHtml = `<span class="font-semibold text-xs text-slate-600">${currentIterDate.toLocaleDateString('en-US', { month:'long', year:'numeric' })}</span>`;
            }

            const colWidth = daysInBucket * pxPerDay;
            
            col.style.width = `${colWidth}px`;
            col.className = "flex-shrink-0 border-r border-slate-200 flex flex-col items-center justify-center text-[10px] text-slate-400";
            col.innerHTML = labelHtml;
            timelineHeader.appendChild(col);
            
            const bgLine = document.createElement('div');
            bgLine.style.width = `${colWidth}px`;
            bgLine.className = "flex-shrink-0 border-r border-slate-200/50 h-full";
            bgGrid.appendChild(bgLine);

            if (currentScale === 'days') {
                currentIterDate.setDate(currentIterDate.getDate() + 1);
            } else if (currentScale === 'weeks') {
                currentIterDate.setDate(currentIterDate.getDate() + 7);
            } else if (currentScale === 'months') {
                currentIterDate.setMonth(currentIterDate.getMonth() + 1);
            }
        }

        timelineContainer.appendChild(timelineHeader);
        timelineGrid.appendChild(bgGrid);

        // Render Rows
        currentData.forEach((row, index) => {
            const sideRow = document.createElement('div');
            sideRow.className = `h-12 border-b border-slate-100 flex items-center px-4 transition-colors hover:bg-slate-50 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`;
            
            let labelVal = row[schema.titleField];
            labelVal = (labelVal && typeof labelVal === 'object') ? (labelVal.Name || labelVal.Id) : (labelVal || `Task #${row.Id}`);
            
            sideRow.innerHTML = `<span class="text-sm font-medium text-slate-700 truncate w-full" title="${labelVal}">${labelVal}</span>`;
            sidebarList.appendChild(sideRow);

            const timeRow = document.createElement('div');
            timeRow.className = `h-12 border-b border-slate-100 relative ${index % 2 === 0 ? 'bg-transparent' : 'bg-slate-50/30'}`;
            timeRow.style.width = `${(totalDays + 1) * pxPerDay}px`;

            const startDate = row[schema.startDateField] ? new Date(row[schema.startDateField]) : null;
            const endDate = row[schema.endDateField] ? new Date(row[schema.endDateField]) : null;

            if (startDate && !isNaN(startDate) && endDate && !isNaN(endDate)) {
                const startOffsetDays = (startDate - minGlobalDate) / (1000 * 60 * 60 * 24);
                let durationDays = (endDate - startDate) / (1000 * 60 * 60 * 24);
                if (durationDays < 1) durationDays = 1; 

                const leftPx = startOffsetDays * pxPerDay;
                const widthPx = durationDays * pxPerDay;

                const bar = document.createElement('div');
                bar.className = "absolute top-2 h-8 bg-indigo-500 rounded-md shadow-sm border border-indigo-600 hover:bg-indigo-600 transition-colors cursor-pointer flex items-center overflow-hidden group";
                bar.style.left = `${leftPx}px`;
                bar.style.width = `${widthPx}px`;

                if (schema.progressField && row[schema.progressField] !== undefined) {
                    const progress = Math.min(100, Math.max(0, row[schema.progressField] || 0));
                    const progressFill = document.createElement('div');
                    progressFill.className = "absolute inset-y-0 left-0 bg-indigo-400/50 pointer-events-none";
                    progressFill.style.width = `${progress}%`;
                    bar.appendChild(progressFill);
                }

                if (widthPx > 30) {
                    const barLabel = document.createElement('span');
                    barLabel.className = "text-[10px] font-semibold text-white px-2 truncate relative z-10 opacity-90 group-hover:opacity-100";
                    barLabel.innerText = labelVal;
                    bar.appendChild(barLabel);
                }

                bar.dataset.quickViewTrigger = "true";
                bar.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof openQuickView === 'function') {
                        openQuickView(schema.dataSource, row.Id, e);
                    }
                });

                timeRow.appendChild(bar);
            }
            timelineGrid.appendChild(timeRow);
        });

        timelineContainer.appendChild(timelineGrid);
        
        contentArea.appendChild(sidebar);
        contentArea.appendChild(timelineContainer);
        wrapper.appendChild(contentArea);
        
        // Auto-scroll logic depending on scale
        setTimeout(() => {
            const todayOffsetDays = (new Date() - minGlobalDate) / (1000 * 60 * 60 * 24);
            if (todayOffsetDays > 0 && todayOffsetDays < totalDays) {
                timelineContainer.scrollLeft = (todayOffsetDays * pxPerDay) - (timelineContainer.clientWidth / 2);
            }
        }, 100);
    };

    initBoard();
    return mainContainer;
};