-- Up Migration
CREATE TABLE IF NOT EXISTS facturas (
    id SERIAL PRIMARY KEY,
    rfc VARCHAR(13) NOT NULL,
    fecha DATE NOT NULL,
    importe_total DECIMAL(12, 2) NOT NULL,
    iva DECIMAL(12, 2) NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    conceptos TEXT,
    forma_pago VARCHAR(50),
    metodo_pago VARCHAR(50),
    archivo_path VARCHAR(500),
    archivo_tipo VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    factura_externa_id VARCHAR(100),
    error_message TEXT,
    whatsapp_from VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_facturas_rfc ON facturas(rfc);
CREATE INDEX idx_facturas_fecha ON facturas(fecha);
CREATE INDEX idx_facturas_status ON facturas(status);
CREATE INDEX idx_facturas_whatsapp ON facturas(whatsapp_from);
CREATE INDEX idx_facturas_created_at ON facturas(created_at);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_facturas_updated_at BEFORE UPDATE ON facturas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Down Migration (comentado, ejecutar manualmente si es necesario)
-- DROP TRIGGER IF EXISTS update_facturas_updated_at ON facturas;
-- DROP FUNCTION IF EXISTS update_updated_at_column();
-- DROP TABLE IF EXISTS facturas;
