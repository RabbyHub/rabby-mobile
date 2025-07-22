import { SQLiteRenameTablesAddress1737013742818 } from './20250116';
import { UpdateBuyTableAddPayCurrency1740378323012 } from './20250224';
import { UpdateTokenItemAddCreditScore1741862198677 } from './20250313';
import { UpdateTokenItemAddCexIds1743518329613 } from './20250401';
import { UpdateHistoryTableAddSourceType1744873800025 } from './20250418';
import { UpdateBalanceAddEvmUsdValue1751964116411 } from './20250708';
import { UpdateHistoryTableRestart1753167283999 } from './20250725';

export function getMigrations() {
  return [
    SQLiteRenameTablesAddress1737013742818,
    UpdateBuyTableAddPayCurrency1740378323012,
    UpdateTokenItemAddCreditScore1741862198677,
    UpdateTokenItemAddCexIds1743518329613,
    UpdateHistoryTableAddSourceType1744873800025,
    UpdateBalanceAddEvmUsdValue1751964116411,
    UpdateHistoryTableRestart1753167283999,
  ];
}
