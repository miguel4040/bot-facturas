import pool from '../config/database';

export interface OCRExtraction {
  id?: number;
  factura_id: number;
  raw_text: string;
  preprocessed_text?: string;
  extracted_data?: any;
  confidence_score?: number;
  ocr_method?: string;
  processing_time_ms?: number;
  created_at?: Date;
}

export interface OCRCorrection {
  id?: number;
  ocr_extraction_id: number;
  field_name: string;
  extracted_value?: string;
  corrected_value: string;
  corrected_by?: string;
  correction_source?: string;
  created_at?: Date;
}

export interface ExtractionPattern {
  id?: number;
  field_name: string;
  pattern_type: string;
  pattern_value: string;
  confidence_weight?: number;
  success_count?: number;
  failure_count?: number;
  accuracy?: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface MLMetric {
  id?: number;
  metric_date: Date;
  total_extractions?: number;
  successful_extractions?: number;
  corrections_needed?: number;
  average_confidence?: number;
  accuracy_by_field?: any;
  created_at?: Date;
}

export interface MLFeature {
  id?: number;
  ocr_extraction_id: number;
  features: any;
  label?: any;
  is_validated?: boolean;
  created_at?: Date;
}

export class MLModel {
  // OCR Extractions
  static async createExtraction(extraction: OCRExtraction): Promise<OCRExtraction> {
    const query = `
      INSERT INTO ocr_extractions
        (factura_id, raw_text, preprocessed_text, extracted_data, confidence_score,
         ocr_method, processing_time_ms)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      extraction.factura_id,
      extraction.raw_text,
      extraction.preprocessed_text || null,
      extraction.extracted_data ? JSON.stringify(extraction.extracted_data) : null,
      extraction.confidence_score || null,
      extraction.ocr_method || null,
      extraction.processing_time_ms || null,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async getExtractionById(id: number): Promise<OCRExtraction | null> {
    const query = 'SELECT * FROM ocr_extractions WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async getExtractionsByFactura(facturaId: number): Promise<OCRExtraction[]> {
    const query = 'SELECT * FROM ocr_extractions WHERE factura_id = $1 ORDER BY created_at DESC';
    const result = await pool.query(query, [facturaId]);
    return result.rows;
  }

  // OCR Corrections
  static async createCorrection(correction: OCRCorrection): Promise<OCRCorrection> {
    const query = `
      INSERT INTO ocr_corrections
        (ocr_extraction_id, field_name, extracted_value, corrected_value,
         corrected_by, correction_source)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      correction.ocr_extraction_id,
      correction.field_name,
      correction.extracted_value || null,
      correction.corrected_value,
      correction.corrected_by || null,
      correction.correction_source || 'manual',
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async getCorrectionsByExtraction(extractionId: number): Promise<OCRCorrection[]> {
    const query = 'SELECT * FROM ocr_corrections WHERE ocr_extraction_id = $1';
    const result = await pool.query(query, [extractionId]);
    return result.rows;
  }

  static async getAllCorrections(limit: number = 100): Promise<OCRCorrection[]> {
    const query = 'SELECT * FROM ocr_corrections ORDER BY created_at DESC LIMIT $1';
    const result = await pool.query(query, [limit]);
    return result.rows;
  }

  // Extraction Patterns
  static async createPattern(pattern: ExtractionPattern): Promise<ExtractionPattern> {
    const query = `
      INSERT INTO extraction_patterns
        (field_name, pattern_type, pattern_value, confidence_weight)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const values = [
      pattern.field_name,
      pattern.pattern_type,
      pattern.pattern_value,
      pattern.confidence_weight || 1.0,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async getPatternsByField(fieldName: string): Promise<ExtractionPattern[]> {
    const query = `
      SELECT * FROM extraction_patterns
      WHERE field_name = $1
      ORDER BY accuracy DESC NULLS LAST, confidence_weight DESC
    `;
    const result = await pool.query(query, [fieldName]);
    return result.rows;
  }

  static async updatePatternStats(
    patternId: number,
    success: boolean
  ): Promise<ExtractionPattern | null> {
    const query = `
      UPDATE extraction_patterns
      SET
        success_count = success_count + $2,
        failure_count = failure_count + $3,
        accuracy = CASE
          WHEN (success_count + failure_count + $2 + $3) > 0
          THEN (success_count + $2)::DECIMAL / (success_count + failure_count + $2 + $3) * 100
          ELSE 0
        END
      WHERE id = $1
      RETURNING *
    `;

    const successIncrement = success ? 1 : 0;
    const failureIncrement = success ? 0 : 1;

    const result = await pool.query(query, [patternId, successIncrement, failureIncrement]);
    return result.rows[0] || null;
  }

  // ML Metrics
  static async createOrUpdateMetric(date: Date, metrics: Partial<MLMetric>): Promise<MLMetric> {
    const query = `
      INSERT INTO ml_metrics
        (metric_date, total_extractions, successful_extractions, corrections_needed,
         average_confidence, accuracy_by_field)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (metric_date)
      DO UPDATE SET
        total_extractions = EXCLUDED.total_extractions,
        successful_extractions = EXCLUDED.successful_extractions,
        corrections_needed = EXCLUDED.corrections_needed,
        average_confidence = EXCLUDED.average_confidence,
        accuracy_by_field = EXCLUDED.accuracy_by_field
      RETURNING *
    `;

    // Primero crear índice único si no existe
    try {
      await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_ml_metrics_date_unique ON ml_metrics(metric_date)');
    } catch (error) {
      // Índice ya existe
    }

    const values = [
      date,
      metrics.total_extractions || 0,
      metrics.successful_extractions || 0,
      metrics.corrections_needed || 0,
      metrics.average_confidence || 0,
      metrics.accuracy_by_field ? JSON.stringify(metrics.accuracy_by_field) : null,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async getMetricsByDateRange(startDate: Date, endDate: Date): Promise<MLMetric[]> {
    const query = `
      SELECT * FROM ml_metrics
      WHERE metric_date BETWEEN $1 AND $2
      ORDER BY metric_date DESC
    `;
    const result = await pool.query(query, [startDate, endDate]);
    return result.rows;
  }

  // ML Features
  static async createFeature(feature: MLFeature): Promise<MLFeature> {
    const query = `
      INSERT INTO ml_features
        (ocr_extraction_id, features, label, is_validated)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const values = [
      feature.ocr_extraction_id,
      JSON.stringify(feature.features),
      feature.label ? JSON.stringify(feature.label) : null,
      feature.is_validated || false,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async getValidatedFeatures(limit: number = 1000): Promise<MLFeature[]> {
    const query = `
      SELECT * FROM ml_features
      WHERE is_validated = true
      ORDER BY created_at DESC
      LIMIT $1
    `;
    const result = await pool.query(query, [limit]);
    return result.rows;
  }

  static async updateFeatureValidation(id: number, validated: boolean, label?: any): Promise<MLFeature | null> {
    const query = `
      UPDATE ml_features
      SET is_validated = $2, label = $3
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id, validated, label ? JSON.stringify(label) : null]);
    return result.rows[0] || null;
  }

  // Analytics
  static async getExtractionAccuracy(): Promise<any[]> {
    const query = 'SELECT * FROM extraction_accuracy_view';
    const result = await pool.query(query);
    return result.rows;
  }

  static async getRecentExtractions(limit: number = 50): Promise<any[]> {
    const query = `
      SELECT
        oe.*,
        f.rfc,
        f.status as factura_status,
        COUNT(oc.id) as corrections_count
      FROM ocr_extractions oe
      JOIN facturas f ON oe.factura_id = f.id
      LEFT JOIN ocr_corrections oc ON oe.id = oc.ocr_extraction_id
      GROUP BY oe.id, f.id
      ORDER BY oe.created_at DESC
      LIMIT $1
    `;
    const result = await pool.query(query, [limit]);
    return result.rows;
  }
}
