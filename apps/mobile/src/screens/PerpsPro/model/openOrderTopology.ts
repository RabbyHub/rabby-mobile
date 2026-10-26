import type { OpenOrder } from '@rabby-wallet/hyperliquid-sdk';

export interface PerpsOpenOrderTopologyNode {
  isTopLevel: boolean;
  order: OpenOrder;
  parentOid: number | null;
  rootParentOid: number | null;
}

export interface PerpsOpenOrderTopology {
  nodes: readonly PerpsOpenOrderTopologyNode[];
  nodesByCoin: ReadonlyMap<string, readonly PerpsOpenOrderTopologyNode[]>;
  topLevelNodesByCoin: ReadonlyMap<
    string,
    readonly PerpsOpenOrderTopologyNode[]
  >;
}

const appendNodeByCoin = (
  map: Map<string, PerpsOpenOrderTopologyNode[]>,
  node: PerpsOpenOrderTopologyNode,
) => {
  const existing = map.get(node.order.coin);
  if (existing) {
    existing.push(node);
    return;
  }
  map.set(node.order.coin, [node]);
};

export const buildPerpsOpenOrderTopology = (
  orders: readonly OpenOrder[],
): PerpsOpenOrderTopology => {
  const nodes: PerpsOpenOrderTopologyNode[] = [];
  const nodesByCoin = new Map<string, PerpsOpenOrderTopologyNode[]>();
  const indexedOrders = new Set<OpenOrder>();
  const nestedOrderIds = new Set<number>();
  const seen = new Set<number>();
  const topLevelNodesByCoin = new Map<string, PerpsOpenOrderTopologyNode[]>();

  /**
   * Hyperliquid repeats normalTpsl children in the outer snapshot before also
   * nesting them under their unfilled parent. Discover every explicit child
   * relationship first so input order cannot promote those duplicate outer
   * entries to roots.
   */
  const collectNestedOrderIds = (currentOrders: readonly OpenOrder[]) => {
    for (const order of currentOrders) {
      if (indexedOrders.has(order)) {
        continue;
      }
      indexedOrders.add(order);
      const children = order.children;
      if (!children?.length) {
        continue;
      }
      for (const child of children) {
        nestedOrderIds.add(child.oid);
      }
      collectNestedOrderIds(children);
    }
  };

  collectNestedOrderIds(orders);

  const visit = (
    currentOrders: readonly OpenOrder[],
    parentOid: number | null,
    rootParentOid: number | null,
  ) => {
    for (const order of currentOrders) {
      if (seen.has(order.oid)) {
        continue;
      }
      seen.add(order.oid);
      const isTopLevel = parentOid === null;
      const node: PerpsOpenOrderTopologyNode = {
        isTopLevel,
        order,
        parentOid,
        rootParentOid,
      };
      nodes.push(node);
      appendNodeByCoin(nodesByCoin, node);
      if (isTopLevel) {
        appendNodeByCoin(topLevelNodesByCoin, node);
      }

      if (order.children?.length) {
        visit(
          order.children,
          order.oid,
          isTopLevel ? order.oid : rootParentOid,
        );
      }
    }
  };

  visit(
    orders.filter(order => !nestedOrderIds.has(order.oid)),
    null,
    null,
  );

  // Keep malformed or cyclic snapshots observable without allowing them to
  // change the identity of roots that were established above.
  visit(
    orders.filter(order => !seen.has(order.oid)),
    null,
    null,
  );
  return { nodes, nodesByCoin, topLevelNodesByCoin };
};
