import { test, expect, type Page } from '@playwright/test'

async function simularApi(page: Page) {
  const proveedor = { id: 5, nombre: 'Distribuidora Sur', cuil: '20123456789', telefono: '1145678900', email: null, direccion: 'San Martín 123', diasEntrega: ['Lunes'], ctaCte: true, activo: true }
  const productos = [{ id: '1', code: 'POL-001', name: 'Pollo entero', unit: 'kg', category: 'Fresco', active: true, description: '' }, { id: '2', code: 'SUP-001', name: 'Suprema', unit: 'kg', category: 'Fresco', active: true, description: '' }]
  let saldo = 0, asociados: number[] = [], oferta: Record<string, unknown> | null = null
  const pagos: Record<string, unknown>[] = []
  await page.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method(), b = req.postDataJSON()
    let data: unknown = []
    if (path.endsWith('/health')) data = { status: 'ok' }
    else if (path === '/api/proveedores') data = [proveedor]
    else if (path.endsWith('/5/productos')) {
      if (method === 'PUT') asociados = b.productoIds
      data = asociados.map(productoId => ({ productoId, proveedorId: 5, activo: true }))
    } else if (path.includes('/5/cuenta')) data = { proveedor, saldo: saldo.toFixed(2), credito: '0.00', cuentas: { rows: saldo || pagos.length ? [{ id: 1, compraId: 1, importePendiente: saldo.toFixed(2), estado: saldo ? 'PAGO PARCIAL' : 'PAGADO', compra: { fechaHora: '2026-01-01T15:00:00Z', total: '1500.00', numeroComprobante: 'A-001' } }] : [], count: saldo || pagos.length ? 1 : 0 }, pagos: { rows: pagos, count: pagos.length } }
    else if (path.endsWith('/5/comprobantes')) { saldo += Number(b.total); data = { id: 1 } }
    else if (path.endsWith('/5/pagos')) {
      saldo -= Number(b.importe)
      const pago = { id: pagos.length + 1, fechaHora: '2026-01-02T15:00:00Z', importe: b.importe, importePendiente: '0.00', pagosPorCuenta: [{ cuentaId: 1, importeAplicado: b.importe }] }
      pagos.push(pago); data = { pago, aplicaciones: pago.pagosPorCuenta }
    } else if (path === '/api/productos') data = productos
    else if (path === '/api/precios') data = productos.map(p => ({ productoId: Number(p.id), precioMinorista: '1000.00', precioMayorista: '800.00', activo: true, vigente: true }))
    else if (path === '/api/ofertas' && method === 'POST') {
      oferta = { ...b, id: '10', vigente: true, activo: true, fechaBaja: null, productos: b.productos.map((p: { productoId: number; cantidad: number }) => ({ ...p, nombre: productos.find(i => Number(i.id) === p.productoId)!.name, precioLista: '1000.00', precioOferta: '0.00', unidadVenta: 'KILOS', activo: true })), resumen: { subtotalLista: '2000.00', descuento: '200.00', total: '1800.00' } }; data = oferta
    } else if (path === '/api/ofertas') data = oferta ? [oferta] : [{ id: '10', nombre: 'Combo del día', descripcion: 'Pollo y cortes', vigente: true, activo: true }]
    else if (path === '/api/ofertas/10') data = oferta
    else if (path === '/api/ventas/productos') data = { rows: productos.map(p => ({ id: Number(p.id), codigo: p.code, nombre: p.name, unidadVenta: 'KILOS', stockActual: 20 })), count: 2 }
    await route.fulfill({ status: method === 'POST' ? 201 : 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
}
test.beforeEach(async ({ page }) => simularApi(page))

test('Sprint 3: asociaciones, comprobantes y pago parcial y total', async ({ page }) => {
  await page.goto('/proveedores')
  await page.getByRole('button', { name: 'Productos de Distribuidora Sur' }).click()
  await page.getByRole('checkbox', { name: /Suprema/ }).check()
  await page.getByRole('button', { name: 'Guardar asociaciones' }).click()
  await expect(page.getByText('Productos asociados correctamente.')).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar productos' }).click()
  await page.getByRole('button', { name: 'Cuenta de Distribuidora Sur' }).click()
  await page.getByRole('button', { name: 'Registrar comprobante' }).click()
  await page.getByLabel('Número de comprobante', { exact: true }).fill('A-001')
  await page.getByLabel('Importe', { exact: true }).fill('1500')
  await page.getByRole('button', { name: 'Revisar operación' }).click()
  await page.getByRole('button', { name: 'Confirmar registro' }).click()
  await expect(page.getByText('Comprobante #1 registrado correctamente.')).toBeVisible()
  await page.getByRole('button', { name: 'Registrar pago' }).click()
  await page.getByLabel('Importe', { exact: true }).fill('500')
  await page.getByRole('button', { name: 'Revisar operación' }).click()
  await page.getByRole('button', { name: 'Confirmar registro' }).click()
  await expect(page.getByText('Pago #1 registrado correctamente.')).toBeVisible()
  await expect(page.locator('.cuenta-resumen')).toContainText('1.000,00')
  await page.screenshot({ path: 'artifacts/cuenta-proveedor-desktop.png', fullPage: true })
  await page.getByRole('button', { name: 'Registrar pago' }).click()
  await page.getByRole('button', { name: 'Pagar saldo total' }).click()
  await page.getByRole('button', { name: 'Revisar operación' }).click()
  await page.getByRole('button', { name: 'Confirmar registro' }).click()
  await expect(page.getByText('Pago #2 registrado correctamente.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Registrar pago' })).toBeDisabled()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Pagos realizados' }).click()
  await page.screenshot({ path: 'artifacts/cuenta-proveedor-mobile.png', fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('Sprint 3: oferta con descuento conjunto y tarjetas compactas en caja', async ({ page }) => {
  await page.goto('/ofertas')
  await page.getByRole('button', { name: 'Nueva oferta' }).click()
  await page.getByLabel('Nombre de la oferta *', { exact: true }).fill('Combo familiar')
  await page.getByRole('button', { name: 'Agregar Pollo entero' }).click()
  await page.getByRole('button', { name: 'Agregar Suprema' }).click()
  await page.getByLabel('Descuento sobre el subtotal (%)', { exact: true }).fill('10')
  await expect(page.getByRole('dialog')).toContainText('1.800,00')
  await page.screenshot({ path: 'artifacts/oferta-descuento-global.png', fullPage: true })
  await page.getByRole('button', { name: 'Registrar oferta' }).click()
  await expect(page.getByRole('button', { name: 'Combo familiar', exact: true })).toBeVisible()
  await page.goto('/caja')
  const tarjeta = page.getByRole('button', { name: /Pollo entero/ })
  await expect(tarjeta).not.toContainText('POL-001')
  await expect(tarjeta).not.toContainText('Stock:')
  expect((await tarjeta.boundingBox())!.height).toBeLessThan(140)
  await page.screenshot({ path: 'artifacts/caja-compacta.png', fullPage: true })
  await page.getByRole('button', { name: 'Ofertas vigentes' }).click()
  const promo = page.getByRole('button', { name: /Combo familiar/ })
  await expect(promo).toContainText('+ Agregar oferta')
  expect((await promo.boundingBox())!.height).toBeLessThan(160)
})
