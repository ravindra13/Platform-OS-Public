// js/components/SpreadsheetView.js
import { fetchQuery, executeAction, fetchBlueprint } from '../services/api.js';
import { renderLoading, renderError } from '../utils/ui.js';
import { FilterBuilder } from './FilterBuilder.js';

export const SpreadsheetView = (schema) => {
    const mainContainer = document.createElement('div');
    mainContainer.className = "flex flex-col gap-5 h-full w-full";

    // --- Header Toolbar ---
    const toolbar = document.createElement('div');
    toolbar.className = "flex justify-between items-center bg-white p-3.5 border border-slate-200 rounded-2xl shadow-sm shrink-0";
    
    const leftControls = document.createElement('div');
    leftControls.id = "spreadsheet-filter-container";
    
    const rightControls = document.createElement('div');
    rightControls.className = "flex items-center gap-4";
    
    const changesBadge = document.createElement('span');
    changesBadge.className = "text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-full hidden transition-all";
    changesBadge.innerText = "0 Unsaved Changes";
    
    const saveBtn = document.createElement('button');
    saveBtn.className = "px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-sm hover:shadow transition-all opacity-50 cursor-not-allowed flex items-center gap-2";
    saveBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg> Save Changes`;
    saveBtn.disabled = true;

    rightControls.appendChild(changesBadge);
    rightControls.appendChild(saveBtn);
    toolbar.appendChild(leftControls);
    toolbar.appendChild(rightControls);

    // --- Grid Wrapper ---
    const wrapper = document.createElement('div');
    wrapper.className = "flex-1 overflow-auto bg-white border border-slate-200 rounded-2xl shadow-sm custom-scrollbar relative focus:outline-none";
    wrapper.tabIndex = 0; // Make container focusable for keyboard events

    let objectBlueprint = null;
    let currentData = [];
    let activeFilters = schema.filters || [];
    
    // State for High-Density Grid
    let modifiedRows = new Map(); // Key: Row ID, Value: Object of changed fields
    let activeCell = { rowIdx: -1, colIdx: -1 };
    let isEditing = false;
    
    const columns = schema.columns || ['Id'];
    const editableFields = schema.editableFields || [];

    const filterComponent = FilterBuilder(schema, (newFilters) => {
        activeFilters = newFilters;
        if (objectBlueprint) {
            modifiedRows.clear();
            updateSaveUI();
            fetchTableData();
        }
    });
    
    leftControls.appendChild(filterComponent);

    mainContainer.appendChild(toolbar);
    mainContainer.appendChild(wrapper);

    const initBoard = async () => {
        renderLoading(wrapper, "Initializing Data Grid...");
        try {
            objectBlueprint = await fetchBlueprint(schema.dataSource);
            await fetchTableData();
        } catch (err) {
            renderError(wrapper, `Failed to load Spreadsheet: ${err.message}`);
        }
    };

    const fetchTableData = async () => {
        try {
            const queryFields = [...new Set([...columns, 'Id'])];
            currentData = await fetchQuery(schema.dataSource, queryFields, activeFilters);
            renderGrid();
        } catch (error) {
            console.error("Failed to load Grid data", error);
            renderError(wrapper, `Error loading data: ${error.message}`);
        }
    };

    // --- GRID RENDERING ---
    const renderGrid = () => {
        wrapper.innerHTML = "";
        
        const table = document.createElement('table');
        table.className = "w-full border-collapse text-sm text-left text-slate-700 min-w-max select-none";

        // Header Row
        const thead = document.createElement('thead');
        thead.className = "sticky top-0 bg-slate-50 z-10 shadow-[0_1px_0_rgba(203,213,225,1)]";
        const headerRow = document.createElement('tr');
        
        // Row Number Column
        const rowNumHeader = document.createElement('th');
        rowNumHeader.className = "w-12 px-2 py-3 border-r border-slate-200 bg-slate-100/80 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest sticky left-0 z-20 backdrop-blur-sm";
        rowNumHeader.innerText = "#";
        headerRow.appendChild(rowNumHeader);

        columns.forEach(col => {
            const th = document.createElement('th');
            th.className = "px-4 py-3 border-r border-slate-200 truncate max-w-[200px] backdrop-blur-sm";
            
            const isEditable = editableFields.includes(col);
            th.innerHTML = `
                <div class="flex items-center justify-between gap-3">
                    <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">${col}</span>
                    ${isEditable ? `<svg class="w-3.5 h-3.5 text-indigo-400 opacity-70" title="Editable Column" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>` : ''}
                </div>
            `;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Body Rows
        const tbody = document.createElement('tbody');
        if (currentData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="${columns.length + 1}" class="p-16">
                        <div class="flex items-center justify-center text-sm font-bold text-slate-400 uppercase tracking-widest border-2 border-dashed border-slate-200 rounded-xl py-12">
                            No records found
                        </div>
                    </td>
                </tr>`;
        }

        currentData.forEach((row, rowIdx) => {
            const tr = document.createElement('tr');
            tr.className = "border-b border-slate-100 hover:bg-indigo-50/30 transition-colors group";
            tr.dataset.rowId = row.Id;
            
            // Row Number Cell
            const rowNumCell = document.createElement('td');
            rowNumCell.className = "w-12 px-2 py-2 border-r border-slate-100 bg-slate-50 text-center text-xs text-slate-400 font-mono sticky left-0 z-10 group-hover:bg-indigo-50/50 transition-colors";
            rowNumCell.innerText = rowIdx + 1;
            tr.appendChild(rowNumCell);

            columns.forEach((col, colIdx) => {
                const td = document.createElement('td');
                td.className = "px-4 py-2 border-r border-slate-100 truncate max-w-[250px] relative transition-all cursor-cell";
                td.dataset.rowIdx = rowIdx;
                td.dataset.colIdx = colIdx;
                td.dataset.field = col;
                
                const isEditable = editableFields.includes(col);
                if (!isEditable) td.classList.add("bg-slate-50/40", "text-slate-500");

                renderCellContent(td, row, col);

                // Interaction
                td.addEventListener('mousedown', (e) => {
                    if (e.detail === 2 && isEditable) { // Double click
                        enterEditMode(td, row, col);
                    } else {
                        setActiveCell(rowIdx, colIdx);
                    }
                });

                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        
        table.appendChild(tbody);
        wrapper.appendChild(table);
    };

    const renderCellContent = (td, row, col) => {
        const rowId = row.Id;
        const modifiedRow = modifiedRows.get(rowId);
        const hasChange = modifiedRow && modifiedRow.hasOwnProperty(col);
        
        let displayVal = hasChange ? modifiedRow[col] : row[col];
        displayVal = (displayVal && typeof displayVal === 'object') ? (displayVal.Name || displayVal.Id) : (displayVal || '');

        td.innerHTML = `<span class="block truncate ${hasChange ? 'font-semibold text-indigo-700' : 'text-slate-700 font-medium'}">${displayVal}</span>`;
        
        if (hasChange) {
            // Polished Dirty Indicator (Sleek corner fold)
            const indicator = document.createElement('div');
            indicator.className = "absolute top-0 right-0 w-2.5 h-2.5 bg-amber-400 shadow-sm";
            indicator.style.clipPath = "polygon(100% 0, 0 0, 100% 100%)";
            td.appendChild(indicator);
            td.classList.add("bg-amber-50/40");
        } else {
            td.classList.remove("bg-amber-50/40");
        }
    };

    // --- KEYBOARD & FOCUS NAVIGATION ---
    const setActiveCell = (rowIdx, colIdx) => {
        if (isEditing) return; 
        
        // Remove old active
        const oldActive = wrapper.querySelector('.ring-2.ring-indigo-500');
        if (oldActive) {
            oldActive.classList.remove('ring-2', 'ring-indigo-500', 'ring-inset', 'bg-indigo-50/60', 'z-10');
        }

        // Bound checks
        if (rowIdx < 0) rowIdx = 0;
        if (rowIdx >= currentData.length) rowIdx = currentData.length - 1;
        if (colIdx < 0) colIdx = 0;
        if (colIdx >= columns.length) colIdx = columns.length - 1;

        activeCell = { rowIdx, colIdx };

        // Set new active
        const newActive = wrapper.querySelector(`td[data-row-idx="${rowIdx}"][data-col-idx="${colIdx}"]`);
        if (newActive) {
            newActive.classList.add('ring-2', 'ring-indigo-500', 'ring-inset', 'bg-indigo-50/60', 'z-10');
            newActive.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
        
        wrapper.focus(); 
    };

    wrapper.addEventListener('keydown', (e) => {
        if (isEditing) return; 
        if (activeCell.rowIdx === -1) return;

        const { rowIdx, colIdx } = activeCell;
        const col = columns[colIdx];
        const row = currentData[rowIdx];
        const td = wrapper.querySelector(`td[data-row-idx="${rowIdx}"][data-col-idx="${colIdx}"]`);

        switch(e.key) {
            case 'ArrowUp':
                e.preventDefault();
                setActiveCell(rowIdx - 1, colIdx);
                break;
            case 'ArrowDown':
                e.preventDefault();
                setActiveCell(rowIdx + 1, colIdx);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                setActiveCell(rowIdx, colIdx - 1);
                break;
            case 'ArrowRight':
            case 'Tab':
                e.preventDefault();
                if (colIdx + 1 >= columns.length && rowIdx + 1 < currentData.length) {
                    setActiveCell(rowIdx + 1, 0); 
                } else {
                    setActiveCell(rowIdx, colIdx + 1);
                }
                break;
            case 'Enter':
                e.preventDefault();
                if (editableFields.includes(col)) {
                    enterEditMode(td, row, col);
                }
                break;
            case 'Backspace':
            case 'Delete':
                if (editableFields.includes(col)) {
                    commitCellEdit(row.Id, col, null);
                    renderCellContent(td, row, col);
                }
                break;
            default:
                if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && editableFields.includes(col)) {
                    e.preventDefault();
                    const input = enterEditMode(td, row, col);
                    input.value = e.key;
                }
                break;
        }
    });

    // --- INLINE EDITING ---
    const enterEditMode = (td, row, col) => {
        isEditing = true;
        const rowId = row.Id;
        
        const modifiedRow = modifiedRows.get(rowId);
        const currentVal = (modifiedRow && modifiedRow.hasOwnProperty(col)) ? modifiedRow[col] : row[col];
        const displayVal = (currentVal && typeof currentVal === 'object') ? (currentVal.Name || currentVal.Id) : (currentVal || '');

        td.innerHTML = "";
        const input = document.createElement('input');
        input.type = "text";
        input.className = "absolute inset-0 w-full h-full px-4 bg-white border-2 border-indigo-500 focus:outline-none z-20 text-sm font-semibold shadow-lg text-slate-800";
        input.value = displayVal;
        
        td.appendChild(input);
        input.focus();
        input.select();

        const saveAndExit = () => {
            if (!isEditing) return;
            isEditing = false;
            commitCellEdit(rowId, col, input.value);
            renderCellContent(td, row, col);
            wrapper.focus();
        };

        input.addEventListener('blur', saveAndExit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveAndExit();
                setActiveCell(activeCell.rowIdx + 1, activeCell.colIdx);
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                isEditing = false;
                renderCellContent(td, row, col); 
                wrapper.focus();
            }
            if (e.key === 'Tab') {
                e.preventDefault();
                saveAndExit();
                setActiveCell(activeCell.rowIdx, activeCell.colIdx + 1);
            }
        });

        return input;
    };

    const commitCellEdit = (rowId, col, newVal) => {
        const originalRow = currentData.find(r => r.Id === rowId);
        const originalVal = originalRow[col];
        const originalDisplay = (originalVal && typeof originalVal === 'object') ? (originalVal.Name || originalVal.Id) : (originalVal || '');

        if (newVal !== originalDisplay) {
            if (!modifiedRows.has(rowId)) modifiedRows.set(rowId, {});
            modifiedRows.get(rowId)[col] = newVal;
        } else {
            if (modifiedRows.has(rowId)) {
                delete modifiedRows.get(rowId)[col];
                if (Object.keys(modifiedRows.get(rowId)).length === 0) {
                    modifiedRows.delete(rowId);
                }
            }
        }
        updateSaveUI();
    };

    const updateSaveUI = () => {
        const count = modifiedRows.size;
        if (count > 0) {
            changesBadge.style.display = "block";
            changesBadge.innerText = `${count} Unsaved Row${count > 1 ? 's' : ''}`;
            saveBtn.disabled = false;
            saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            changesBadge.style.display = "none";
            saveBtn.disabled = true;
            saveBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    };

    // --- BULK SAVE EXECUTION ---
    saveBtn.addEventListener('click', async () => {
        if (modifiedRows.size === 0) return;
        
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Saving...`;

        try {
            const payloads = [];
            modifiedRows.forEach((changes, rowId) => {
                payloads.push({ Id: rowId, ...changes });
            });

            await executeAction(schema.dataSource, payloads);
            
            modifiedRows.clear();
            updateSaveUI();
            
            // Success state
            saveBtn.classList.replace('bg-indigo-600', 'bg-emerald-600');
            saveBtn.classList.replace('hover:bg-indigo-700', 'hover:bg-emerald-700');
            saveBtn.innerHTML = `<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg> Saved!`;
            
            setTimeout(() => {
                saveBtn.classList.replace('bg-emerald-600', 'bg-indigo-600');
                saveBtn.classList.replace('hover:bg-emerald-700', 'hover:bg-indigo-700');
                saveBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg> Save Changes`;
                updateSaveUI(); 
            }, 2000);
            
            await fetchTableData();

        } catch (error) {
            alert(`Failed to save changes: ${error.message}`);
            saveBtn.disabled = false;
            saveBtn.innerHTML = `Retry Save`;
        }
    });

    initBoard();
    return mainContainer;
};