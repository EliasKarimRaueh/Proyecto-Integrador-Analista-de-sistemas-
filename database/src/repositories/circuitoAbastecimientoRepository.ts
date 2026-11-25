import { QueryTypes, type Transaction } from 'sequelize';
import sequelize from '../config/database.js';

export type CabeceraCircuito = {
    id: number; pedidoId: number | null; proveedorId: number; fechaHora: Date;
    observaciones: string | null; usuarioId: number; recepcionId?: number; total?: string;
    formaPago?: 'PAGADO' | 'A CUENTA'; conformidad?: string;
    proveedor?: { id: number; nombre: string }; compra?: { id: number } | null;
    recepcion?: { id: number; pedidoId: number } | null;
};
const cabeceraRecepcion = 'r.id, r."pedidoId", r."proveedorId", r."fechaHora", r.observaciones, r."usuarioId", r.conformidad';
// La lectura JSON permite consultar registros históricos antes de que Jeremías
// agregue compras.recepcionId. Nunca se usa recepciones.compraId.
const relacionRecepcion = `(to_jsonb(c)->>'recepcionId')::integer`;

export default class CircuitoAbastecimientoRepository {
    async esquemaDisponible(transaction?: Transaction) {
        const columnas = await sequelize.query<{ table_name: string; column_name: string; is_nullable: string }>(`SELECT table_name, column_name, is_nullable FROM information_schema.columns WHERE table_schema = current_schema() AND table_name IN ('compras', 'recepciones') AND column_name IN ('recepcionId', 'compraId')`, { type: QueryTypes.SELECT, transaction });
        return columnas.some(c => c.table_name === 'compras' && c.column_name === 'recepcionId') && !columnas.some(c => c.table_name === 'recepciones' && c.column_name === 'compraId' && c.is_nullable === 'NO');
    }

    async crearRecepcion(datos: { pedidoId: number; proveedorId: number; observaciones: string | null; usuarioId: number; conformidad: string }, transaction: Transaction) {
        const rows = await sequelize.query<CabeceraCircuito>(`INSERT INTO recepciones ("pedidoId", "proveedorId", "fechaHora", observaciones, "usuarioId", conformidad)
            VALUES (:pedidoId, :proveedorId, CURRENT_TIMESTAMP, :observaciones, :usuarioId, :conformidad)
            RETURNING id, "pedidoId", "proveedorId", "fechaHora", observaciones, "usuarioId", conformidad`, { replacements: datos, type: QueryTypes.SELECT, transaction });
        return rows[0]!;
    }

    async recepcion(id: number, transaction?: Transaction, bloquear = false) {
        if (bloquear) {
            // Releer la relación en otra sentencia después del bloqueo evita
            // aceptar una segunda compra con una instantánea anterior al commit.
            await sequelize.query('SELECT id FROM recepciones WHERE id = :id FOR UPDATE', { replacements: { id }, type: QueryTypes.SELECT, transaction });
        }
        const rows = await sequelize.query<CabeceraCircuito>(`SELECT ${cabeceraRecepcion},
            (SELECT json_build_object('id', c.id) FROM compras c WHERE ${relacionRecepcion} = r.id LIMIT 1) compra
            FROM recepciones r WHERE r.id = :id`, { replacements: { id }, type: QueryTypes.SELECT, transaction });
        return rows[0] ?? null;
    }

    async relacionadas(pedidoId: number, transaction?: Transaction) {
        const recepciones = await sequelize.query<{ id: number }>('SELECT id FROM recepciones WHERE "pedidoId" = :pedidoId ORDER BY id', { replacements: { pedidoId }, type: QueryTypes.SELECT, transaction });
        const compras = await sequelize.query<{ id: number }>(`SELECT c.id FROM compras c WHERE c."pedidoId" = :pedidoId OR ${relacionRecepcion} IN (SELECT id FROM recepciones WHERE "pedidoId" = :pedidoId) ORDER BY c.id`, { replacements: { pedidoId }, type: QueryTypes.SELECT, transaction });
        return { recepciones, compras, recepcion: recepciones[0] ?? null, compra: compras[0] ?? null };
    }

