import { test, expect, type Page } from '@playwright/test'

async function simularApi(page: Page, inactiva = false) {
  const producto = { id: '1', code: 'SKU-OCULTO-001', name: 'Pollo entero', unit: 'kg', category: 'Fresco', description: '', active: true, unidadCompra: 'CAJONES', factorConversion: 20, costoActual: '1000.00' }
  const proveedor = { id: 5, nombre: 'Distribuidora Sur', activo: true }
  let oferta = { id: '10', nombre: 'Promo 3 kilos', descripcion: 'Precio pactado por combo', activo: !inactiva, vigente: !inactiva, fechaInicio: '2026-01-01', fechaFin: null as string | null, fechaBaja: inactiva ? '2026-01-01' : null as string | null, descuentoPorcentaje: '10.00' }
  const control = { conflicto: inactiva, venta: null as Record<string, unknown> | null, ultimoProducto: null as Record<string, unknown> | null }
  const componentes = [{ productoId: '1', codigo: producto.code, nombre: producto.name, unidadVenta: 'KILOS', stockActual: 20, precioOferta: '0.00', precioLista: '1000.00', cantidad: 3, activo: true }]
  await page.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method(), b = req.postDataJSON()
    let data: unknown = [], status = 200
    if (path === '/api/health') data = { status: 'ok' }
    else if (path === '/api/productos') data = [producto]
    else if (path === '/api/productos/1' && method === 'PUT') { control.ultimoProducto = b; Object.assign(producto, b); data = producto }
    else if (path === '/api/proveedores') data = [proveedor]
    else if (path === '/api/proveedores/5/productos') data = [{ productoId: 1, proveedorId: 5, activo: true }]
    else if (path === '/api/precios') data = [{ id: '1', productoId: 1, precioMinorista: '1000.00', precioMayorista: '800.00', activo: true, vigente: true }]
    else if (path === '/api/ventas/categorias') data = [{ id: 1, nombre: 'Fresco' }, { id: 2, nombre: 'Congelado' }]
    else if (path === '/api/ventas/productos') data = { rows: [{ id: 1, codigo: producto.code, nombre: producto.name, unidadVenta: 'KILOS', stockActual: 20 }], count: 1 }
    else if (path === '/api/ofertas/10/reactivar') {
      if (control.conflicto) { status = 409; data = { message: 'La vigencia se superpone con otra oferta.' } }
      else { oferta = { ...oferta, activo: true, vigente: true, fechaBaja: null, fechaInicio: b.fechaInicio, fechaFin: b.fechaFin }; data = oferta }
    } else if (path === '/api/ofertas/10') data = { ...oferta, productos: componentes, resumen: { subtotalLista: '3000.00', descuento: '300.00', total: '2700.00' } }
    else if (path === '/api/ofertas' && method === 'POST') { oferta = { ...oferta, ...b, id: '11', activo: true, vigente: true }; data = { ...oferta, productos: componentes }; status = 201 }
    else if (path === '/api/ofertas') data = [oferta]
    else if (path === '/api/ventas/cotizacion' || path === '/api/ventas' && method === 'POST') {
      const detalles = b.detalles.map((d: { ofertaId?: number; cantidad: number; despacho?: { productoId: number; cantidadReal: number }[] }) => ({ ...d, nombre: d.ofertaId ? oferta.nombre : producto.name, importeUnitario: d.ofertaId ? '2700.00' : '1000.00', subtotal: ((d.ofertaId ? 2700 : 1000) * d.cantidad).toFixed(2), despacho: d.despacho?.map(p => ({ ...p, nombre: producto.name, unidadVenta: 'KILOS', cantidadPromocional: 3 * d.cantidad })) }))
      const total = detalles.reduce((s: number, d: { subtotal: string }) => s + Number(d.subtotal), 0).toFixed(2)
      if (path === '/api/ventas') { control.venta = b; status = 201; data = { venta: { id: 1, fechaHora: '2026-11-03T15:00:00Z', total }, detalles } }
      else data = { total, detalles }
    } else if (path === '/api/stock') data = [{ id: 1, codigo: producto.code, nombre: producto.name, unidadVenta: 'KILOS', unidadCompra: 'CAJONES', factorConversion: 20, stockActual: 5, stockMinimo: 10, estado: 'Crítico' }]
    else if (path === '/api/compras/reposicion') data = [{ id: 1, codigo: producto.code, nombre: producto.name, unidadCompra: 'CAJONES', unidadVenta: 'KILOS', factorConversion: 20, costoActual: '1000.00', stockActual: 5, stockMinimo: 10, faltante: 5, cantidadSugerida: 20, estado: 'Crítico', proveedorHabitualId: 5, proveedores: [proveedor] }]
    await route.fulfill({ status, headers: { 'Content-Type': 'application/json', 'X-Total-Count': Array.isArray(data) ? String(data.length) : '1' }, body: JSON.stringify(data) })
  })
  return control
}

