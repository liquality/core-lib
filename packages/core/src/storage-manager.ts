import { IStorage, StateType } from './types'

type AsyncStorage = {
  setItem(key: string, value: string): Promise<void>
  getItem(key: string): Promise<string | null>
}

export default function mkStorageManager(AsyncStorage: AsyncStorage) {
  /**
   * Implementation of the StorageManagerI interface for mobile
   */
  return class StorageManager implements IStorage<StateType> {
    excludedProps: Array<keyof StateType>
    storageKey: string

    constructor(storageKey: string, excludedProps: Array<keyof StateType>) {
      this.storageKey = storageKey
      this.excludedProps = excludedProps
    }

    public async write(data: StateType): Promise<boolean | Error> {
      if (!data || Object.keys(data).length === 0) {
        return new Error('Empty data')
      }
      try {
        this.excludedProps.forEach((prop: keyof StateType) => {
          if (Object.hasOwnProperty.call(data, prop)) {
            delete data[prop]
          }
        })
        if (Object.keys(data).length > 0) {
          await AsyncStorage.setItem(this.storageKey, JSON.stringify(data))
          return true
        } else {
          return Error('Can not persist sensitive data')
        }
      } catch (e) {
        return false
      }
    }

    public async read(): Promise<StateType> {
      try {
        const result = await AsyncStorage.getItem(this.storageKey)
        return JSON.parse(result || '') as StateType
      } catch (e) {
        return {}
      }
    }
  }
}
