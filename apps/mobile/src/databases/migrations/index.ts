import { SQLiteRenameTablesAddress1737013742818 } from './20250116';
import { UpdateBuyTableAddPayCurrency1740378323012 } from './20250224';
import { UpdateHistoryTableRestart1742289471888 } from './20250321';

export function getMigrations() {
  return [
    SQLiteRenameTablesAddress1737013742818,
    UpdateBuyTableAddPayCurrency1740378323012,
    UpdateHistoryTableRestart1742289471888,
  ];
}
