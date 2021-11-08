"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
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
            return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
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
            return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
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