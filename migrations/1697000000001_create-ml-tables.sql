-- Tabla para almacenar datos de entrenamiento y extracción OCR
CREATE TABLE IF NOT EXISTS ocr_extractions (
    id SERIAL PRIMARY KEY,
    factura_id INTEGER REFERENCES facturas(id) ON DELETE CASCADE,
    raw_text TEXT NOT NULL,
    preprocessed_text TEXT,
    extracted_data JSONB,
    confidence_score DECIMAL(5, 2),
    ocr_method VARCHAR(50), -- 'tesseract' o 'pdf'
    processing_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para correcciones humanas (feedback loop)
CREATE TABLE IF NOT EXISTS ocr_corrections (
    id SERIAL PRIMARY KEY,
    ocr_extraction_id INTEGER REFERENCES ocr_extractions(id) ON DELETE CASCADE,
    field_name VARCHAR(50) NOT NULL, -- 'rfc', 'fecha', 'total', etc.
    extracted_value TEXT,
    corrected_value TEXT NOT NULL,
    corrected_by VARCHAR(100),
    correction_source VARCHAR(50), -- 'manual', 'api', 'whatsapp'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para patrones aprendidos
CREATE TABLE IF NOT EXISTS extraction_patterns (
    id SERIAL PRIMARY KEY,
    field_name VARCHAR(50) NOT NULL,
    pattern_type VARCHAR(50), -- 'regex', 'position', 'context'
    pattern_value TEXT NOT NULL,
    confidence_weight DECIMAL(5, 2) DEFAULT 1.0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    accuracy DECIMAL(5, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para métricas de rendimiento
CREATE TABLE IF NOT EXISTS ml_metrics (
    id SERIAL PRIMARY KEY,
    metric_date DATE NOT NULL,
    total_extractions INTEGER DEFAULT 0,
    successful_extractions INTEGER DEFAULT 0,
    corrections_needed INTEGER DEFAULT 0,
    average_confidence DECIMAL(5, 2),
    accuracy_by_field JSONB, -- {'rfc': 0.95, 'fecha': 0.87, ...}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para almacenar features para ML
CREATE TABLE IF NOT EXISTS ml_features (
    id SERIAL PRIMARY KEY,
    ocr_extraction_id INTEGER REFERENCES ocr_extractions(id) ON DELETE CASCADE,
    features JSONB NOT NULL, -- Vector de características
    label JSONB, -- Valores correctos
    is_validated BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar rendimiento
CREATE INDEX idx_ocr_extractions_factura ON ocr_extractions(factura_id);
CREATE INDEX idx_ocr_extractions_confidence ON ocr_extractions(confidence_score);
CREATE INDEX idx_ocr_extractions_created ON ocr_extractions(created_at);

CREATE INDEX idx_ocr_corrections_extraction ON ocr_corrections(ocr_extraction_id);
CREATE INDEX idx_ocr_corrections_field ON ocr_corrections(field_name);
CREATE INDEX idx_ocr_corrections_created ON ocr_corrections(created_at);

CREATE INDEX idx_extraction_patterns_field ON extraction_patterns(field_name);
CREATE INDEX idx_extraction_patterns_accuracy ON extraction_patterns(accuracy);

CREATE INDEX idx_ml_metrics_date ON ml_metrics(metric_date);

CREATE INDEX idx_ml_features_extraction ON ml_features(ocr_extraction_id);
CREATE INDEX idx_ml_features_validated ON ml_features(is_validated);

-- Trigger para actualizar updated_at en extraction_patterns
CREATE TRIGGER update_extraction_patterns_updated_at
BEFORE UPDATE ON extraction_patterns
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Vista para análisis de precisión
CREATE OR REPLACE VIEW extraction_accuracy_view AS
SELECT
    field_name,
    COUNT(*) as total_extractions,
    COUNT(CASE WHEN oc.id IS NOT NULL THEN 1 END) as corrections_count,
    ROUND(
        (COUNT(*) - COUNT(CASE WHEN oc.id IS NOT NULL THEN 1 END))::DECIMAL /
        NULLIF(COUNT(*), 0) * 100,
        2
    ) as accuracy_percentage,
    AVG(oe.confidence_score) as avg_confidence
FROM ocr_extractions oe
LEFT JOIN ocr_corrections oc ON oe.id = oc.ocr_extraction_id
GROUP BY field_name;

-- Down Migration (comentado, ejecutar manualmente si es necesario)
-- DROP VIEW IF EXISTS extraction_accuracy_view;
-- DROP TABLE IF EXISTS ml_features;
-- DROP TABLE IF EXISTS ml_metrics;
-- DROP TABLE IF EXISTS extraction_patterns;
-- DROP TABLE IF EXISTS ocr_corrections;
-- DROP TABLE IF EXISTS ocr_extractions;
