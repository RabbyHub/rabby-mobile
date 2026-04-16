import { NFTItemEntity } from '../entities/nftItem';
import { ProtocolItemEntity } from '../entities/portocolItem';

export const updateExpiredTime = async (_address: string, offest?: number) => {
  const address = _address.toLowerCase();
  try {
    await Promise.all([
      NFTItemEntity.willExpired(address, offest),
      ProtocolItemEntity.willExpired(address, offest),
    ]);
  } catch (error) {
    console.log('update expired', error);
  }
};
