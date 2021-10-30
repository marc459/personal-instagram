import { AccountFollowersFeedResponseUsersItem } from 'instagram-private-api';

export {};

declare global {
  interface InstagramConnectionParams {
    /** Username to login with */
    username: string;
    /** The password to use with the login */
    password: string;
    /** The 2fa oath secret to generate code */
    oath?: string;
  }
}

declare module 'instagram-private-api/dist/repositories/friendship.repository' {
  interface FriendshipRepository {
    leastInteractedWith(): Promise<AccountFollowersFeedResponseUsersItem[]>;
  }
}
