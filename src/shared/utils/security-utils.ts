/**
 * Security Utilities
 * Enhanced security functions for input validation and sanitization
 */

/**
 * Sanitize string to prevent XSS
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return String(input || '');
  }

  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/<script/gi, '') // Remove script tags
    .replace(/<iframe/gi, '') // Remove iframe tags
    .replace(/<object/gi, '') // Remove object tags
    .replace(/<embed/gi, '') // Remove embed tags
    .replace(/data:text\/html/gi, '') // Remove data URIs
    .replace(/eval\s*\(/gi, '') // Remove eval
    .replace(/expression\s*\(/gi, '') // Remove expression
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
    .trim();
}

/**
 * Validate and sanitize patient history input
 */
export function sanitizePatientHistoryInput(input: any): any {
  if (!input || typeof input !== 'object') {
    return input;
  }

  const sanitized = { ...input };

  // Sanitize string fields
  const stringFields = [
    'reason', 'illness', 'habits', 'exam', 'diagnostic', 'medicalOrder',
    'controlResult', 'comment', 'name', 'lastName', 'idNumber', 'phone', 'email',
    'addressText', 'occupation', 'cie10Code', 'cie10Description',
  ];

  for (const field of stringFields) {
    if (sanitized[field] && typeof sanitized[field] === 'string') {
      sanitized[field] = sanitizeString(sanitized[field]);
    }
  }

  // Recursively sanitize nested objects
  if (sanitized.personalData) {
    sanitized.personalData = sanitizePatientHistoryInput(sanitized.personalData);
  }

  // Sanitize arrays
  const arrayFields = [
    'consultationReason', 'currentIllness', 'patientAnamnese',
    'functionalExam', 'physicalExam', 'diagnostic', 'medicalOrder',
    'control', 'patientDocument',
  ];

  for (const field of arrayFields) {
    if (Array.isArray(sanitized[field])) {
      sanitized[field] = sanitized[field].map(item =>
        sanitizePatientHistoryInput(item)
      );
    }
  }

  return sanitized;
}

/**
 * Validate filename to prevent path traversal
 */
export function validateFilename(filename: string): boolean {
  if (!filename || typeof filename !== 'string') {
    return false;
  }

  // Prevent path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return false;
  }

  // Limit filename length
  if (filename.length > 255) {
    return false;
  }

  // Prevent null bytes
  if (filename.includes('\u0000')) {
    return false;
  }

  return true;
}

/**
 * Generate safe filename
 */
export function generateSafeFilename(originalFilename: string): string {
  if (!originalFilename) {
    return `file_${Date.now()}.bin`;
  }

  // Extract extension
  const ext = originalFilename.split('.').pop() || 'bin';

  // Generate safe name (timestamp + random)
  const safeName = `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;

  return safeName;
}

/**
 * Validate image file content (check magic bytes)
 */
export function validateImageContent(buffer: Buffer): { isValid: boolean; mimeType: string } {
  if (!buffer || buffer.length < 4) {
    return { isValid: false, mimeType: '' };
  }

  // Check magic bytes
  const header = buffer.slice(0, 4);

  // JPEG: FF D8 FF
  if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
    return { isValid: true, mimeType: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
    return { isValid: true, mimeType: 'image/png' };
  }

  // WebP: Check for RIFF...WEBP
  if (buffer.length >= 12) {
    const webpHeader = buffer.slice(0, 12);
    if (webpHeader.toString('ascii', 0, 4) === 'RIFF' &&
        webpHeader.toString('ascii', 8, 12) === 'WEBP') {
      return { isValid: true, mimeType: 'image/webp' };
    }
  }

  return { isValid: false, mimeType: '' };
}

/**
 * Validate PDF file content (check magic bytes and scan for JavaScript)
 */
export function validatePDFContent(buffer: Buffer): { isValid: boolean; hasJavaScript: boolean } {
  if (!buffer || buffer.length < 4) {
    return { isValid: false, hasJavaScript: false };
  }

  // Check PDF magic bytes: %PDF
  const header = buffer.slice(0, 4).toString('ascii');
  if (header !== '%PDF') {
    return { isValid: false, hasJavaScript: false };
  }

  // Scan for JavaScript (basic check)
  const content = buffer.toString('ascii', 0, Math.min(buffer.length, 10000));
  const hasJavaScript = /\/JavaScript|\/JS|\/OpenAction/i.test(content);

  return { isValid: true, hasJavaScript };
}

/**
 * Validate CIE10 code format
 */
export function validateCIE10Code(code: string): boolean {
  if (!code || typeof code !== 'string') {
    return false;
  }

  // CIE10 format: Letter + 2 digits + optional decimal (1-2 digits)
  const cie10Regex = /^[A-Z][0-9]{2}(\.[0-9]{1,2})?$/;
  return cie10Regex.test(code.trim());
}

/**
 * Calculate age from birthday
 */
export function calculateAge(birthday: string | Date): number {
  if (!birthday) {
    return 0;
  }

  const birthDate = typeof birthday === 'string' ? new Date(birthday) : birthday;
  if (isNaN(birthDate.getTime())) {
    return 0;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

/**
 * Validate age matches birthday
 */
export function validateAgeBirthdayConsistency(age: number, birthday: string | Date): boolean {
  if (!age || !birthday) {
    return true; // If missing, don't validate
  }

  const calculatedAge = calculateAge(birthday);
  return Math.abs(age - calculatedAge) <= 1; // Allow 1 year difference for rounding
}

/**
 * Escape special characters for voice transcriptions
 */
export function escapeVoiceTranscription(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/&/g, '&amp;');
}

/**
 * Clean zero-width characters
 */
export function cleanZeroWidthChars(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text.replace(/[\u200B-\u200D\uFEFF]/g, '');
}










