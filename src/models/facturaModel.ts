import pool from '../config/database';
import { Factura } from '../types';

export class FacturaModel {
  static async create(factura: Omit<Factura, 'id' | 'created_at' | 'updated_at'>): Promise<Factura> {
    const query = `
      INSERT INTO facturas
        (rfc, emisor, fecha, importe_total, iva, subtotal, conceptos, forma_pago,
         metodo_pago, archivo_path, archivo_tipo, status, factura_externa_id,
         error_message, whatsapp_from)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;

    const values = [
      factura.rfc,
      factura.emisor || null,
      factura.fecha,
      factura.importe_total,
      factura.iva,
      factura.subtotal,
      factura.conceptos || null,
      factura.forma_pago || null,
      factura.metodo_pago || null,
      factura.archivo_path || null,
      factura.archivo_tipo || null,
      factura.status || 'pendiente',
      factura.factura_externa_id || null,
      factura.error_message || null,
      factura.whatsapp_from || null,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async findById(id: number): Promise<Factura | null> {
    const query = 'SELECT * FROM facturas WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async findAll(limit: number = 50, offset: number = 0): Promise<Factura[]> {
    const query = 'SELECT * FROM facturas ORDER BY created_at DESC LIMIT $1 OFFSET $2';
    const result = await pool.query(query, [limit, offset]);
    return result.rows;
  }

  static async findByRFC(rfc: string): Promise<Factura[]> {
    const query = 'SELECT * FROM facturas WHERE rfc = $1 ORDER BY created_at DESC';
    const result = await pool.query(query, [rfc]);
    return result.rows;
  }

  static async findByStatus(status: string): Promise<Factura[]> {
    const query = 'SELECT * FROM facturas WHERE status = $1 ORDER BY created_at DESC';
    const result = await pool.query(query, [status]);
    return result.rows;
  }

  static async update(id: number, updates: Partial<Factura>): Promise<Factura | null> {
    const fields = Object.keys(updates)
      .filter(key => key !== 'id' && key !== 'created_at' && key !== 'updated_at')
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    if (!fields) {
      return this.findById(id);
    }

    const values = [
      id,
      ...Object.keys(updates)
        .filter(key => key !== 'id' && key !== 'created_at' && key !== 'updated_at')
        .map(key => updates[key as keyof Factura])
    ];

    const query = `UPDATE facturas SET ${fields} WHERE id = $1 RETURNING *`;
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  static async delete(id: number): Promise<boolean> {
    const query = 'DELETE FROM facturas WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  static async updateStatus(
    id: number,
    status: Factura['status'],
    errorMessage?: string
  ): Promise<Factura | null> {
    const query = `
      UPDATE facturas
      SET status = $2, error_message = $3
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [id, status, errorMessage || null]);
    return result.rows[0] || null;
  }
}
