import { Theme } from '../theme.js';
import { fetchRecordData, executeAction } from '../services/api.js';

export const Form = (schema, renderChild) => {
    console.log("3. FORM SCHEMA:", schema);
    // --- 1. COMPONENT-LEVEL HYDRATION ---
    if (schema.recordId && schema.recordId !== "{RECORD_ID}" && schema.recordId !== "NEW" && !schema.recordData) {
        const loadingWrapper = document.createElement('div');
        loadingWrapper.className = Theme.form.wrapper;
        loadingWrapper.innerHTML = '<div class="flex justify-center p-10"><svg class="animate-spin h-6 w-6 text-indigo-500" xmlns="http://w3.org" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle></svg></div>';

        setTimeout(async () => {
            try {
                const requiredFields = schema.fields.map(f => f.name);
                if (!requiredFields.includes('Id')) requiredFields.push('Id');

                const result = await fetchRecordData(schema.targetObject, requiredFields, schema.recordId);

                schema.recordData = result.data && result.data.length > 0 ? result.data[0] : {};
                schema.displayMode = 'read';

                // Replace the loading spinner with the fully built form
                loadingWrapper.replaceWith(Form(schema, renderChild));
            } catch (error) {
                console.error("Hydration Error:", error);
                loadingWrapper.innerHTML = '<div class="text-rose-500 p-4">Error loading record data.</div>';
            }
        }, 0);

        return loadingWrapper;
    }

    // --- 2. EXISTING FORM RENDERING LOGIC ---
    const form = document.createElement('form');
    form.className = Theme.form.wrapper;
    form.id = `form-${schema.targetObject}`;
    form.noValidate = true;

    const currentMode = schema.displayMode || 'edit';

    // --- NEW: Extract the Object-Level permission at the top of the form ---
    const canUpdateObject = schema.object_permissions ? schema.object_permissions.allow_update : true;

    if (schema.fields) {
        schema.fields.forEach(f => {
            // 1. PRE-FILL & HYDRATION FIX:
            // Use !== undefined so we don't accidentally skip valid '0' or 'false' values
            const isNewRecord = !schema.recordData || !schema.recordData.Id;

            if (isNewRecord && schema.prefill && schema.prefill[f.name] !== undefined) {
                f.value = schema.prefill[f.name];
            } else if (schema.recordData && schema.recordData[f.name] !== undefined) {
                f.value = schema.recordData[f.name];
            }

            // --- ARCHITECTURE PURE: The Ultimate Security Lock ---
            // If they lack Object UPDATE rights, OR they lack Field UPDATE rights, lock it!
            if (!canUpdateObject || f.can_update === false) {
                f.readonly = true;
            }

            // Enforce Read-Only mode visually
            if (currentMode === 'edit' && f.readonly) {
                f.displayMode = 'read';
            } else {
                f.displayMode = currentMode;
            }

            // --- ARCHITECTURE PURE: Disable Inline Editing ---
            // Only attach the click listener if the field is actually editable!
            if (!f.readonly) {
                f.onInlineEdit = () => {
                    schema.displayMode = 'edit';
                    form.replaceWith(Form(schema, renderChild));
                };
            }
        });
    }

    if (schema.fields) {
        const gridContainer = document.createElement('div');
        gridContainer.className = Theme.form.grid;

        schema.fields.forEach(fieldSchema => {
            const isNewRecord = !schema.recordData || !schema.recordData.Id;

            // --- ARCHITECTURE PURE: System Field Lifecycle ---
            if (fieldSchema.is_system) {
                // 1. If it's a brand new record, hide system fields entirely (they have no value yet)
                if (isNewRecord) return;

                // 2. If editing an existing record, force system fields to be readable, but never editable
                fieldSchema.displayMode = 'read';
            }

gridContainer.appendChild(renderChild(fieldSchema));
});
form.appendChild(gridContainer);

}
const actionContainer = document.createElement('div');
actionContainer.className = Theme.form.actionContainer;
// Default to true if the backend doesn't send the flag (backward compatibility)
const canUpdate = schema.object_permissions? schema.object_permissions.allow_update: true;
if (currentMode === 'read') {
// ARCHITECTURE PURE: Only render the Edit button if they have UPDATE rights!
if (canUpdate) {
const editBtn = document.createElement('button');
editBtn.type = "button";
editBtn.className = Theme.button.ghost;
editBtn.innerText = "Edit Record";
editBtn.onclick = (e) => {
e.preventDefault();
schema.displayMode = 'edit';
form.replaceWith (Form(schema, renderChild));
}
actionContainer.appendChild(editBtn);

}
} else {
if (schema.recordData) {
const cancelBtn = document.createElement('button');
cancelBtn.type = "button";
cancelBtn.className = Theme.button.ghost;
cancelBtn.innerText = "Cancel";
cancelBtn.onclick = (e) => {






e.preventDefault();
schema.displayMode = 'read';
form.replaceWith (Form(schema, renderChild));
};
actionContainer.appendChild(cancelBtn);
}
const submitBtn = renderChild({ type: "Button", label: "Save Record" });
submitBtn.type = "submit";
actionContainer.appendChild(submitBtn);
}
form.appendChild(actionContainer);

// NEW: Merge recordData and prefill data so DOM inputs catch both
// const initialData = {...(schema.recordData || {}), ...(schema.prefill || {}) };
const isNewRecord = !schema.recordData || !schema.recordData.Id;
const initialData = isNewRecord
? {...(schema.prefill || {}), ...(schema.recordData || {}) }
: {...(schema.recordData || {}) };
// Ensure the primary Record ID is always included in the payload for updates
if (currentMode === 'edit' && initialData.Id) {
const idInput = document.createElement('input');
idInput.type = 'hidden';
idInput.name = 'Id';
idInput.value = typeof initialData.Id === 'object'? initialData.Id.value: initialData.Id;
form.appendChild(idInput);






}
form.onsubmit = async (e) => {
e.preventDefault();
const submitBtnEl = form.querySelector('button[type="submit"]');
const originalText = submitBtnEl.innerText;
submitBtnEl.innerText = 'Saving...';
submitBtnEl.disabled = true;
try {
const formData = new FormData(form);
const payload = {};
for (let [key, value] of formData.entries()) { if (value) payload[key] = isNaN(value)? value: Number(value);

}
form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
     payload[checkbox.name] = checkbox.checked;
});
// ARCHITECTURE FIX: Capture the API response so we get the new database Id 
const actionResponse = await executeAction (schema.targetObject, payload);
// Extract the returned record (handling both array and direct object responses)
const savedRecord = (actionResponse && actionResponse.data && actionResponse.data[0])
? actionResponse.data[0]
: (actionResponse || {});
// await executeAction(schema.targetObject, payload);
submitBtnEl.className = Theme.button.success;
submitBtnEl.innerText = "✓ Saved";










setTimeout(() => {
// schema.recordData = { ...schema.recordData, ...payload };
schema.recordData = { ...schema.recordData, ...payload, ...savedRecord };
schema.displayMode = 'read';
form.replaceWith (Form(schema, renderChild));
}, 800);
} catch (error) {
console.error(error);
// alert(`Save Failed.`);
submitBtnEl.innerText = originalText;
submitBtnEl.disabled = false;

}
};
return form;
};


