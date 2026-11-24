// import { renderComponent } from '../registry.js';
import { Theme } from '../theme.js';

export const Grid = (schema, renderComponent) => {
    const grid = document.createElement('div');
    grid.className = `${Theme.dashboard.gridBase} lg:grid-cols-${schema.columns || 1}`;

    if (schema.children) {
        schema.children.forEach(child => {
            const childNode = renderComponent(child);
            if (child.span) childNode.classList.add(`lg:col-span-${child.span}`);
            grid.appendChild(childNode);
        });
    }
    return grid;
};
