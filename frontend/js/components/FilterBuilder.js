// js/components/FilterBuilder.js
import { Theme } from '../theme.js';
import { URLState } from '../helper.js';

export const FilterBuilder = (schema, onApplyFilters) => {
    const wrapper = document.createElement('div');
    wrapper.className = "flex flex-col gap-3 w-full mb-2";

    const currentState = URLState.get();
    let activeFilters = currentState.filters.length > 0 ? currentState.filters : (schema.filters || []);
    const config = schema.filterConfig || { allowedFields: [] };

    // --- TOP ROW: Tokens & Toggle Button ---
    const topRow = document.createElement('div');
    topRow.className = "flex items-center flex-wrap gap-2";

    const tokensContainer = document.createElement('div');
    tokensContainer.className = "flex flex-wrap gap-2 empty:hidden";

    const toggleBtn = document.createElement('button');
    toggleBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg> Add Filter`;
    toggleBtn.className = "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 rounded-lg transition-colors border border-slate-200 border-dashed";

    topRow.append(tokensContainer, toggleBtn);

    // --- BUILDER CONTAINER (Hidden by default) ---
    const builderContainer = document.createElement('div');
builderContainer.className = "hidden items-center gap-3 p-2 bg-slate-50 border border-slate-200 rounded-xl shadow-sm animate-fade-in";

// Toggle logic
toggleBtn.onclick = () => {
    builderContainer.classList.toggle('hidden');
    builderContainer.classList.toggle('flex');
};

// 1. Field Selector
const fieldSelect = document.createElement('select');
fieldSelect.className = Theme.input.toolbarSelect;
fieldSelect.innerHTML = `<option value="">-- Select Field --</option>` +
    config.allowedFields.map(f => `<option value="${f.name}">${f.label}</option>`).join("");

// 2. Dynamic Operator Selector
const operatorSelect = document.createElement('select');
operatorSelect.className = `${Theme.input.toolbarSelect} hidden`;

// 3. Dynamic Value Input
const valueInputContainer = document.createElement('div');
valueInputContainer.className = "hidden flex-1";

const applyBtn = document.createElement('button');
applyBtn.innerText = "Apply";
applyBtn.className = `${Theme.button.secondary} hidden`;

const cancelBtn = document.createElement('button');
cancelBtn.innerText = "Cancel";
cancelBtn.className = "px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors";

cancelBtn.onclick = () => {
    builderContainer.classList.add('hidden');
    builderContainer.classList.remove('flex');
    fieldSelect.value = "";
    fieldSelect.dispatchEvent(new Event('change'));
};

// Handle field selection
fieldSelect.onchange = (e) => {
    const fieldDef = config.allowedFields.find(f => f.name === e.target.value);
    if (!fieldDef) {
        operatorSelect.className = `${Theme.input.toolbarSelect} hidden`;
        valueInputContainer.className = "hidden";
        applyBtn.className = `${Theme.button.secondary} hidden`;
        return;
    }

    operatorSelect.innerHTML = fieldDef.operators.map(op => `<option value="${op}">${op}</option>`).join("");
    operatorSelect.className = Theme.input.toolbarSelect;

    valueInputContainer.innerHTML = "";
    valueInputContainer.className = "flex-1 min-w-[150px]";

    let inputEl;
    if (fieldDef.type === "SelectInput" && fieldDef.options) {
        inputEl = document.createElement('select');
        inputEl.className = Theme.input.toolbarSelect + " w-full";
        inputEl.innerHTML = fieldDef.options.map(opt => `<option value="${opt}">${opt}</option>`).join("");
    } else if (fieldDef.type === "DateInput") {
        inputEl = document.createElement('input');
        inputEl.type = "date";
        inputEl.className = Theme.input.toolbarSelect + " w-full";
    } else {
        inputEl = document.createElement('input');
        inputEl.type = fieldDef.type === "NumberInput" ? "number" : "text";
        inputEl.placeholder = "Enter value...";
        inputEl.className = Theme.input.toolbarSelect + " w-full";
    }

    inputEl.id = "filter-value-input";
    valueInputContainer.appendChild(inputEl);
    applyBtn.className = Theme.button.secondary;
};

// Apply Filter Logic
applyBtn.onclick = () => {
    const fieldName = fieldSelect.value;
    const operator = operatorSelect.value;
    const inputEl = document.getElementById('filter-value-input');
    let value = inputEl.value;

    if (!fieldName || !value) return;

    if (operator === 'IN') value = value.split(',').map(s => s.trim());
    else if (operator === 'LIKE') value = `%${value}%`;
    else if (inputEl.type === 'number') value = Number(value);

    activeFilters.push({ field: fieldName, operator, value });

    currentState.filters = activeFilters;
    URLState.set(currentState);

    // Reset and Collapse Builder
    fieldSelect.value = "";
    fieldSelect.dispatchEvent(new Event('change'));
    builderContainer.classList.add('hidden');
    builderContainer.classList.remove('flex');

    renderTokens();
    onApplyFilters(activeFilters);
};

// Render visual tokens
const renderTokens = () => {
    tokensContainer.innerHTML = "";
    activeFilters.forEach((filter, index) => {
        const token = document.createElement('span');
        token.className = "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold shadow-sm transition-all hover:bg-indigo-100";

        let displayVal = filter.value;
        if (filter.operator === 'LIKE') displayVal = displayVal.replace(/%/g, "");
        else if (Array.isArray(filter.value)) displayVal = filter.value.join(', ');

        token.innerHTML = `
            <span class="text-indigo-900">${filter.field}</span>
            <span class="text-indigo-400 font-mono">${filter.operator}</span>
            <span>${displayVal}</span>
        `;

        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '&times;';
        removeBtn.className = "ml-1 text-indigo-400 hover:text-indigo-700 font-bold text-sm w-4 h-4 flex items-center justify-center rounded-full hover:bg-indigo-200 transition-colors";
        removeBtn.onclick = () => {
            activeFilters.splice(index, 1);
            currentState.filters = activeFilters;
            URLState.set(currentState);
            renderTokens();
            onApplyFilters(activeFilters);
        };

        token.appendChild(removeBtn);
        tokensContainer.appendChild(token);
    });
};

builderContainer.append(fieldSelect, operatorSelect, valueInputContainer, applyBtn, cancelBtn);
wrapper.append(topRow, builderContainer);

renderTokens();
setTimeout(() => onApplyFilters(activeFilters), 0);

return wrapper;
};
