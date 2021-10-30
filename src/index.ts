import dotenv from "dotenv";
import { Socket } from "net";
import ipc from "node-ipc";
import {
  instagramFollowers,
  instagramHighlights,
  instagramResetProfileAvatar,
  instagramSetFridayProfileAvatar,
  instagramUploadHistory,
  instagramListenEvents,
  instagramMusicTest,
  spotifySync,
} from "./lib/cli";
import Instagram from "./lib/instagram";
import Spotify from "./lib/spotify";
import logger from "./util/logger";
import "./server"

// Load .env environment values.
dotenv.config();

let instagram: Instagram;
let instagramSec: Instagram;
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
    logger.info(`Successfully logged in instagram with ${instagram.user.username}'s account!`);
  });

  instagram.on("error", (error) => {
    logger.error(error);
  });

  instagramSec = new Instagram({
    username: process.env.IG_USERNAME_SEC!,
    password: process.env.IG_PASSWORD_SEC!
  });

  instagramSec.on("loggedIn", async () => {
    logger.info(`Successfully logged in instagram with ${instagramSec.user.username}'s account!`);
  });

  instagramSec.on("error", (error) => {
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
    userId: process.env.SPOTIFY_USER_ID!,
  });

  spotify.on("loggedIn", async () => {
    logger.info(`Successfully logged in with ${spotify.user.display_name}'s account!`);
  });

  spotify.on("error", (error) => {
    logger.error(error);
  });
}

//-------------------//
//  Shared section   //
//-------------------//
ipc.config.id = "shared";
ipc.config.silent = true;

ipc.serve(function () {
  ipc.server.on("message", async (message, socket: Socket) => {
    switch (message.event) {
      case "ig-set-friday-profile-avatar":
        await instagramSetFridayProfileAvatar(instagram);
        break;
      case "ig-reset-profile-avatar":
        await instagramResetProfileAvatar(instagram);
        break;
      case "ig-upload-history":
        await instagramUploadHistory(instagram);
        break;
      case "ig-highlights":
        await instagramHighlights(instagram);
        break;
      case "ig-followers":
        await instagramFollowers(instagram);
        break;
      case "ig-listen-events":
        await instagramListenEvents(instagram);
        break;
      case "ig-music-lyrics":
        let response = await instagramMusicTest(instagramSec, message.data);
        ipc.server.emit(socket, "message", JSON.stringify({
          event: message.event,
          data: response
        }));
        break;
      case "sp-sync":
        await spotifySync(spotify);
        break;
      default:
        logger.warn(`${message} argument not found!`);
        break;
    }
    socket.destroy();
  });
});

ipc.server.start();

export { instagram, spotify };
