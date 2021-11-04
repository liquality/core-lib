import { EncryptionManagerI } from './types';
export default class EncryptionManager implements EncryptionManagerI {
    generateSalt(byteCount?: number): string;
    encrypt(value: string, password: string): Promise<{
        encrypted: string;
        keySalt: string;
    }>;
    decrypt(encrypted: string, keySalt: string, password: string): Promise<string>;
    private JsonFormatter;
    private pbkdf2;
}
