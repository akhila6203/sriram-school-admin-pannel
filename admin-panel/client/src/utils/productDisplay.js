import { formatINR } from './format'

/** Effective selling price for a variant (override or product base sale price). */
export function variantSellingPrice(variant, baseSalePrice) {
  if (variant?.priceOverride != null && variant.priceOverride !== '') {
    return Number(variant.priceOverride)
  }
  return Number(baseSalePrice) || 0
}

export function activeVariants(variants = []) {
  return variants.filter((v) => v.isActive !== false)
}

export function totalStockFromVariants(variants = []) {
  return activeVariants(variants).reduce((sum, v) => sum + Number(v.stockQty || 0), 0)
}

export function priceRangeFromVariants(variants = [], baseSalePrice = 0) {
  const prices = activeVariants(variants).map((v) => variantSellingPrice(v, baseSalePrice))
  if (!prices.length) {
    const p = Number(baseSalePrice) || 0
    return { min: p, max: p }
  }
  return { min: Math.min(...prices), max: Math.max(...prices) }
}

/** Table cell: lowest active price, with "onwards" when prices differ. */
export function formatSellingPriceLabel(minPrice, maxPrice) {
  const min = Number(minPrice) || 0
  const max = Number(maxPrice) || min
  if (min === max) return formatINR(min)
  return `${formatINR(min)} onwards`
}
