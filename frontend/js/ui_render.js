// js/ui_render.js
import { LayoutRegistry } from './registry.js';
// Make sure to export InputRegistry from wherever it lives!
import { InputRegistry } from './inputs.js';
import { Theme } from './theme.js';

// Export this so other components (like CardGrid) can access it if needed
export const ComponentRegistry = {
    ...InputRegistry,
    ...LayoutRegistry
};

export function renderComponent(schemaNode) {
    if (!schemaNode || !schemaNode.type) {
        console.warn("Invalid schema node:", schemaNode);
        return document.createTextNode("");
    }

    const builder = ComponentRegistry[schemaNode.type];
    if (!builder) {
        console.warn(`[UI Engine] Unknown component type requested: ${schemaNode.type}`);
        const fallback = document.createElement('div');
        fallback.className = Theme.error.fallbackNode || "text-red-500 font-bold p-4";
        fallback.innerText = `Unsupported Component: ${schemaNode.type}`;
        return fallback;
    }

    return builder(schemaNode, renderComponent);
}

export function loadUISchema(jsonSchema) {
    console.log("[UI Engine] Rendering new UI Schema...");
    const root = document.getElementById('app-root');
    root.innerHTML = "";

    const uiDOM = renderComponent(jsonSchema);

    // // Safety check for theme animation string
    if (Theme.animation && Theme.animation.fadeIn) {
        uiDOM.classList.add(...Theme.animation.fadeIn.split(' '));
    }

    // FIX: Ensure uiDOM actually has a classList before calling add()
    // if (Theme.animation && Theme.animation.fadeIn && uiDOM.classList) {
    //     uiDOM.classList.add(...Theme.animation.fadeIn.split(' '));
    // }

    root.appendChild(uiDOM);
}
