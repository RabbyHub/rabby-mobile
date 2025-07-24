import { Entity, Column, In, PrimaryColumn } from 'typeorm/browser';
import { EntityBaseWithoutId } from './base';
import { textBlobTransformer } from './_helpers';

export type MediaItem = {
  key: string;
  purpose: 'address-avatar';
  data: string | null;
  mediaType: string;
};

@Entity('media')
export class MediaEntity extends EntityBaseWithoutId {
  @PrimaryColumn('text', { default: '' })
  key: string = '';

  @Column('text', { default: '' })
  purpose: MediaItem['purpose'] = 'address-avatar';

  @Column('text', { default: '' })
  mediaType: string = '';

  @Column('blob', {
    default: null,
    nullable: true /* transformer: textBlobTransformer */,
  })
  data: string | null = null;

  static fillEntity(e: MediaEntity, key: string, input: Partial<MediaItem>) {
    if (e.key !== undefined) e.key = input.key!;
    if (e.purpose !== undefined) e.purpose = input.purpose!;
    if (e.mediaType !== undefined) e.mediaType = input.mediaType!;

    if (e.data !== undefined) e.data = input.data!;
  }

  static async getAvatarsByAddresses(address: string | string[]) {
    const addressList = Array.isArray(address) ? address : [address];
    return MediaEntity.getRepository<MediaEntity>().find({
      where: { key: In(addressList) },
    });
  }

  static async removeByAvatarAddress(address: string | string[]) {
    const addressList = Array.isArray(address) ? address : [address];
    return MediaEntity.getRepository<MediaEntity>().delete({
      key: In(addressList),
    });
  }

  static async addAddressAvatar(address: string, avatarInput: Blob | string) {
    const mediaEntity = new MediaEntity();
    mediaEntity.key = address;
    const avatarString =
      typeof avatarInput === 'string'
        ? avatarInput
        : URL.createObjectURL(avatarInput);
    mediaEntity.data = avatarString;

    return MediaEntity.getRepository<MediaEntity>().upsert(mediaEntity, {
      conflictPaths: ['key'],
    });
  }
}
