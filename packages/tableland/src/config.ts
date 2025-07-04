import { Database } from '@tableland/sdk';
import { Wallet } from '@tableland/sdk';

// Base Sepolia chain ID
export const BASE_SEPOLIA_CHAIN_ID = 84532;

// Tableland prefix for Base Sepolia
export const TABLE_PREFIX = 'cloe_meals';

export interface TablelandConfig {
  chainId: number;
  prefix: string;
}