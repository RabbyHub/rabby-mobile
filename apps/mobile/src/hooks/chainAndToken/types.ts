export {
  type AbstractProject,
  type AbstractPortfolio,
  type AbstractPortfolioToken,
  type PortfolioProject,
} from '@/screens/Home/types';

export type TokenItemForRender = {
  id: string;
  _logo: string;
  amount: number;
  _symbol: string;
  _amount: string;
  _netWorth: number;
  _netWorthStr: string;
  isToken?: boolean;
  tip?: string;
};
