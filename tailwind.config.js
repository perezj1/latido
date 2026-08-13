/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Poppins', 'system-ui', 'sans-serif'] },
      colors: {
        surface: {
          DEFAULT:'var(--latido-color-surface)',
          canvas:'var(--latido-color-surface-canvas)',
          subtle:'var(--latido-color-surface-subtle)',
          elevated:'var(--latido-color-surface-elevated)',
          inverse:'var(--latido-color-surface-inverse)',
        },
        border: {
          DEFAULT:'var(--latido-color-border)',
          subtle:'var(--latido-color-border-subtle)',
          strong:'var(--latido-color-border-strong)',
        },
        content: {
          primary:'var(--latido-color-text-primary)',
          secondary:'var(--latido-color-text-secondary)',
          muted:'var(--latido-color-text-muted)',
          inverse:'var(--latido-color-text-inverse)',
        },
        accent: {
          DEFAULT:'var(--latido-color-accent)',
          hover:'var(--latido-color-accent-hover)',
          strong:'var(--latido-color-accent-strong)',
          subtle:'var(--latido-color-accent-subtle)',
          border:'var(--latido-color-accent-border)',
        },
        success: {
          DEFAULT:'var(--latido-color-success)',
          subtle:'var(--latido-color-success-subtle)',
          border:'var(--latido-color-success-border)',
        },
        warning: {
          DEFAULT:'var(--latido-color-warning)',
          subtle:'var(--latido-color-warning-subtle)',
          border:'var(--latido-color-warning-border)',
        },
        danger: {
          DEFAULT:'var(--latido-color-danger)',
          subtle:'var(--latido-color-danger-subtle)',
          border:'var(--latido-color-danger-border)',
        },
        focus:'var(--latido-color-focus)',
        // Deprecated compatibility aliases. Remove after the screen-by-screen
        // migration to semantic utilities is complete.
        brand: {
          50:'var(--latido-color-accent-subtle)',
          100:'var(--latido-color-brand-100)',
          200:'var(--latido-color-accent-border)',
          500:'var(--latido-color-brand-500)',
          600:'var(--latido-color-accent)',
          700:'var(--latido-color-accent-strong)',
          800:'var(--latido-color-brand-800)',
          900:'var(--latido-color-brand-900)',
        },
        category: {
          vivienda:{ surface:'var(--latido-color-category-vivienda-surface)', text:'var(--latido-color-category-vivienda-text)' },
          cuidados:{ surface:'var(--latido-color-category-cuidados-surface)', text:'var(--latido-color-category-cuidados-text)' },
          documentos:{ surface:'var(--latido-color-category-documentos-surface)', text:'var(--latido-color-category-documentos-text)' },
          venta:{ surface:'var(--latido-color-category-venta-surface)', text:'var(--latido-color-category-venta-text)' },
          servicios:{ surface:'var(--latido-color-category-servicios-surface)', text:'var(--latido-color-category-servicios-text)' },
          regalo:{ surface:'var(--latido-color-category-regalo-surface)', text:'var(--latido-color-category-regalo-text)' },
        },
        bg:'var(--latido-color-surface-canvas)',
      },
      spacing: {
        'latido-0':'var(--latido-space-0)',
        'latido-1':'var(--latido-space-1)',
        'latido-2':'var(--latido-space-2)',
        'latido-3':'var(--latido-space-3)',
        'latido-4':'var(--latido-space-4)',
        'latido-5':'var(--latido-space-5)',
        'latido-6':'var(--latido-space-6)',
        'latido-8':'var(--latido-space-8)',
        'latido-10':'var(--latido-space-10)',
        'latido-12':'var(--latido-space-12)',
        'latido-16':'var(--latido-space-16)',
      },
      borderRadius: {
        'latido-sm':'var(--latido-radius-sm)',
        'latido-md':'var(--latido-radius-md)',
        'latido-lg':'var(--latido-radius-lg)',
      },
      boxShadow: {
        'latido-sm':'var(--latido-shadow-sm)',
        'latido-md':'var(--latido-shadow-md)',
        'latido-lg':'var(--latido-shadow-lg)',
      },
      fontSize: {
        'latido-caption':['var(--latido-font-size-caption)', { lineHeight:'var(--latido-line-height-body)' }],
        'latido-body':['var(--latido-font-size-body)', { lineHeight:'var(--latido-line-height-body)' }],
        'latido-subtitle':['var(--latido-font-size-subtitle)', { lineHeight:'var(--latido-line-height-title)' }],
        'latido-title':['var(--latido-font-size-title)', { lineHeight:'var(--latido-line-height-title)' }],
        'latido-display':['var(--latido-font-size-display)', { lineHeight:'var(--latido-line-height-title)' }],
      },
    },
  },
  plugins: [],
}
