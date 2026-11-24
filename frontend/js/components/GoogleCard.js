// import { renderComponent } from '../registry.js';
import { Theme } from '../theme.js';

export const GoogleCard = (schema, renderComponent) => {
    const card = document.createElement('div');
    card.className = Theme.card.wrapper;

    if (schema.title) {
        const header = document.createElement('h2');
        header.className = Theme.card.header;
        header.innerHTML = `<div class="${Theme.card.accent}"></div> ${schema.title}`;
        card.appendChild(header);
    }

    if (schema.children) {
        schema.children.forEach(childNode => card.appendChild(renderComponent(childNode)));
    }
    return card;
};
