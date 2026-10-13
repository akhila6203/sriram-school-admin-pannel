import api from './client'

export async function getInventoryReport(params) {
  const { data } = await api.get(
    '/admin/inventory/sales-report',
    { params }
  )

  return data.data
}

export async function adjustInventoryStock(
  variantId,
  quantity,
  note
) {
  const { data } = await api.post(
    `/admin/inventory/${variantId}/adjust`,
    {
      mode: 'set',
      quantity: Number(quantity),
      note: note.trim(),
    }
  )

  return data.data
}

export async function downloadInventoryReport(params) {
  const response = await api.get(
    '/admin/inventory/sales-report/download',
    {
      params,
      responseType: 'blob',
    }
  )

  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download =
    `inventory-${params.period}-${params.year}.xlsx`

  document.body.appendChild(link)
  link.click()
  link.remove()

  setTimeout(() => URL.revokeObjectURL(url), 1000)
}