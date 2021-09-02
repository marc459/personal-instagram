import { Feed } from 'instagram-private-api';

export const getAllItemsFromFeed = async function <T>(
  feed: Feed<any, T>
): Promise<T[]> {
  let items = [];
  do {
    // @ts-ignore
    items = items.concat(await feed.items());
  } while (feed.isMoreAvailable());
  return items;
};
