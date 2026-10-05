import { test, expect } from '@playwright/test'
test('Integración real: páginas y cotización mediante proxy hacia Supabase', async ({ page }) => {
  test.skip(process.env.E2E_LIVE !== 'true', 'Se activa explícitamente con backend real disponible.')
  test.setTimeout(90000)
  const errores: string[] = []
  page.on('pageerror', error => errores.push(error.message))
  for (const [ruta, titulo] of [['/productos', 'Catálogo de productos'], ['/stock', 'Inventario'], ['/ventas', 'Historial de ventas'], ['/movimientos', 'Movimientos de mercadería'], ['/desposte', 'Desposte y fraccionamiento'], ['/ofertas', 'Ofertas']]) {
    await page.goto(ruta)
    await expect(page.locator('h1')).toContainText(titulo, { timeout: 20000 })
    await expect(page.getByRole('button', { name: 'API conectada' })).toBeVisible({ timeout: 15000 })
    await expect(page.locator('.operation-loading')).toHaveCount(0, { timeout: 15000 })
    await expect(page.locator('.notice.error')).toHaveCount(0)
  }
  await page.goto('/caja')
  const [respuestaProductos, respuestaPrecios] = await Promise.all([page.request.get('/api/ventas/productos?limite=20'), page.request.get('/api/precios?limite=1000')])
  expect(respuestaProductos.ok()).toBe(true); expect(respuestaPrecios.ok()).toBe(true)
  const productos = (await respuestaProductos.json()).rows as { id: number; codigo: string; stockActual: number }[]
  const precios = await respuestaPrecios.json() as { productoId: number }[]
  const producto = productos.find(p => p.stockActual >= 1 && precios.some(precio => precio.productoId === p.id))
  expect(producto, 'Debe existir un producto con precio y stock para cotizar').toBeTruthy()
  await page.getByRole('button', { name: new RegExp(producto!.codigo) }).click()
  await expect(page.getByRole('button', { name: 'Confirmar venta' })).toBeEnabled({ timeout: 15000 })
  await page.screenshot({ path: 'artifacts/caja-supabase.png', fullPage: true })
  expect(errores).toEqual([])
  // La cotización no persiste ventas ni cambia existencias.
})
