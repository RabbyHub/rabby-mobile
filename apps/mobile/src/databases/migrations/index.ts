import { SQLiteRenameTablesAddress1737013742818 } from './20250116';
import { UpdateBuyTableAddPayCurrency1740378323012 } from './20250224';
import { UpdateHistoryTableRestart1742289471888 } from './20250321';
import { UpdateTokenItemAddCreditScore1741862198677 } from './20250313';
import { UpdateTokenItemAddCexIds1743518329613 } from './20250401';

export function getMigrations() {
  return [
    SQLiteRenameTablesAddress1737013742818,
    UpdateBuyTableAddPayCurrency1740378323012,
    UpdateHistoryTableRestart1742289471888,
    UpdateTokenItemAddCreditScore1741862198677,
    UpdateTokenItemAddCexIds1743518329613,
  ];
}
