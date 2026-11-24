// frontend/js/tailwind-config.js
tailwind.config = {
    theme: {
        extend: {
            colors: {
                brand: {
                    primary: 'rgb(var(--color-brand-primary) / <alpha-value>)',
                    secondary: 'rgb(var(--color-brand-secondary) / <alpha-value>)',
                },
                surface: {
                    base: 'rgb(var(--color-surface-base) / <alpha-value>)',
                    panel: 'rgb(var(--color-surface-panel) / <alpha-value>)',
                },
                text: {
                    main: 'rgb(var(--color-text-main) / <alpha-value>)',
                    muted: 'rgb(var(--color-text-muted) / <alpha-value>)',
                },
                state: {
                    success: 'rgb(var(--color-state-success) / <alpha-value>)',
                    error: 'rgb(var(--color-state-error) / <alpha-value>)',
                }
            }
        }
    }
};
