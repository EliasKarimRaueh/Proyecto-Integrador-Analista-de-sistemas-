import { test, expect, type Page } from '@playwright/test'
const productos = [
  { id: 1, codigo: 'POL-001', nombre: 'Pollo entero', unidadVenta: 'KILOS', stockActual: 20, stockMinimo: 5, margenStock: 0, estado: 'Normal' },
  { id: 2, codigo: 'SUP-001', nombre: 'Suprema', unidadVenta: 'KILOS', stockActual: 3, stockMinimo: 5, margenStock: 0, estado: 'Crítico' },
  { id: 3, codigo: 'HAMB-001', nombre: 'Hamburguesa', unidadVenta: 'UNIDADES', stockActual: 6, stockMinimo: 5, margenStock: 0, estado: 'Próximo al Mínimo' },
]
async function apiSimulada(page: Page) {
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), body = request.postDataJSON()
    const precios = productos.map(p => ({ id: String(p.id), productoId: p.id, precioMinorista: '4500.00', precioMayorista: '3900.00', activo: true, vigente: true, fechaDesde: '2026-01-01', fechaHasta: null }))
    let response: unknown = []
    if (url.pathname.endsWith('/health')) response = { status: 'ok' }
    else if (url.pathname === '/api/stock') response = productos
    else if (url.pathname === '/api/precios') response = precios
    else if (url.pathname === '/api/ofertas') response = [{ id: '10', nombre: 'Combo familiar', vigente: true, activo: true, descripcion: 'Pollo y cortes frescos' }]
    else if (url.pathname === '/api/ventas/productos') response = { rows: productos, count: productos.length }
    else if (url.pathname === '/api/productos') response = productos.map(p => ({ id: String(p.id), code: p.codigo, name: p.nombre, unit: p.unidadVenta === 'KILOS' ? 'kg' : 'unidad', category: 'Fresco', active: true, description: '' }))
    else if (url.pathname === '/api/stock/fraccionamientos') response = { operacionId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', movimientos: [], merma: body.merma }
    else if (url.pathname === '/api/stock/movimientos') response = request.method() === 'POST' ? { id: 1, cantFinal: 19 } : { rows: [], count: 0 }
    else if (url.pathname === '/api/ventas/cotizacion' || (url.pathname === '/api/ventas' && request.method() === 'POST')) {
      const detalles = body.detalles.map((d: { productoId?: number; cantidad: number; tipoPrecio: string }) => ({ ...d, nombre: productos.find(p => p.id === d.productoId)?.nombre ?? 'Combo familiar', importeUnitario: '4500.00', subtotal: (d.cantidad * 4500).toFixed(2) }))
      const total = detalles.reduce((sum: number, d: { subtotal: string }) => sum + Number(d.subtotal), 0).toFixed(2)
      response = url.pathname.includes('cotizacion') ? { total, detalles } : { venta: { id: 123, total, fechaHora: '2026-10-04T15:00:00Z' }, detalles }
    } else if (url.pathname === '/api/ventas') response = { rows: [], count: 0 }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) })
  })
}
test.beforeEach(async ({ page }) => apiSimulada(page))
test('Caja en escritorio: kilos, cotización y confirmación sin duplicar', async ({ page }) => {
  await page.goto('/caja')
  await page.getByRole('button', { name: /POL-001/ }).click()
  await page.getByLabel('Cantidad de Pollo entero').fill('1,25')
  await expect(page.getByRole('button', { name: 'Confirmar venta' })).toBeEnabled()
  await page.screenshot({ path: 'artifacts/caja-desktop.png', fullPage: true })
  await page.getByRole('button', { name: 'Confirmar venta' }).click()
  const request = page.waitForRequest(r => r.url().endsWith('/api/ventas') && r.method() === 'POST')
  await page.getByRole('button', { name: 'Registrar venta' }).click()
  expect((await request).postDataJSON().detalles[0].cantidad).toBe(1.25)
  await expect(page.getByText('Venta #123 registrada. El stock ya está actualizado.')).toBeVisible()
  await page.getByRole('button', { name: 'Nueva venta' }).click()
  await expect(page.getByRole('button', { name: 'Confirmar venta' })).toBeDisabled()
})
test('Inventario: baja por vencimiento y alertas', async ({ page }) => {
  await page.goto('/stock')
  await expect(page.getByText('Pollo entero', { exact: true })).toBeVisible()
  await page.screenshot({ path: 'artifacts/stock-desktop.png', fullPage: true })
  await page.getByRole('row').filter({ hasText: 'Pollo entero' }).getByRole('button', { name: 'Registrar movimiento' }).click()
  await page.getByLabel('Tipo de movimiento').selectOption('VENCIMIENTO')
  await page.getByLabel('Cantidad (kg)').fill('1')
  await page.getByLabel('Motivo obligatorio').fill('Control de fecha del lote')
  const request = page.waitForRequest(r => r.url().endsWith('/stock/movimientos') && r.method() === 'POST')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  expect((await request).postDataJSON().tipo).toBe('VENCIMIENTO')
  await expect(page.getByText('Movimiento registrado y stock actualizado.')).toBeVisible()
})
test('Desposte: balance y confirmación', async ({ page }) => {
  await page.goto('/desposte')
  await page.getByRole('combobox', { name: 'Producto', exact: true }).selectOption('1')
  await page.getByLabel('Kilos a fraccionar').fill('10')
  await page.getByRole('combobox', { name: 'Derivado 1', exact: true }).selectOption('2')
  await page.getByLabel('Kilos del derivado 1').fill('9,5')
  await page.getByLabel('Merma (kg)').fill('0,5')
  await page.getByLabel('Motivo obligatorio').fill('Desposte del día')
  await page.screenshot({ path: 'artifacts/desposte-desktop.png', fullPage: true })
  await page.getByRole('button', { name: 'Revisar y registrar' }).click()
  await page.getByRole('button', { name: 'Confirmar desposte' }).click()
  await expect(page.getByText('Desposte registrado y existencias actualizadas.')).toBeVisible()
})
test('Caja en móvil permite vender sin desbordar la página', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/caja')
  await page.getByRole('button', { name: /POL-001/ }).click()
  await expect(page.getByRole('button', { name: 'Confirmar venta' })).toBeEnabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: 'artifacts/caja-mobile.png', fullPage: true })
})
