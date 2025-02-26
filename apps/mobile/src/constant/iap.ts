import { BigNumber } from 'bignumber.js';

export const gasAccountProducts = [
  {
    id: 'test1001',
    total: '0.3',
    price: '0.3',
  },
  {
    id: '0001',
    total: '0.29',
    price: '0.2',
  },
  {
    id: '0002',
    total: '0.99',
    price: '0.69',
  },
  {
    id: '0003',
    total: '2.99',
    price: '2.09',
  },
  {
    id: '0004',
    total: '4.99',
    price: '3.49',
  },
  {
    id: '0005',
    total: '9.99',
    price: '6.99',
  },
  {
    id: '0006',
    total: '29.99',
    price: '20.99',
  },
  {
    id: '0007',
    total: '59.99',
    price: '41.99',
  },
  {
    id: '0008',
    total: '99.99',
    price: '69.99',
  },
].map(item => {
  return {
    ...item,
    fee: new BigNumber(item.total).minus(item.price).toString(),
  };
});
