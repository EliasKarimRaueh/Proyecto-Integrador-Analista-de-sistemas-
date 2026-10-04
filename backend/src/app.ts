import express, { type Application, type ErrorRequestHandler } from 'express';
import cors from 'cors';
import productoRoutes from './routes/productoRoutes.js';
import precioRoutes from './routes/precioRoutes.js';
import ofertaRoutes from './routes/ofertaRoutes.js';
import stockRoutes from './routes/stockRoutes.js';
import ventaRoutes from './routes/ventaRoutes.js';

const app: Application = express();

const corsOptions = {
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Total-Count'],
  credentials: true 
};

app.use(cors(corsOptions));
app.use(express.json());

// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API de AvixSoft conectada y funcionando' });
});

// NUESTRAS RUTAS DE NEGOCIO
app.use('/api/productos', productoRoutes); // <-- Conectamos la ruta
app.use('/api/precios', precioRoutes);
app.use('/api/ofertas', ofertaRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/ventas', ventaRoutes);

app.use((_req, res) => { res.status(404).json({ message: 'Ruta no encontrada.' }); });
const manejarError: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error?.type === 'entity.parse.failed') {
    res.status(400).json({ message: 'El cuerpo debe ser JSON válido.' });
    return;
  }
  if (error?.type === 'entity.too.large') {
    res.status(413).json({ message: 'El cuerpo de la solicitud es demasiado grande.' });
    return;
  }
  console.error('Error de API:', error);
  res.status(500).json({ message: 'No se pudo completar la solicitud.' });
};
app.use(manejarError);

export default app;
