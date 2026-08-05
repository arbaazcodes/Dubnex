import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePassword,
  validateDisplayName,
  validatePhoneE164,
  validateOtpCode,
  mapAuthError,
} from '../lib/firebase';

describe('auth validation', () => {
  it('validateEmail', () => {
    expect(validateEmail('')).toMatch(/required/i);
    expect(validateEmail('nope')).toMatch(/valid/i);
    expect(validateEmail('you@example.com')).toBeNull();
  });

  it('validatePassword', () => {
    expect(validatePassword('')).toMatch(/required/i);
    expect(validatePassword('123')).toMatch(/6 characters/i);
    expect(validatePassword('123456')).toBeNull();
    expect(validatePassword('1234567', { isNew: true })).toMatch(/8 characters/i);
    expect(validatePassword('12345678', { isNew: true })).toBeNull();
  });

  it('validateDisplayName', () => {
    expect(validateDisplayName('')).toMatch(/required/i);
    expect(validateDisplayName('A')).toMatch(/2 characters/i);
    expect(validateDisplayName('Ada')).toBeNull();
  });

  it('validatePhoneE164', () => {
    expect(validatePhoneE164('')).toMatch(/required/i);
    expect(validatePhoneE164('5551234')).toMatch(/international/i);
    expect(validatePhoneE164('+14155552671')).toBeNull();
    expect(validatePhoneE164('+1 (415) 555-2671')).toBeNull();
  });

  it('validateOtpCode', () => {
    expect(validateOtpCode('')).toMatch(/required/i);
    expect(validateOtpCode('12')).toMatch(/6-digit/i);
    expect(validateOtpCode('123456')).toBeNull();
  });
});

describe('mapAuthError', () => {
  it('maps known Firebase codes to friendly copy', () => {
    expect(mapAuthError({ code: 'auth/invalid-credential', message: 'Firebase: x' })).toMatch(
      /Incorrect email or password/i
    );
    expect(mapAuthError({ code: 'auth/email-already-in-use', message: 'Firebase: x' })).toMatch(
      /already exists/i
    );
    expect(mapAuthError({ code: 'auth/invalid-phone-number', message: 'Firebase: x' })).toMatch(
      /phone number/i
    );
    expect(mapAuthError({ code: 'auth/popup-closed-by-user', message: 'Firebase: x' })).toMatch(
      /popup was closed/i
    );
  });

  it('passes through non-Firebase Error messages', () => {
    expect(mapAuthError(new Error('Custom validation failed'))).toBe('Custom validation failed');
  });
});
