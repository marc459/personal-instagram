export {};

declare global {
  interface SerializedSession {
    cookies: string;
    supportedCapabilities: [
      {
        name: string;
        value: string;
      },
      {
        name: string;
        value: 12;
      },
      {
        name: string;
        value: string;
      },
      {
        name: string;
        value: string;
      },
      {
        name: string;
        value: string;
      },
      {
        name: string;
        value: string;
      }
    ];
    language: string;
    timezoneOffset: string;
    radioType: string;
    capabilitiesHeader: string;
    connectionTypeHeader: string;
    isLayoutRTL: false;
    adsOptOut: false;
    thumbnailCacheBustingValue: number;
    clientSessionIdLifetime: number;
    pigeonSessionIdLifetime: number;
    deviceString: string;
    deviceId: string;
    uuid: string;
    phoneId: string;
    adid: string;
    build: string;
    igWWWClaim: string;
    passwordEncryptionKeyId: string;
    passwordEncryptionPubKey: string;
  }
}
