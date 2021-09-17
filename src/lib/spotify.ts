import EventEmitter from "events";
import logger from "../util/logger";
import SpotifyWebApi from "spotify-web-api-node";

class Spotify extends EventEmitter {
  readonly config: SpotifyConnectionParams;
  public cl: SpotifyWebApi;
  public user: SpotifyApi.UserProfileResponse;

  constructor(config: SpotifyConnectionParams) {
    super();
    logger.debug("Initializing Spotify client...");
    this.login(config);
  }

  private async login(config: SpotifyConnectionParams) {
    try {
      if (
        typeof config.clientId === "undefined" ||
        typeof config.clientSecret === "undefined" ||
        typeof config.userId === "undefined"
      ) {
        throw Error(
          "SPOTIFY_CLIENT_ID, SPOTIFY_USER OR SPOTIFY_CLIENT_SECRET environment variables are not set!"
        );
      }
      this.cl = new SpotifyWebApi({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
      });
      await this.syncCredentials();
      this.user = (await this.cl.getUser(config.userId!)).body;
      super.emit("loggedIn");
    } catch (error) {
      this.emit("error", error.message);
    }
  }

  private async syncCredentials(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.cl.clientCredentialsGrant().then(
        (data) => {
          this.cl.setAccessToken(data.body.access_token);
          resolve(true);
        },
        function (err) {
          reject(
            "Something went wrong when retrieving an access token: " +
              err.message
          );
        }
      );
    });
  }

  public async getSongAnalysis(trackId: string): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const analysis = await this.cl.getAudioAnalysisForTrack(trackId);
      resolve(analysis)
    });
  }
}

export default Spotify;
