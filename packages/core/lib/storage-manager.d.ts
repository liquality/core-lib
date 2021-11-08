import { StateType } from './types';
declare type AsyncStorage = {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
};
export default function mkStorageManager(AsyncStorage: AsyncStorage): {
    new (storageKey: string, excludedProps: Array<keyof StateType>): {
        excludedProps: Array<keyof StateType>;
        storageKey: string;
        persist(data: StateType): Promise<boolean | Error>;
        read(): Promise<StateType>;
    };
};
export {};
