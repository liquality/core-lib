import { DataMapperI, FlatState, StateType } from './types';
import BigNumber from 'bignumber.js';
/**
 * A class that converts raw state to computed state to abstract the complexity from the UI
 */
export default class DataMapper implements DataMapperI<StateType, FlatState> {
    state: StateType;
    totalBalance: BigNumber;
    assetCount: number;
    constructor(state: StateType);
    process(): DataMapper;
    toJson(): FlatState;
}
