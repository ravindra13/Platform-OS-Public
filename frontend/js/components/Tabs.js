// js/components/Tabs.js
import { Theme } from '../theme.js';

export const Tabs = (schema, renderChild) => {
    const wrapper = document.createElement('div');
    wrapper.className = "w-full flex flex-col";

    const navBar = document.createElement('div');
    navBar.className = Theme.tabs.navBar;

    const contentContainer = document.createElement('div');
    contentContainer.className = "w-full";

    let activeIndex = 0;
    const tabButtons = [];
    const tabContents = [];

    schema.tabs.forEach((tabDef, index) => {
        const btn = document.createElement('button');
        btn.className = index === activeIndex ? Theme.tabs.activeBtn : Theme.tabs.inactiveBtn;
        btn.innerText = tabDef.label;

        const contentDiv = document.createElement('div');
        contentDiv.className = index === activeIndex ? Theme.tabs.activeContent : Theme.tabs.inactiveContent;

        // NEW: Check if content is an array (multiple components) or a single object
        if (Array.isArray(tabDef.content)) {
            tabDef.content.forEach(childNode => {
                contentDiv.appendChild(renderChild(childNode));
            });
        } else if (tabDef.content) {
            contentDiv.appendChild(renderChild(tabDef.content));
        }
    tabButtons.push(btn);
    tabContents.push(contentDiv);

    btn.onclick = () => {
        tabButtons.forEach(b => b.className = Theme.tabs.inactiveBtn);
        tabContents.forEach(c => c.className = Theme.tabs.inactiveContent);
        btn.className = Theme.tabs.activeBtn;
        contentDiv.className = Theme.tabs.activeContent;
    };

    navBar.appendChild(btn);
    contentContainer.appendChild(contentDiv);
});

wrapper.appendChild(navBar);
wrapper.appendChild(contentContainer);
return wrapper;
};
