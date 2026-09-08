import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from '../shared/components/AppLayout'
import { HomePage } from '../features/home/HomePage'
import { ProductsPage } from '../features/products/ProductsPage'
import { OrdersPage } from '../features/orders/OrdersPage'
import { StockPage } from '../features/stock/StockPage'
import { CustomersPage } from '../features/customers/CustomersPage'
import { LoginPage } from '../features/auth/LoginPage'
import { ModulePage } from '../shared/components/ModulePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="productos" element={<ProductsPage />} />
          <Route path="pedidos" element={<OrdersPage />} />
          <Route path="stock" element={<StockPage />} />
          <Route path="clientes" element={<CustomersPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="*" element={<ModulePage title="Página no encontrada" description="Usá el menú para volver a una sección del sistema." />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
