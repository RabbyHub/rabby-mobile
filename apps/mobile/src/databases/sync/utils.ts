import { NFTItemEntity } from '../entities/nftItem';
import { PortocolItemEntity } from '../entities/portocolItem';
import { TokenItemEntity } from '../entities/tokenitem';

export const updateExpiredTime = async (_address: string, offest?: number) => {
  const address = _address.toLowerCase();
  try {
    await Promise.all([
      // TokenItemEntity.willExpired(address, offest),
      NFTItemEntity.willExpired(address, offest),
      PortocolItemEntity.willExpired(address, offest),
    ]);
  } catch (error) {
    console.log('update expired', error);
  }
};
