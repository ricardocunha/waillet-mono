import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../../src/utils/crypto';

describe('Crypto Utils', () => {
  const testPassword = 'MySecurePassword123!';
  const testText = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  describe('encrypt', () => {
    it('should encrypt text with password', async () => {
      const encrypted = await encrypt(testText, testPassword);
      
      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(testText);
      expect(typeof encrypted).toBe('string');
    });

    it('should produce different encrypted output each time (due to random salt/iv)', async () => {
      const encrypted1 = await encrypt(testText, testPassword);
      const encrypted2 = await encrypt(testText, testPassword);
      
      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe('decrypt', () => {
    it('should decrypt encrypted text with correct password', async () => {
      const encrypted = await encrypt(testText, testPassword);
      const decrypted = await decrypt(encrypted, testPassword);
      
      expect(decrypted).toBe(testText);
    });

    it('should fail to decrypt with wrong password', async () => {
      const encrypted = await encrypt(testText, testPassword);
      
      await expect(
        decrypt(encrypted, 'WrongPassword')
      ).rejects.toThrow();
    });

    it('should handle special characters in text', async () => {
      const specialText = 'Test with émojis 🔐 and symbols @#$%';
      const encrypted = await encrypt(specialText, testPassword);
      const decrypted = await decrypt(encrypted, testPassword);
      
      expect(decrypted).toBe(specialText);
    });
  });

  describe('encryption strength', () => {
    it('should use different encryption for different passwords', async () => {
      const encrypted1 = await encrypt(testText, 'password1');
      const encrypted2 = await encrypt(testText, 'password2');
      
      expect(encrypted1).not.toBe(encrypted2);
    });
  });
});

