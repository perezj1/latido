// Resolve fulfillment attributes from the trusted catalog, never from the cart.
export function clubVariantAttributes(label:string, optionLabel:string) {
  const parts = label.split(/\s+-\s+|\s*\/\s*/).map(value => value.trim()).filter(Boolean)
  const size = /talla|size/i.test(optionLabel)
    ? parts.find(value => /^(?:[2-5]?XS|S|M|L|[2-5]?XL)$/i.test(value)) || null : null
  const color = /color|talla|size/i.test(optionLabel)
    ? parts.find(value => value !== size && !/impresi[oó]n|DTG/i.test(value)) || null : null
  return { size, color }
}
