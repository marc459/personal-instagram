export {};

declare global {
  interface ConnectionParams {
    /** Username to login with */
    username: string;
    /** The password to use with the login */
    password: string;
    /** The 2fa oath secret to generate code */
    oath: string;
  }

  interface Intranet {
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: 'loggedIn', listener: () => void): this;
  }
}