// import { renderComponent } from '../registry.js';
import { Theme } from '../theme.js';

export const Container = (schema, renderComponent) => {
    const container = document.createElement('div');
    container.className = schema.layout === 'vertical'
        ? Theme.dashboard.containerVertical
        : Theme.dashboard.containerHorizontal;

    if (schema.children) {
        schema.children.forEach(child => container.appendChild(renderComponent(child)));
    }
    return container;
};
