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
Object.defineProperty(exports, "__esModule", { value: true });
function mkStorageManager(AsyncStorage) {
    /**
     * Implementation of the StorageManagerI interface for mobile
     */
    return class StorageManager {
        constructor(storageKey, excludedProps) {
            this.storageKey = storageKey;
            this.excludedProps = excludedProps;
        }
        persist(data) {
            return __awaiter(this, void 0, void 0, function* () {
                if (!data || Object.keys(data).length === 0) {
                    return new Error('Empty data');
                }
                try {
                    this.excludedProps.forEach((prop) => {
                        if (Object.hasOwnProperty.call(data, prop)) {
                            delete data[prop];
                        }
                    });
                    if (Object.keys(data).length > 0) {
                        yield AsyncStorage.setItem(this.storageKey, JSON.stringify(data));
                        return true;
                    }
                    else {
                        return Error('Can not persist sensitive data');
                    }
                }
                catch (e) {
                    return false;
                }
            });
        }
        read() {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield AsyncStorage.getItem(this.storageKey);
                    return JSON.parse(result || '');
                }
                catch (e) {
                    return {};
                }
            });
        }
    };
}
exports.default = mkStorageManager;
//# sourceMappingURL=storage-manager.js.map