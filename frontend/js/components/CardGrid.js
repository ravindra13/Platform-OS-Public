// js/components/CardGrid.js
import { fetchQuery, fetchBlueprint } from '../services/api.js';
import { renderLoading, renderError } from '../utils/ui.js';
import { Theme } from '../theme.js';
import { FilterBuilder } from './FilterBuilder.js'; // <-- NEW IMPORT

export const CardGrid = (schema) => {
  const wrapper = document.createElement('div');
  wrapper.className = "flex flex-col gap-6 w-full";

  let currentData = [];

  // --- 1. MOUNT ADVANCED FILTER BUILDER ---
  const filterComponent = FilterBuilder(schema, (newFilters) => {
    fetchTableData(newFilters);
  });
  wrapper.appendChild(filterComponent);

  // CHANGED: Use flex-col to stack cards horizontally (full width)
  const cardContainer = document.createElement('div');
  cardContainer.className = "flex flex-col gap-4 w-full";
  wrapper.appendChild(cardContainer);

  // --- 3. HORIZONTAL CARD RENDERING LOGIC ---
  const renderCards = () => {
    cardContainer.innerHTML = "";
    if (currentData.length === 0) {
      cardContainer.innerHTML = `<div class="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200">No records found.</div>`;
      return;
    }
// Filter out 'Id' from the main loop and grab exactly 4 fields
const displayColumns = schema.columns.filter(c => c !== 'Id' && c !== 'RECORD ID').slice(0, 4);

currentData.forEach(row => {
  const card = document.createElement('div');
  // CHANGED: Horizontal layout classes (flex-row on md+ screens)
  card.className = "bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col md:flex-row md:items-center gap-6 w-full";
  card.onclick = () => {
    const idVal = row['Id'] || row['RECORD ID'];
    if (typeof openRecordDetail === 'function' && idVal) openRecordDetail(schema.dataSource, idVal);
  };

  // Fixed-width ID section on the left
  const idSection = document.createElement('div');
  idSection.className = "flex-shrink-0 md:w-48 border-b md:border-b-0 md:border-r border-slate-100 pb-3 md:pb-0 md:pr-6";
  const rowId = row['Id'] || row['RECORD ID'] || 'Unknown';
  idSection.innerHTML = `
    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Record ID</span>
    <div class="text-sm font-bold text-indigo-600 group-hover:text-indigo-700 truncate"># ${rowId}</div>
  `;
  card.appendChild(idSection);

  // Horizontal grid for the 4 fields
  const fieldsSection = document.createElement('div');
  fieldsSection.className = "flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4";

  displayColumns.forEach(col => {
    const value = row[col];
    const displayValue = (value && typeof value === 'object') ? (value.Name || value.Id) : (value !== undefined && value !== null ? value : '-');
    const fieldDiv = document.createElement('div');
    fieldDiv.innerHTML = `
        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1 truncate">${col}</span>
        <span class="text-sm text-slate-800 font-semibold truncate block" title="${displayValue}">${displayValue}</span>
    `;
    fieldsSection.appendChild(fieldDiv);
});
card.appendChild(fieldsSection);

// Action arrow on the far right
const actionSection = document.createElement('div');
actionSection.className = "flex-shrink-0 hidden md:flex items-center justify-end pl-4";
actionSection.innerHTML = `<svg class="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>`;
card.appendChild(actionSection);

cardContainer.appendChild(card);
});
};

// --- 4. FETCH DATA ---
const fetchTableData = async (activeFilters = []) => {
    renderLoading(cardContainer, "Fetching records...");
    try {
        // Centralized query execution
        currentData = await fetchQuery(schema.dataSource, schema.columns, activeFilters);
        renderCards();
    } catch (error) {
        renderError(cardContainer, "Failed to load data.");
    }
}
// Initial load
fetchTableData(schema.filters || []);

return wrapper;
};

