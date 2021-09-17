import SpotifyWebApi from "spotify-web-api-node";

declare global {
  interface SpotifyConnectionParams {
    /** Client Id */
    clientId: string;
    /** The client secret */
    clientSecret: string;
    /** The user ud */
    userId: string;
  }

  interface Spotify {
    on(event: 'error', listener: (error: Error) => void): this;
		on(event: 'ready', listener: () => void): this;
		on(event: 'launch', listener: () => void): this;
		on(event: 'projects:queue:finished', listener: () => void): this;
		on(event: 'pdf:queue:finished', listener: () => void): this;
		on(event: 'git:queue:finished', listener: () => void): this;
		cl: SpotifyWebApi;
	}

  interface SpotifyResponse<T> {
    body: T;
    headers: Record<string, string>;
    statusCode: number;
  }
}
