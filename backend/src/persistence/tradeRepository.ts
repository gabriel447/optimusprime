import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database, { type Database as DB } from 'better-sqlite3';
import type { StrategyName } from '../strategies/types.js';
import { logger } from '../utils/logger.js';

export interface PersistedTrade {
  id: string;
  strategy: StrategyName;
  direction: 'buy' | 'sell';
  entry: number;
  stop: number;
  target: number;
  amount: number;
  riskUsdt: number;
  entryOrderId: string | null;
  stopOrderId: string | null;
  targetOrderId: string | null;
  openedAt: number;
  closedAt: number | null;
  closePrice: number | null;
  outcome: 'target' | 'stop' | 'timeout' | null;
}

interface TradeRow {
  id: string;
  strategy: string;
  direction: string;
  entry: number;
  stop: number;
  target: number;
  amount: number;
  risk_usdt: number;
  entry_order_id: string | null;
  stop_order_id: string | null;
  target_order_id: string | null;
  opened_at: number;
  closed_at: number | null;
  close_price: number | null;
  outcome: string | null;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  strategy TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('buy', 'sell')),
  entry REAL NOT NULL,
  stop REAL NOT NULL,
  target REAL NOT NULL,
  amount REAL NOT NULL,
  risk_usdt REAL NOT NULL,
  entry_order_id TEXT,
  stop_order_id TEXT,
  target_order_id TEXT,
  opened_at INTEGER NOT NULL,
  closed_at INTEGER,
  close_price REAL,
  outcome TEXT CHECK(outcome IN ('target', 'stop', 'timeout'))
);

CREATE INDEX IF NOT EXISTS idx_trades_opened_at ON trades(opened_at DESC);
`;

const MIGRATIONS = [
  `ALTER TABLE trades ADD COLUMN entry_order_id TEXT`,
  `ALTER TABLE trades ADD COLUMN stop_order_id TEXT`,
  `ALTER TABLE trades ADD COLUMN target_order_id TEXT`,
];

export class TradeRepository {
  private readonly db: DB;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(SCHEMA);
    this.migrate();
    logger.info('persistence', `SQLite pronto em ${dbPath}`);
  }

  private migrate(): void {
    for (const sql of MIGRATIONS) {
      try { this.db.exec(sql); } catch { /* coluna já existe */ }
    }
    this.migrateOutcomeCheck();
  }

  private migrateOutcomeCheck(): void {
    const row = this.db
      .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='trades'`)
      .get() as { sql: string } | undefined;
    if (!row || row.sql.includes("'timeout'")) return;

    this.db.exec(`
      BEGIN TRANSACTION;
      DROP INDEX IF EXISTS idx_trades_opened_at;
      ALTER TABLE trades RENAME TO trades_old_outcome_v1;
      CREATE TABLE trades (
        id TEXT PRIMARY KEY,
        strategy TEXT NOT NULL,
        direction TEXT NOT NULL CHECK(direction IN ('buy', 'sell')),
        entry REAL NOT NULL,
        stop REAL NOT NULL,
        target REAL NOT NULL,
        amount REAL NOT NULL,
        risk_usdt REAL NOT NULL,
        entry_order_id TEXT,
        stop_order_id TEXT,
        target_order_id TEXT,
        opened_at INTEGER NOT NULL,
        closed_at INTEGER,
        close_price REAL,
        outcome TEXT CHECK(outcome IN ('target', 'stop', 'timeout'))
      );
      INSERT INTO trades
        (id, strategy, direction, entry, stop, target, amount, risk_usdt,
         entry_order_id, stop_order_id, target_order_id,
         opened_at, closed_at, close_price, outcome)
      SELECT
        id, strategy, direction, entry, stop, target, amount, risk_usdt,
        entry_order_id, stop_order_id, target_order_id,
        opened_at, closed_at, close_price, outcome
      FROM trades_old_outcome_v1;
      DROP TABLE trades_old_outcome_v1;
      CREATE INDEX IF NOT EXISTS idx_trades_opened_at ON trades(opened_at DESC);
      COMMIT;
    `);
    logger.info('persistence', 'migração: outcome CHECK ampliado para incluir timeout');
  }

  insert(trade: PersistedTrade): void {
    this.db
      .prepare(
        `INSERT INTO trades
           (id, strategy, direction, entry, stop, target, amount, risk_usdt,
            entry_order_id, stop_order_id, target_order_id,
            opened_at, closed_at, close_price, outcome)
         VALUES
           (@id, @strategy, @direction, @entry, @stop, @target, @amount, @riskUsdt,
            @entryOrderId, @stopOrderId, @targetOrderId,
            @openedAt, @closedAt, @closePrice, @outcome)`,
      )
      .run({
        id: trade.id,
        strategy: trade.strategy,
        direction: trade.direction,
        entry: trade.entry,
        stop: trade.stop,
        target: trade.target,
        amount: trade.amount,
        riskUsdt: trade.riskUsdt,
        entryOrderId: trade.entryOrderId,
        stopOrderId: trade.stopOrderId,
        targetOrderId: trade.targetOrderId,
        openedAt: trade.openedAt,
        closedAt: trade.closedAt,
        closePrice: trade.closePrice,
        outcome: trade.outcome,
      });
  }

  close(id: string, closePrice: number, outcome: 'target' | 'stop' | 'timeout', closedAt: number): void {
    const result = this.db
      .prepare(
        `UPDATE trades
            SET closed_at = @closedAt, close_price = @closePrice, outcome = @outcome
          WHERE id = @id`,
      )
      .run({ id, closedAt, closePrice, outcome });
    if (result.changes === 0) {
      logger.warn('persistence', `update sem efeito — trade ${id} não encontrado`);
    }
  }

  findAll(): PersistedTrade[] {
    const rows = this.db
      .prepare(`SELECT * FROM trades ORDER BY opened_at DESC`)
      .all() as TradeRow[];
    return rows.map(rowToTrade);
  }

  findOpen(): PersistedTrade | null {
    const row = this.db
      .prepare(`SELECT * FROM trades WHERE closed_at IS NULL ORDER BY opened_at DESC LIMIT 1`)
      .get() as TradeRow | undefined;
    return row ? rowToTrade(row) : null;
  }

  close_(): void {
    this.db.close();
  }
}

function rowToTrade(r: TradeRow): PersistedTrade {
  return {
    id: r.id,
    strategy: r.strategy as StrategyName,
    direction: r.direction as 'buy' | 'sell',
    entry: r.entry,
    stop: r.stop,
    target: r.target,
    amount: r.amount,
    riskUsdt: r.risk_usdt,
    entryOrderId: r.entry_order_id,
    stopOrderId: r.stop_order_id,
    targetOrderId: r.target_order_id,
    openedAt: r.opened_at,
    closedAt: r.closed_at,
    closePrice: r.close_price,
    outcome: r.outcome as 'target' | 'stop' | 'timeout' | null,
  };
}