    async relacionadasPorPedidos(pedidoIds: number[], transaction?: Transaction) {
        type RelacionPedido = { recepciones: { id: number }[]; compras: { id: number }[]; recepcion: { id: number } | null; compra: { id: number } | null };
        const resultado = new Map<number, RelacionPedido>();
        const ids = [...new Set(pedidoIds)];
        if (ids.length === 0) return resultado;

        for (const pedidoId of ids) {
            resultado.set(pedidoId, { recepciones: [], compras: [], recepcion: null, compra: null });
        }

        const recepciones = await sequelize.query<{ id: number; pedidoId: number }>(
            'SELECT id, "pedidoId" FROM recepciones WHERE "pedidoId" IN (:pedidoIds) ORDER BY id',
            { replacements: { pedidoIds: ids }, type: QueryTypes.SELECT, transaction }
        );
        const pedidoPorRecepcion = new Map<number, number>();
        for (const r of recepciones) {
            pedidoPorRecepcion.set(r.id, r.pedidoId);
            const entry = resultado.get(r.pedidoId);
            if (entry) {
                const item = { id: r.id };
                entry.recepciones.push(item);
                if (!entry.recepcion) entry.recepcion = item;
            }
        }

        const compras = await sequelize.query<{ id: number; pedidoId: number | null; recepcionId: number | null }>(
            `SELECT c.id, c."pedidoId", ${relacionRecepcion} AS "recepcionId" FROM compras c WHERE c."pedidoId" IN (:pedidoIds) OR ${relacionRecepcion} IN (SELECT id FROM recepciones WHERE "pedidoId" IN (:pedidoIds)) ORDER BY c.id`,
            { replacements: { pedidoIds: ids }, type: QueryTypes.SELECT, transaction }
        );
        for (const c of compras) {
            const targetPedidoId = (c.pedidoId != null && resultado.has(c.pedidoId))
                ? c.pedidoId
                : (c.recepcionId != null ? pedidoPorRecepcion.get(c.recepcionId) : undefined);
            if (targetPedidoId === undefined) continue;
            const entry = resultado.get(targetPedidoId);
            if (entry && !entry.compras.some(existing => existing.id === c.id)) {
                const item = { id: c.id };
                entry.compras.push(item);
                if (!entry.compra) entry.compra = item;
            }
        }

        return resultado;
    }

    async crearCompra(datos: { recepcionId: number; pedidoId: number; proveedorId: number; tipoComprobante: string | null; numeroComprobante: string | null; formaPago: string; observaciones: string | null; total: string; usuarioId?: number }, transaction: Transaction) {
        // El backend envía usuarioId desde el token. Se admite que falte para no
        // romper callers anteriores: en ese caso queda el usuario histórico (1).
        const valores = { ...datos, usuarioId: datos.usuarioId ?? 1 };
        const rows = await sequelize.query<CabeceraCircuito>(`INSERT INTO compras ("recepcionId", "pedidoId", "proveedorId", "fechaHora", "tipoComprobante", "numeroComprobante", "formaPago", observaciones, total, "usuarioId", estado)
            VALUES (:recepcionId, :pedidoId, :proveedorId, CURRENT_TIMESTAMP, :tipoComprobante, :numeroComprobante, :formaPago, :observaciones, :total, :usuarioId, 'RECIBIDA')
            RETURNING id, "pedidoId", "proveedorId", "fechaHora", "tipoComprobante", "numeroComprobante", "claveOperacion", "formaPago", observaciones, total, "recepcionId", "usuarioId", estado`, { replacements: valores, type: QueryTypes.SELECT, transaction });
        return rows[0]!;
    }

