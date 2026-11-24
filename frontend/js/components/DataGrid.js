// js/components/DataGrid.js
import { fetchQuery } from '../services/api.js';
import { renderLoading, renderError } from '../utils/ui.js';
import { Theme } from '../theme.js';
import { FilterBuilder } from './FilterBuilder.js';

export const DataGrid = (schema) => {
    const wrapper = document.createElement('div');
    wrapper.className = "flex flex-col gap-4";

    let visibleColumns = schema.columns.slice(0, 6);
    let currentData = [];

    // --- 1. MOUNT ADVANCED FILTER BUILDER ---
    // The FilterBuilder handles its own UI and calls fetchTableData when rules change
    const filterComponent = FilterBuilder(schema, (newFilters) => {
        fetchTableData(newFilters);
    });

    // Optional: Add a simple column selector next to the filter builder
    const topBar = document.createElement('div');
    topBar.className = "flex justify-between items-start gap-4";

    const filterWrapper = document.createElement('div');
    filterWrapper.className = "flex-1";
    filterWrapper.appendChild(filterComponent);

    const colSelectorContainer = document.createElement('div');
    colSelectorContainer.className = "relative mt-1";

    const colSelectorBtn = document.createElement('button');
    colSelectorBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg> Columns`;
    colSelectorBtn.className = Theme.button.tableSelect;

    const colDropdown = document.createElement('div');
    colDropdown.className = "absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-4 hidden flex-col gap-3 z-50 max-h-64 overflow-y-auto custom-scrollbar";

    colSelectorBtn.onclick = () => {
        colDropdown.classList.toggle('hidden');
        colDropdown.classList.toggle('flex');
    };

    schema.columns.forEach(col => {
        const label = document.createElement('label');
        label.className = "flex items-center gap-3 text-sm text-slate-700 cursor-pointer hover:text-indigo-600 transition-colors";

        const checkbox = document.createElement('input');
        checkbox.type = "checkbox";
        checkbox.checked = visibleColumns.includes(col);
        checkbox.className = Theme.input.checkbox;

        checkbox.onchange = (e) => {
            if (e.target.checked) {
                visibleColumns.push(col);
                visibleColumns = schema.columns.filter(c => visibleColumns.includes(c));
            } else {
                visibleColumns = visibleColumns.filter(c => c !== col);
            }
            renderTable();
        };
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(col));
        colDropdown.appendChild(label);
    });

    colSelectorContainer.append(colSelectorBtn, colDropdown);
    topBar.append(filterWrapper, colSelectorContainer);

    // <-- THE ARCHITECTURAL FIX -->
    // Only mount the bulky toolbar if the backend didn't explicitly hide it
    if (!schema.hideToolbar && !schema.hideFilters) {
        wrapper.appendChild(topBar);
    }

    // wrapper.appendChild(topBar);

    // --- 2. TRUE TABLE STRUCTURE ---
    const tableWrapper = document.createElement('div');
    tableWrapper.className = Theme.table.wrapper;

    const table = document.createElement('table');
    table.className = Theme.table.element;

    const thead = document.createElement('thead');
    thead.className = Theme.table.thead;
    const headerTr = document.createElement('tr');
    thead.appendChild(headerTr);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    tbody.className = Theme.table.tbody;
    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    wrapper.appendChild(tableWrapper);

    // --- 3. RENDERING LOGIC ---
    const renderTable = () => {
        headerTr.innerHTML = "";
        visibleColumns.forEach(colName => {
            const th = document.createElement('th');
            th.className = Theme.table.th;
            // FIX 1: Apply the formatter to the column headers
            // th.innerText = formatColumnLabel(colName);
            th.innerText = colName;
            headerTr.appendChild(th);
        });

        tbody.innerHTML = "";
        if (currentData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${visibleColumns.length || 1}" class="px-6 py-12 text-center text-slate-500 font-medium">No records found matching criteria.</td></tr>`;
            return;
        }

        currentData.forEach(row => {
            const tr = document.createElement('tr');
            tr.className = Theme.table.tr;

            // FIX 2: Make the entire row clickable and add hover styling
            tr.classList.add('cursor-pointer', 'hover:bg-slate-50', 'transition-colors');
            tr.onclick = () => {
                // If a custom selection callback exists (like in AdvancedLookup), use it and stop.
                if (schema.onRowSelect) {
                    schema.onRowSelect(row); // 'row' is the raw JSON object for this record
                    return;
                }

                // Otherwise, default to the standard navigation behavior
                const recordId = row.Id || row.id;
                if (recordId && typeof window.openRecordDetail === 'function') {
                    window.openRecordDetail(schema.dataSource, recordId);
                }
            };

            visibleColumns.forEach(col => {
                const td = document.createElement('td');
                td.className = Theme.table.td;

                const linkCol = schema.linkColumn || 'Id';

                if (col === linkCol || col === 'RECORD ID') {
                    const idVal = row[col] || row['Id'];

                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = Theme.table.link;
                    btn.innerText = idVal;

                    btn.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation(); // Stop the row click from firing again
                        if (typeof schema.onLinkClick === 'function') {
                            schema.onLinkClick(idVal, row);
                        } else if (typeof window.openRecordDetail === 'function') {
                            window.openRecordDetail(schema.dataSource, idVal);
                        }
                    
                    };

                    td.appendChild(btn);
                } else {
                    td.innerText = row[col] !== undefined && row[col] !== null ? row[col] : '-';
                }

                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    };

// --- 4. DATA FETCHING ---
const fetchTableData = async (activeFilters = []) => {
    const colCount = visibleColumns.length || 1;
    tbody.innerHTML = `<tr><td colspan="${colCount}" class="p-0"><div id="table-loader-container"></div></td></tr>`;
    const loaderContainer = tbody.querySelector('#table-loader-container');

    renderLoading(loaderContainer, "Fetching data...");

    try {
        // If schema provides raw data, use it. Otherwise, fetch it.
        if (schema.data) {
            currentData = schema.data;
        } else {
            currentData = await fetchQuery(schema.dataSource, schema.columns, activeFilters);
        }

        renderTable();
    } catch (error) {
        console.error("DataGrid Fetch Error:", error);
        tbody.innerHTML = `<tr><td colspan="${colCount}" class="p-0"><div id="table-error-container"></div></td></tr>`;
        const errorContainer = tbody.querySelector('#table-error-container');
        renderError(errorContainer, "Failed to load data.");
    }
};

// Initial load
setTimeout(() => fetchTableData(schema.filters || []), 0);

return wrapper;
};
