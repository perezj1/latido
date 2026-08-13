const token = name => `var(--latido-${name})`

// Compatibility facade for the existing presentation layer. New styles should
// use semantic CSS/Tailwind tokens directly; these aliases let legacy inline
// styles inherit the same source of truth while screens are migrated gradually.
export const C = Object.freeze({
  bg:token('color-surface-canvas'),
  surface:token('color-surface'),
  bgAlt:token('color-surface-subtle'),
  primary:token('color-accent'),
  primaryDark:token('color-accent-strong'),
  primaryLight:token('color-accent-subtle'),
  primaryMid:token('color-accent-border'),
  success:token('color-success'),
  successLight:token('color-success-subtle'),
  successMid:token('color-success-border'),
  warn:token('color-warning'),
  warnLight:token('color-warning-subtle'),
  warnMid:token('color-warning-border'),
  danger:token('color-danger'),
  dangerLight:token('color-danger-subtle'),
  text:token('color-text-primary'),
  mid:token('color-text-secondary'),
  light:token('color-text-muted'),
  border:token('color-border'),
  borderLight:token('color-border-subtle'),
})

export const SPACE = Object.freeze({
  0:token('space-0'),
  1:token('space-1'),
  2:token('space-2'),
  3:token('space-3'),
  4:token('space-4'),
  5:token('space-5'),
  6:token('space-6'),
  8:token('space-8'),
  10:token('space-10'),
  12:token('space-12'),
  16:token('space-16'),
})

export const RADIUS = Object.freeze({
  sm:token('radius-sm'),
  md:token('radius-md'),
  lg:token('radius-lg'),
  full:token('radius-full'),
})

export const SHADOW = Object.freeze({
  sm:token('shadow-sm'),
  md:token('shadow-md'),
  lg:token('shadow-lg'),
})

export const TYPE = Object.freeze({
  display:token('font-size-display'),
  title:token('font-size-title'),
  subtitle:token('font-size-subtitle'),
  body:token('font-size-body'),
  caption:token('font-size-caption'),
})
export const CAT_COLORS = {
  vivienda:   { bg:token('color-category-vivienda-surface'), tc:token('color-category-vivienda-text') },
  cuidados:   { bg:token('color-category-cuidados-surface'), tc:token('color-category-cuidados-text') },
  documentos: { bg:token('color-category-documentos-surface'), tc:token('color-category-documentos-text') },
  venta:      { bg:token('color-category-venta-surface'), tc:token('color-category-venta-text') },
  servicios:  { bg:token('color-category-servicios-surface'), tc:token('color-category-servicios-text') },
  regalo:     { bg:token('color-category-regalo-surface'), tc:token('color-category-regalo-text') },
}
export const PP = "'Poppins', system-ui, sans-serif"
