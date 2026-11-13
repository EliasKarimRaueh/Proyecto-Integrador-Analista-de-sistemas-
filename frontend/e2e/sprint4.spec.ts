import { test, expect, type Page } from '@playwright/test'

async function simularAbastecimiento(page: Page) {
  const proveedor = { id: 5, nombre: 'Distribuidora Sur', activo: true }
  const producto = { id: '1', code: 'POL-001', name: 'Pollo entero', category: 'Fresco', unit: 'kg', description: '', active: true, unidadCompra: 'CAJONES', factorConversion: 20, costoActual: '1000.00' }
  const productoDetalle = { id: 1, nombre: producto.name, unidadCompra: producto.unidadCompra, unidadVenta: 'KILOS', factorConversion: 20 }
  let stock = 5, habitual: number | null = 5
  const pedidos: Record<string, unknown>[] = [], compras: Record<string, unknown>[] = [], recepciones: Record<string, unknown>[] = []
  await page.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method()
    const b = req.postDataJSON()
    let data: unknown = [], status = method === 'POST' ? 201 : 200, total = 0
    if (path === '/api/health') data = { status: 'ok' }
    else if (path === '/api/productos') data = [producto]
    else if (path === '/api/proveedores') data = [proveedor]
    else if (path === '/api/proveedores/5/productos') data = [{ productoId: 1, proveedorId: 5, activo: true }]
    else if (path === '/api/stock/1/proveedor-habitual') { habitual = b.proveedorId; data = {} }
    else if (path === '/api/compras/reposicion') {
      data = stock <= 12 && (url.searchParams.get('soloHabitual') !== 'true' || habitual === 5) ? [{ id: 1, codigo: 'POL-001', nombre: 'Pollo entero', unidadCompra: 'CAJONES', unidadVenta: 'KILOS', factorConversion: 20, costoActual: '1000.00', stockActual: stock, stockMinimo: 10, faltante: 5, cantidadSugerida: 20, estado: 'Crítico', proveedorHabitualId: habitual, proveedores: [proveedor] }] : []
      total = (data as unknown[]).length
    } else if (path === '/api/pedidos' && method === 'POST') {
      const pedido = { ...b, id: pedidos.length + 1, proveedor, estado: 'PENDIENTE', totalEstimado: String(b.detalles.reduce((s: number, d: { cantidad: number; costoEstimado: string }) => s + d.cantidad * Number(d.costoEstimado), 0)), detalles: b.detalles.map((d: object) => ({ ...d, producto: productoDetalle })) }
      pedidos.push(pedido); data = { pedido }
    } else if (/\/api\/pedidos\/\d+\/cancelar$/.test(path)) {
      const pedido = pedidos.find(p => p.id === Number(path.split('/')[3]))!
      pedido.estado = 'CANCELADO'; data = pedido
    } else if (/\/api\/pedidos\/\d+$/.test(path)) data = pedidos.find(p => p.id === Number(path.split('/').pop()))
    else if (path === '/api/pedidos') {
      data = pedidos.filter(p => !url.searchParams.get('estado') || p.estado === url.searchParams.get('estado')); total = (data as unknown[]).length
    } else if (path === '/api/compras' && method === 'POST') {
      const totalCompra = b.detalles.reduce((s: number, d: { cantidad: number; costoUnitario: string }) => s + d.cantidad * Number(d.costoUnitario), 0)
      const compra = { ...b, id: compras.length + 1, proveedor, estado: 'PENDIENTE_RECEPCION', total: totalCompra.toFixed(2), detalles: b.detalles.map((d: { cantidad: number; costoUnitario: string }) => ({ ...d, subtotal: (d.cantidad * Number(d.costoUnitario)).toFixed(2), producto: productoDetalle })) }
      compras.push(compra)
      const pedido = pedidos.find(p => p.id === b.pedidoId); if (pedido) pedido.estado = 'FACTURADO'
      data = { compra }
    } else if (/\/api\/compras\/\d+$/.test(path)) {
      const compra = compras.find(p => p.id === Number(path.split('/').pop()))!
      const recibido = compra.estado === 'RECIBIDA' ? (compra.total as string) : null
      data = { compra, cuenta: { estado: 'PAGO PENDIENTE', importePendiente: compra.total }, totalRecibido: recibido }
    } else if (path === '/api/compras') { data = compras; total = compras.length }
    else if (path === '/api/recepciones' && method === 'POST') {
      const compra = compras.find(c => c.id === b.compraId)!
      compra.estado = 'RECIBIDA'
      const pedido = pedidos.find(p => p.id === compra.pedidoId); if (pedido) pedido.estado = 'RECIBIDO'
      const detalles = b.detalles.map((d: { productoId: number; cantidadPresentacion: number; factorConversion: number; cantidadRechazadaBase?: number }) => {
        const cantidadBase = d.cantidadPresentacion * d.factorConversion
        const comprada = (compra.detalles as { productoId: number; cantidad: number }[]).find(cd => cd.productoId === d.productoId)?.cantidad ?? 0
        return { ...d, cantidadBase, cantidadRechazadaBase: d.cantidadRechazadaBase ?? 0, cantidadFaltanteBase: Math.max(0, comprada - cantidadBase - (d.cantidadRechazadaBase ?? 0)), producto: productoDetalle }
      })
      stock += detalles.reduce((s: number, d: { cantidadBase: number }) => s + d.cantidadBase, 0)
      const conDiferencia = detalles.some((d: { cantidadRechazadaBase: number; cantidadFaltanteBase: number }) => d.cantidadRechazadaBase > 0 || d.cantidadFaltanteBase > 0)
      const recepcion = { ...b, id: recepciones.length + 1, proveedorId: 5, proveedor, fechaHora: new Date().toISOString(), conformidad: conDiferencia ? 'CON_DIFERENCIAS' : 'COMPLETA', detalles, movimientosStock: [{ id: 1, productoId: 1, cantMovimiento: stock - 5, cantFinal: stock }] }
      recepciones.push(recepcion); data = { recepcion }
    } else if (/\/api\/recepciones\/\d+$/.test(path)) data = recepciones.find(r => r.id === Number(path.split('/').pop()))
    else if (path === '/api/recepciones') { data = recepciones; total = recepciones.length }
    else if (path === '/api/stock') { data = [{ id: 1, codigo: 'POL-001', nombre: 'Pollo entero', stockActual: stock, stockMinimo: 10, unidadVenta: 'KILOS', estado: stock <= 10 ? 'Crítico' : 'Normal' }]; total = 1 }
    await route.fulfill({ status, headers: { 'Content-Type': 'application/json', 'X-Total-Count': String(total) }, body: JSON.stringify(data) })
  })
}

