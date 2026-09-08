import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProductsPage } from '../src/features/products/ProductsPage'
import { demoProducts, loadProducts, saveProducts, validateProduct } from '../src/features/products/products'

// JSDOM no implementa los métodos nativos del elemento dialog.
HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }

beforeEach(() => { localStorage.clear() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('Catálogo de productos', () => {
  it('registra, edita y da de baja conservando el producto después de recargar', async () => {
    const user = userEvent.setup()
    const view = render(<ProductsPage />)
    await user.click(screen.getByRole('button', { name: 'Nuevo producto' }))
    await user.type(screen.getByLabelText('Nombre del producto *'), 'Menudos')
    await user.type(screen.getByLabelText('Código *'), 'pol-010')
    await user.click(screen.getByRole('button', { name: 'Registrar producto' }))
    expect(loadProducts().find(p => p.code === 'POL-010')?.name).toBe('Menudos')

    await user.click(screen.getByRole('button', { name: 'Editar Menudos' }))
    await user.clear(screen.getByLabelText('Nombre del producto *'))
    await user.type(screen.getByLabelText('Nombre del producto *'), 'Menudos frescos')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await user.click(screen.getByRole('button', { name: 'Dar de baja Menudos frescos' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(loadProducts().find(p => p.code === 'POL-010')?.active).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Dar de baja Menudos frescos' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar baja' }))
    const saved = loadProducts().find(p => p.code === 'POL-010')
    expect(saved).toMatchObject({ name: 'Menudos frescos', active: false })
    view.unmount()
    render(<ProductsPage />)
    await user.selectOptions(screen.getByLabelText('Estado'), 'inactivos')
    expect(screen.getByRole('button', { name: 'Menudos frescos' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Ver Menudos frescos' }))
    expect(within(screen.getByRole('dialog')).getByText('POL-010')).toBeTruthy()
  }, 15000)

  it('combina búsqueda sin acentos, categoría y estado', async () => {
    const user = userEvent.setup()
    render(<ProductsPage />)
    await user.type(screen.getByRole('textbox', { name: 'Buscar por nombre o código' }), 'PICÁDA')
    expect(screen.getByRole('button', { name: 'Picada de pollo' })).toBeTruthy()
    await user.selectOptions(screen.getByLabelText('Estado'), 'activos')
    expect(screen.getByText('No encontramos productos')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    await user.click(screen.getByRole('button', { name: 'Otros', exact: true }))
    expect(screen.getByRole('button', { name: 'Huevos' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Suprema', exact: true })).toBeNull()
  })

  it('rechaza códigos repetidos incluso de productos dados de baja', () => {
    const inactive = demoProducts.find(p => !p.active)!
    expect(validateProduct({ ...inactive, code: ' ' + inactive.code.toLowerCase() + ' ' }, demoProducts).code).toBeTruthy()
    expect(validateProduct(inactive, demoProducts, inactive.id)).toEqual({})
    expect(validateProduct({ ...inactive, name: '  ', code: '' }, []).name).toBeTruthy()
  })

  it('muestra errores de validación sin registrar un producto incompleto', async () => {
    const user = userEvent.setup()
    render(<ProductsPage />)
    await user.click(screen.getByRole('button', { name: 'Nuevo producto' }))
    await user.click(screen.getByRole('button', { name: 'Registrar producto' }))
    expect(screen.getByText('Ingresá un nombre de entre 2 y 80 caracteres.')).toBeTruthy()
    expect(loadProducts()).toHaveLength(demoProducts.length)
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('no informa éxito ni cierra el formulario cuando falla el almacenamiento', async () => {
    const user = userEvent.setup()
    render(<ProductsPage />)
    await user.click(screen.getByRole('button', { name: 'Editar Suprema' }))
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded') })
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(screen.getByRole('alert').textContent).toContain('No se pudo guardar')
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.queryByText('Producto actualizado correctamente.')).toBeNull()
  })

  it('conserva un catálogo vacío y evita sobrescribir datos corruptos', () => {
    saveProducts([])
    expect(loadProducts()).toEqual([])
    localStorage.setItem('la-nena.products.v1', '{invalid')
    render(<ProductsPage />)
    expect(screen.getByRole('alert').textContent).toContain('No pudimos leer')
    expect((screen.getByRole('button', { name: 'Nuevo producto' }) as HTMLButtonElement).disabled).toBe(true)
    expect(localStorage.getItem('la-nena.products.v1')).toBe('{invalid')
  })
})
