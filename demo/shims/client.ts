import type { DemoDatabase } from "../database";

export type Database = DemoDatabase;
export type Tx = Parameters<Parameters<DemoDatabase["transaction"]>[0]>[0];
