// js/components/CardGrid.js
import { fetchQuery, fetchBlueprint } from '../services/api.js';
import { renderLoading, renderError } from '../utils/ui.js';
import { Theme } from '../theme.js';
import { FilterBuilder } from './FilterBuilder.js';

export const CardGrid = (schema) => {
  const wrapper = document.createElement('div');
  // Tightened main gap to match enterprise density
  wrapper.className = "flex flex-col gap-4 w-full";

  let currentData = [];

  // --- 1. MOUNT ADVANCED FILTER BUILDER ---
  const filterComponent = FilterBuilder(schema, (newFilters) => {
    fetchTableData(newFilters);
  });
  wrapper.appendChild(filterComponent);

  // CHANGED: Tighter gap between rows
  const cardContainer = document.createElement('div');
  cardContainer.className = "flex flex-col gap-2.5 w-full";
  wrapper.appendChild(cardContainer);

  // --- 3. HORIZONTAL CARD RENDERING LOGIC ---
  const renderCards = () => {
    cardContainer.innerHTML = "";
    if (currentData.length === 0) {
      cardContainer.innerHTML = `<div class="p-8 text-center text-sm font-medium text-slate-500 bg-white rounded-lg border border-slate-200">No records found.</div>`;
      return;
    }
    
    // Filter out 'Id' from the main loop and grab exactly 4 fields
    const displayColumns = schema.columns.filter(c => c !== 'Id' && c !== 'RECORD ID').slice(0, 4);

    currentData.forEach(row => {
      const card = document.createElement('div');
      // CHANGED: Flat, bordered enterprise rows (rounded-lg instead of rounded-xl, tighter padding)
      card.className = "bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow transition-all cursor-pointer group flex flex-col md:flex-row md:items-center gap-5 w-full";
      card.onclick = () => {
        const idVal = row['Id'] || row['RECORD ID'];
        if (typeof openRecordDetail === 'function' && idVal) openRecordDetail(schema.dataSource, idVal);
      };

      // Fixed-width ID section on the left
      const idSection = document.createElement('div');
      idSection.className = "flex-shrink-0 md:w-40 border-b md:border-b-0 md:border-r border-slate-200 pb-2 md:pb-0 md:pr-5";
      const rowId = row['Id'] || row['RECORD ID'] || 'Unknown';
      idSection.innerHTML = `
        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Record ID</span>
        <div class="text-sm font-bold text-emerald-600 group-hover:text-emerald-700 truncate"># ${rowId}</div>
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
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5 truncate">${col}</span>
            <span class="text-sm text-slate-700 font-medium truncate block" title="${displayValue}">${displayValue}</span>
        `;
        fieldsSection.appendChild(fieldDiv);
      });
      card.appendChild(fieldsSection);

      // Action arrow on the far right (Updated to Emerald)
      const actionSection = document.createElement('div');
      actionSection.className = "flex-shrink-0 hidden md:flex items-center justify-end pl-3";
      actionSection.innerHTML = `<svg class="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-all transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" /></svg>`;
      card.appendChild(actionSection);

      cardContainer.appendChild(card);
    });
  };

  // --- 4. FETCH DATA ---
  const fetchTableData = async (activeFilters = []) => {
      renderLoading(cardContainer, "Fetching records...");
      try {
          currentData = await fetchQuery(schema.dataSource, schema.columns, activeFilters);
          renderCards();
      } catch (error) {
          renderError(cardContainer, "Failed to load data.");
      }
  }
  
  fetchTableData(schema.filters || []);

  return wrapper;
};