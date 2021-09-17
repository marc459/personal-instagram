import dotenv from "dotenv";
import {
  instagramFollowers,
  instagramHighlights,
  instagramResetProfileAvatar,
  instagramSetFridayProfileAvatar,
  instagramUploadHistory,
  instagramListenEvents,
  spotifySync
} from "./lib/cli";
import Instagram from "./lib/instagram";
import Spotify from "./lib/spotify";
import logger from "./util/logger";
// Load .env environment values.
dotenv.config();

let instagram: Instagram;
let spotify: Spotify;

//-------------------//
// Instagram section //
//-------------------//
if (typeof process.env.INSTAGRAM !== "undefined") {
  instagram = new Instagram({
    username: process.env.IG_USERNAME!,
    password: process.env.IG_PASSWORD!,
    oath: process.env.OATH_KEY!,
  });

  instagram.on("loggedIn", async () => {
    logger.info(
      `Successfully logged in with ${instagram.user.username}'s account!`
    );
    for (let i = 2; i < process.argv.length; i++) {
      const arg = process.argv[i];
      switch (arg) {
        case "--ig-set-friday-profile-avatar":
          await instagramSetFridayProfileAvatar(instagram);
          break;
        case "--ig-reset-profile-avatar":
          await instagramResetProfileAvatar(instagram);
          break;
        case "--ig-upload-history":
          await instagramUploadHistory(instagram);
          break;
        case "--ig-highlights":
          await instagramHighlights(instagram);
          break;
        case "--ig-followers":
          await instagramFollowers(instagram);
          break;
        case "--ig-listen-events":
          await instagramListenEvents(instagram);
          break;
        default:
          logger.warn(`${arg} argument not found!`);
          break;
      }
    }
    process.exit(0);
  });

  instagram.on("error", (error) => {
    logger.error(error);
  });
}

//-------------------//
//  Spotify section  //
//-------------------//
if (typeof process.env.SPOTIFY !== "undefined") {
  spotify = new Spotify({
    clientId: process.env.SPOTIFY_CLIENT_ID!,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
    userId: process.env.SPOTIFY_USER_ID!
  });

  spotify.on("loggedIn", async () => {
    logger.info(
      `Successfully logged in with ${spotify.user.display_name}'s account!`
    );
    for (let i = 2; i < process.argv.length; i++) {
      const arg = process.argv[i];
      switch (arg) {
        case "--sp-sync":
          await spotifySync(spotify);
          break;
        default:
          logger.warn(`${arg} argument not found!`);
          break;
      }
    }
  });

  spotify.on("error", (error) => {
    logger.error(error);
  });
}

export {
  instagram,
  spotify
}
