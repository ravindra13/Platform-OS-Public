// import { renderComponent } from './registry.js';
import { Theme } from '../theme.js';

export const PageLayout = (schema, renderComponent) => {
    const container = document.createElement('div');
    // Ensure Theme is imported or passed down if used. Assuming it's globally available for now.
    container.className = Theme.layout.pageContainer;

    if (schema.children) {
        schema.children.forEach(childNode => container.appendChild(renderComponent(childNode)));
    }
    return container;
};
