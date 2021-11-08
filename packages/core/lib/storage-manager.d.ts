import { StateType } from './types';
declare type AsyncStorage = {
    setItem(key: string, value: string): Promise<unknown>;
    getItem(key: string): Promise<string>;
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
