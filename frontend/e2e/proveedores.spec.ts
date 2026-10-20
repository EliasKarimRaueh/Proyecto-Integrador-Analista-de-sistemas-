import { test, expect } from '@playwright/test'

test('Proveedores: alta, filtros, baja y reactivación en escritorio y móvil', async ({ page }) => {
  const proveedores: Record<string, unknown>[] = []
  await page.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), method = req.method()
    let data: unknown = { status: 'ok' }
    if (url.pathname.startsWith('/api/proveedores')) {
      if (method === 'GET') data = proveedores
      else if (method === 'POST') {
        data = { ...req.postDataJSON(), id: 1, activo: true, fechaBaja: null }
        proveedores.push(data as Record<string, unknown>)
      } else {
        const p = proveedores[0]
        if (method === 'DELETE') p.activo = false
        else if (url.pathname.endsWith('/reactivar')) p.activo = true
        else Object.assign(p, req.postDataJSON())
        data = p
      }
    }
    await route.fulfill({ status: method === 'POST' ? 201 : 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await page.goto('/proveedores')
  await expect(page.getByRole('heading', { name: 'Directorio de proveedores' })).toBeVisible()
  await page.getByRole('button', { name: 'Nuevo proveedor' }).click()
  await page.getByLabel('Razón social *').fill('Distribuidora Sur')
  await page.getByLabel('CUIT', { exact: true }).fill('20-12345678-9')
  await page.getByLabel('Dirección', { exact: true }).fill('San Martín 123')
  await page.getByLabel('Lunes', { exact: true }).check()
  await page.getByRole('button', { name: 'Registrar proveedor' }).click()
  await expect(page.getByText('Proveedor registrado correctamente.')).toBeVisible()
  await page.getByRole('textbox', { name: 'Buscar proveedores' }).fill('san martin')
  await expect(page.getByRole('button', { name: 'Distribuidora Sur', exact: true })).toBeVisible()
  await page.screenshot({ path: 'artifacts/proveedores-desktop.png', fullPage: true })
  await page.getByRole('button', { name: 'Dar de baja Distribuidora Sur' }).click()
  await page.getByRole('button', { name: 'Confirmar baja' }).click()
  await expect(page.getByText('Proveedor dado de baja correctamente.')).toBeVisible()
  await page.getByRole('button', { name: 'Reactivar Distribuidora Sur' }).click()
  await page.getByRole('button', { name: 'Confirmar reactivación' }).click()
  await expect(page.getByText('Proveedor reactivado correctamente.')).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Editar Distribuidora Sur' }).click()
  await expect(page.getByLabel('Dirección', { exact: true })).toHaveValue('San Martín 123')
  await expect(page.getByLabel('Lunes', { exact: true })).toBeChecked()
  await page.screenshot({ path: 'artifacts/proveedores-mobile.png', fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Nuevo proveedor' })).toBeVisible()
})
