/**
 * Valida RFC mexicano
 * Formato: 3-4 letras + FECHA(AAMMDD) + 3 caracteres alfanuméricos
 * La fecha debe ser válida (mes 01-12, día 01-31)
 */
export function isValidRFC(rfc: string): boolean {
  // Regex oficial para RFC mexicano con validación de fecha
  // 3-4 letras + Año(2 dígitos) + Mes(01-12) + Día(01-31) + 3 caracteres
  const rfcRegex = /^([A-Z,Ñ,&]{3,4}([0-9]{2})(0[1-9]|1[0-2])(0[1-9]|1[0-9]|2[0-9]|3[0-1])[A-Z|\d]{3})$/;

  return rfcRegex.test(rfc.toUpperCase());
}

/**
 * Valida que una fecha sea válida
 */
export function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Valida formato de teléfono (10 dígitos)
 */
export function isValidPhone(phone: string): boolean {
  return /^\d{10}$/.test(phone.replace(/\D/g, ''));
}

/**
 * Limpia y formatea un número de teléfono
 */
export function cleanPhone(phone: string): string {
  return phone.replace(/\D/g, '');
}