    async compra(id: number, transaction?: Transaction) {
        const rows = await sequelize.query<CabeceraCircuito>(`SELECT c.*, (SELECT json_build_object('id', r.id, 'pedidoId', r."pedidoId") FROM recepciones r WHERE r.id = ${relacionRecepcion}) recepcion,
            json_build_object('id', p.id, 'nombre', p.nombre) proveedor
            FROM compras c JOIN proveedores p ON p.id = c."proveedorId" WHERE c.id = :id`, { replacements: { id }, type: QueryTypes.SELECT, transaction });
        return rows[0] ?? null;
    }

    async crearDetalleCompra(datos: { compraId: number; numeroItem: number; pedidoId: number; numeroItemPedido: number | null; productoId: number; nombre: string; unidadCompra: string; cantidad: number; importeUnitario: string; subtotal: string; presentacion: string; cantidadPresentacion: number; factorConversion: number }, transaction: Transaction) {
        // El total facturado es la entrada del usuario; el costo unitario queda
        // redondeado a los dos decimales de su columna. No se recalcula el total
        // multiplicando ese redondeo, como exige el validador del modelo antiguo.
        const rows = await sequelize.query(`INSERT INTO "detallesCompra" ("compraId", "numeroItem", "pedidoId", "numeroItemPedido", "productoId", nombre, "unidadCompra", cantidad, "importeUnitario", subtotal, presentacion, "cantidadPresentacion", "factorConversion")
            VALUES (:compraId, :numeroItem, :pedidoId, :numeroItemPedido, :productoId, :nombre, :unidadCompra, :cantidad, :importeUnitario, :subtotal, :presentacion, :cantidadPresentacion, :factorConversion) RETURNING *`, { replacements: datos, type: QueryTypes.SELECT, transaction });
        return rows[0];
    }

    async listar(tipo: 'compras' | 'recepciones', filtros: { proveedorId?: number; pedidoId?: number; compraId?: number; estado?: string; desde?: Date; hasta?: Date }, page: number, limit: number) {
        const alias = tipo === 'compras' ? 'c' : 'r';
        const condiciones: string[] = [];
        const replacements: Record<string, string | number | Date> = { limit, offset: (page - 1) * limit };
        for (const key of ['proveedorId', 'pedidoId', 'estado'] as const) {
            if (filtros[key] !== undefined && (key !== 'estado' || tipo === 'compras')) { condiciones.push(`${alias}."${key}" = :${key}`); replacements[key] = filtros[key]!; }
        }
        if (filtros.compraId !== undefined && tipo === 'recepciones') { condiciones.push(`r.id = (SELECT ${relacionRecepcion} FROM compras c WHERE c.id = :compraId)`); replacements.compraId = filtros.compraId; }
        if (filtros.desde) { condiciones.push(`${alias}."fechaHora" >= :desde`); replacements.desde = filtros.desde; }
        if (filtros.hasta) { condiciones.push(`${alias}."fechaHora" <= :hasta`); replacements.hasta = filtros.hasta; }
        const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
        const relacionados = tipo === 'recepciones'
            ? `(SELECT json_build_object('id', c.id) FROM compras c WHERE ${relacionRecepcion} = r.id LIMIT 1) compra`
            : `(SELECT json_build_object('id', r.id, 'pedidoId', r."pedidoId") FROM recepciones r WHERE r.id = ${relacionRecepcion}) recepcion`;
        const rows = await sequelize.query<CabeceraCircuito>(`SELECT ${tipo === 'recepciones' ? cabeceraRecepcion : 'c.*'}, json_build_object('id', p.id, 'nombre', p.nombre) proveedor, ${relacionados}
            FROM ${tipo} ${alias} JOIN proveedores p ON p.id = ${alias}."proveedorId" ${where} ORDER BY ${alias}."fechaHora" DESC, ${alias}.id DESC LIMIT :limit OFFSET :offset`, { replacements, type: QueryTypes.SELECT });
        const counts = await sequelize.query<{ count: string }>(`SELECT count(*) count FROM ${tipo} ${alias} ${where}`, { replacements, type: QueryTypes.SELECT });
        return { rows, count: Number(counts[0]?.count ?? 0) };
    }
}
