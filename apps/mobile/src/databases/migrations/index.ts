import { SQLiteRenameTablesAddress1737013742818 } from './20250116';
import { UpdateBuyTableAddPayCurrency1740378323012 } from './20250224';
import { UpdateTokenItemAddCreditScore1741862198677 } from './20250313';
import { UpdateTokenItemAddCexIds1743518329613 } from './20250401';
import { UpdateHistoryTableAddSourceType1744873800025 } from './20250418';
import { UpdateBalanceAddEvmUsdValue1751964116411 } from './20250708';
import { UpdateHistoryTableRestart1753686720048 } from './20250731';
import { UpdateTokenItemAddFdv1754616616128 } from './20250808';
import { UpdateHistoryTableAddCustomType1761706571381 } from './20251029';
import { UpdateTokenItemAddProtocolId1767166930239 } from './20251231';
import { CleanupTables1768475805228 } from './20260115';

export function getMigrations() {
  return [
    SQLiteRenameTablesAddress1737013742818,
    UpdateBuyTableAddPayCurrency1740378323012,
    UpdateTokenItemAddCreditScore1741862198677,
    UpdateTokenItemAddCexIds1743518329613,
    UpdateHistoryTableAddSourceType1744873800025,
    UpdateBalanceAddEvmUsdValue1751964116411,
    UpdateHistoryTableRestart1753686720048,
    UpdateTokenItemAddFdv1754616616128,
    UpdateHistoryTableAddCustomType1761706571381,
    UpdateTokenItemAddProtocolId1767166930239,
    CleanupTables1768475805228,
  ];
}