test('caja filtra categorías, ordena y cobra la promoción con despacho real', async ({ page }) => {
  const control = await simularApi(page)
  await page.goto('/caja')
  const filtro = page.waitForRequest(r => r.url().includes('/ventas/productos?') && new URL(r.url()).searchParams.get('categoria') === 'Fresco')
  const categorias = page.getByRole('combobox', { name: 'Filtrar por categoría' })
  await categorias.selectOption('Fresco')
  await filtro
  await expect(categorias.getByRole('option')).toHaveText(['Todas las categorías', 'Fresco', 'Congelado'])
  const otraCategoria = page.waitForRequest(r => r.url().includes('/ventas/productos?') && new URL(r.url()).searchParams.get('categoria') === 'Congelado')
  await categorias.selectOption('Congelado')
  await otraCategoria
  await expect(categorias).toHaveValue('Congelado')
  await expect(categorias.getByRole('option')).toHaveText(['Todas las categorías', 'Fresco', 'Congelado'])
  await categorias.selectOption('')
  await expect(categorias).toHaveValue('')
  const orden = page.waitForRequest(r => r.url().includes('/ventas/productos?') && new URL(r.url()).searchParams.get('orden') === 'mas_vendido')
  await page.getByLabel('Ordenar productos').selectOption('mas_vendido')
  await orden
  await page.getByRole('button', { name: 'Ofertas vigentes', exact: true }).click()
  await expect(page.getByText('Total del combo:', { exact: false })).toContainText('2.700,00')
  await page.screenshot({ path: 'test-results/bloque2-caja-promociones.png', fullPage: true })
  await page.getByRole('button', { name: /OFERTA Promo 3 kilos/ }).click()
  await expect(page.getByRole('button', { name: 'Confirmar venta', exact: true })).toBeDisabled()
  await page.getByLabel('Cantidad de Promo 3 kilos', { exact: true }).fill('2')
  await page.getByLabel('Peso real de Pollo entero en Promo 3 kilos').fill('6,235')
  await page.getByRole('button', { name: 'Confirmar venta', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('6,235 kg de inventario')
  await page.getByRole('button', { name: 'Registrar venta', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Venta #1 registrada')
  expect(control.venta).toMatchObject({ detalles: [{ ofertaId: 10, cantidad: 2, despacho: [{ productoId: 1, cantidadReal: 6.235 }] }] })
  await expect(page.getByRole('dialog')).toContainText('Despachado 6,235 kg')
  await expect(page.locator('body')).not.toContainText('SKU-OCULTO-001')
  await page.screenshot({ path: 'test-results/bloque2-venta-real.png', fullPage: true })
})

test('ofertas abiertas y reactivación controlada con conflicto visible', async ({ page }) => {
  const control = await simularApi(page, true)
  await page.goto('/ofertas')
  await expect(page.getByText(/Sin fecha de fin/)).toBeVisible()
  await page.getByRole('button', { name: 'Reactivar Promo 3 kilos', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar reactivación' }).click()
  await expect(page.getByRole('alert')).toContainText('se superpone')
  control.conflicto = false
  await page.getByRole('button', { name: 'Confirmar reactivación' }).click()
  await expect(page.getByRole('status')).toHaveText('Oferta reactivada correctamente.')
  await page.getByRole('button', { name: 'Nueva oferta', exact: true }).click()
  await page.getByLabel('Nombre de la oferta *', { exact: true }).fill('Promoción abierta')
  await page.getByLabel('Vigente hasta (opcional)', { exact: true }).clear()
  await page.getByRole('button', { name: 'Agregar Pollo entero' }).click()
  await page.getByLabel('Precio final de la oferta *', { exact: true }).fill('2700')
  await expect(page.getByRole('dialog').getByLabel('Descuento sobre el subtotal (%)')).toHaveCount(0)
  await page.screenshot({ path: 'test-results/oferta-precio-final.png', fullPage: true })
  const solicitud = page.waitForRequest(r => r.method() === 'POST' && new URL(r.url()).pathname === '/api/ofertas')
  await page.getByRole('button', { name: 'Registrar oferta', exact: true }).click()
  const datos = (await solicitud).postDataJSON()
  expect(datos.fechaFin).toBeNull()
  expect(datos.precioFinal).toBe('2700.00')
  expect(datos.descuentoPorcentaje).toBeUndefined()
})

test('oculta códigos en catálogo, edición, inventario, reposición, compras y detalles de oferta', async ({ page }) => {
  const control = await simularApi(page)
  await page.goto('/productos')
  await page.getByRole('button', { name: 'Editar Pollo entero', exact: true }).click()
  await expect(page.getByLabel('Código *', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('dialog')).not.toContainText('SKU-OCULTO-001')
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Producto actualizado')
  expect(control.ultimoProducto?.code).toBe('SKU-OCULTO-001')
  for (const ruta of ['/stock', '/reposicion']) {
    await page.goto(ruta)
    await expect(page.getByRole('cell', { name: 'Pollo entero', exact: true })).toBeVisible()
    await expect(page.locator('body')).not.toContainText('SKU-OCULTO-001')
  }
  await page.goto('/compras')
  await page.getByRole('button', { name: 'Nueva compra', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Proveedor', { exact: true }).selectOption('5')
  await page.getByRole('button', { name: 'Agregar producto' }).click()
  await expect(page.getByLabel('Producto 1', { exact: true })).not.toContainText('SKU-OCULTO-001')
  await page.goto('/ofertas')
  await page.getByRole('button', { name: 'Ver Promo 3 kilos', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Pollo entero')
  await expect(page.getByRole('dialog')).not.toContainText('SKU-OCULTO-001')
})
