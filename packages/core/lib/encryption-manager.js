"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pbkdf2_1 = __importDefault(require("pbkdf2"));
const crypto_js_1 = require("crypto-js");
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_LENGTH = 32;
const PBKDF2_DIGEST = 'sha256';
class EncryptionManager {
    constructor() {
        this.JsonFormatter = {
            stringify(cipherParams) {
                const jsonObj = {
                    ct: cipherParams.ciphertext.toString(crypto_js_1.enc.Base64)
                };
                if (cipherParams.iv) {
                    jsonObj.iv = cipherParams.iv.toString();
                }
                if (cipherParams.salt) {
                    jsonObj.s = cipherParams.salt.toString();
                }
                return JSON.stringify(jsonObj);
            },
            parse(jsonStr) {
                const jsonObj = JSON.parse(jsonStr);
                const cipherParams = crypto_js_1.lib.CipherParams.create({
                    ciphertext: crypto_js_1.enc.Base64.parse(jsonObj.ct)
                });
                if (jsonObj.iv) {
                    cipherParams.iv = crypto_js_1.enc.Hex.parse(jsonObj.iv);
                }
                if (jsonObj.s) {
                    cipherParams.salt = crypto_js_1.enc.Hex.parse(jsonObj.s);
                }
                return cipherParams;
            }
        };
    }
    generateSalt(byteCount = 32) {
        const view = new Uint8Array(byteCount);
        // @ts-ignore
        global.crypto.getRandomValues(view);
        return global.Buffer.from(String.fromCharCode.apply(null, Array.from(view))).toString('base64');
    }
    encrypt(value, password) {
        return __awaiter(this, void 0, void 0, function* () {
            const keySalt = this.generateSalt(16);
            const derivedKey = yield this.pbkdf2(password, keySalt);
            const rawEncryptedValue = crypto_js_1.AES.encrypt(value, derivedKey);
            return {
                encrypted: this.JsonFormatter.stringify(rawEncryptedValue),
                keySalt
            };
        });
    }
    decrypt(encrypted, keySalt, password) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!keySalt) {
                return '';
            }
            const encryptedValue = this.JsonFormatter.parse(encrypted);
            try {
                const derivedKey = yield this.pbkdf2(password, keySalt);
                const decryptedValue = crypto_js_1.AES.decrypt(encryptedValue, derivedKey);
                return decryptedValue.toString(crypto_js_1.enc.Utf8);
            }
            catch (e) {
                return '';
            }
        });
    }
    pbkdf2(password, salt) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                pbkdf2_1.default.pbkdf2(password, salt, PBKDF2_ITERATIONS, PBKDF2_LENGTH, PBKDF2_DIGEST, (err, derivedKey) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(global.Buffer.from(derivedKey).toString('hex'));
                    }
                });
            });
        });
    }
}
exports.default = EncryptionManager;
//# sourceMappingURL=encryption-manager.js.map