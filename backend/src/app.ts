import express, { type Application } from 'express';
import cors from 'cors';
import productoRoutes from './routes/productoRoutes.js';

const app: Application = express();

const corsOptions = {
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
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

export default app;