test.beforeEach(async ({ page }) => simularAbastecimiento(page))

test('reposición → pedido → compra con deuda → recepción por peso real → inventario', async ({ page }) => {
  await page.goto('/reposicion')
  await page.getByLabel('Proveedor', { exact: true }).selectOption('5')
  await page.getByLabel('Solo proveedor habitual').check()
  await page.getByRole('checkbox', { name: 'Pedir Pollo entero' }).check()
  await page.getByRole('button', { name: 'Preparar pedido (1)' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByLabel('Cantidad producto 1', { exact: true })).toHaveValue('1')
  await page.getByRole('button', { name: 'Registrar pedido', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Pedido #1 registrado correctamente.')
  await page.getByRole('button', { name: 'Registrar compra', exact: true }).click()
  await page.getByLabel('Número de comprobante').fill('A-0001-123')
  await page.getByRole('button', { name: 'Registrar compra', exact: true }).last().click()
  await expect(page.getByRole('status')).toHaveText('Compra #1 registrado correctamente.')
  await page.getByRole('button', { name: 'Ver detalle', exact: true }).click()
  await expect(page.getByText(/Cuenta corriente: PAGO PENDIENTE/)).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar', exact: true }).last().click()
  await page.getByRole('button', { name: 'Recibir mercadería' }).click()
  await page.getByLabel('Presentación producto 1').selectOption('KILOS')
  await page.getByLabel('Cantidad aceptada producto 1').fill('19.5')
  await expect(page.getByText('Aceptado:', { exact: false })).toBeVisible()
  await expect(page.getByText('Faltante: 0,5', { exact: false })).toBeVisible()
  await page.getByLabel('Motivo producto 1').fill('Cajón con 19,5 kg pesados al recibir.')
  await page.getByRole('button', { name: 'Confirmar recepción e ingresar stock' }).click()
  await expect(page.getByRole('status')).toHaveText('Recepción #1 registrada. Se ajustaron el stock y la cuenta corriente.')
  await page.getByRole('navigation', { name: 'Abastecimiento' }).getByRole('link', { name: 'Recepciones' }).click()
  await page.getByRole('button', { name: 'Ver detalle', exact: true }).click()
  await expect(page.getByText(/Stock final 24,5/)).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar', exact: true }).last().click()
  await page.getByRole('navigation', { name: 'Abastecimiento' }).getByRole('link', { name: 'Reposición', exact: true }).click()
  await expect(page.getByText(/No hay necesidades con estos filtros/)).toBeVisible()
})

test('alta manual y cancelación de un pedido pendiente', async ({ page }) => {
  await page.goto('/pedidos')
  await page.getByRole('button', { name: 'Nuevo pedido', exact: true }).click()
  await page.getByLabel('Proveedor', { exact: true }).last().selectOption('5')
  await page.getByRole('button', { name: 'Agregar producto' }).click()
  await page.getByLabel('Producto 1', { exact: true }).selectOption('1')
  await page.getByRole('button', { name: 'Registrar pedido', exact: true }).click()
  await page.getByRole('button', { name: 'Cancelar pedido', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar cancelación' }).click()
  await expect(page.getByRole('cell', { name: 'Cancelado', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Registrar compra', exact: true })).toHaveCount(0)
})

test('reposición y formularios se adaptan a pantalla móvil', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/reposicion')
  await page.getByLabel('Proveedor', { exact: true }).selectOption('5')
  await page.getByRole('checkbox', { name: 'Pedir Pollo entero' }).check()
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390)
  await page.screenshot({ path: 'test-results/sprint4-reposicion-mobile.png', fullPage: true })
  await page.getByRole('button', { name: 'Preparar pedido (1)' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.screenshot({ path: 'test-results/sprint4-pedido-mobile.png', fullPage: true })
})
