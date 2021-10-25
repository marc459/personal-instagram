import { Queue, Worker } from "bullmq";
import logger from "../../util/logger";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { delay } from "../../util/custom";
import { exec } from "child_process";

const spotifyQueue = new Queue("SpotifyDL", {
  defaultJobOptions: {
    attempts: 4,
  },
});

const spotifyCache: SpotifyApi.TrackObjectFull[] = JSON.parse(
  readFileSync(resolve(__dirname, "../../../data/spotify/data.json"), {
    encoding: "utf8",
  })
);

const spotifyWorker = new Worker("SpotifyDL", async ({ name, data: { data } }) => {
  if (typeof process.env.SPOTIFY !== "undefined") {
    let parsedData = data.track as SpotifyApi.TrackObjectFull;
    if (name === "download") {
      try {
        if (spotifyCache.filter((c) =>  c.id === parsedData.id).length === 0) {
          logger.info(`${parsedData.name} was not found on the server. Adding task...`);
          await new Promise((_resolve, reject) => {
            exec(
              "cd /home/ubuntu/dj && spotdl " + parsedData.external_urls.spotify,
              async (error, stdout, stderr) => {
                if (error && !error.message.includes(" already downloaded")) {
                  console.log(error);
                  reject(`exec error: ${error.message}`);
                }
                logger.info(`${parsedData.name} added to the folder ⚡`);
                spotifyCache.push({
                  id: parsedData.id,
                  name: parsedData.name,
                  preview_url: parsedData.preview_url,
                  artists: parsedData.artists
                } as never);
                writeFileSync(
                  resolve(__dirname, "../../../data/spotify/data.json"),
                  JSON.stringify(spotifyCache)
                );
                _resolve(true);
              }
            );
          });
        } else {
          //@ts-ignore
          logger.debug(`${data.track.name} was found on the folder, ingnoring it...`);
          await delay(20);
        }
      } catch (error) {
        logger.log(error);
        throw new Error(error.message);
      }
    } else if (name === "remove" && typeof data.name !== "undefined") {
      try {
        logger.info(`${data.name} removing. Adding task...`);
        await new Promise((_resolve, reject) => {
          exec(
            "cd /home/ubuntu/dj && rm '" +
              data.artists.map((a) => a.name).join(", ") +
              " - " +
              data.name +
              ".mp3'",
            (error, stdout, stderr) => {
              if (error) {
                return reject(`exec error: ${error.message}`);
              }
              logger.info(`${data.name} removed from the folder ⚡`);
              spotifyCache.splice(
                spotifyCache.findIndex((c) => c.id === data.id),
                1
              );
              writeFileSync(
                resolve(__dirname, "../../../data/spotify/data.json"),
                JSON.stringify(spotifyCache)
              );
              _resolve(true);
            }
          );
        });
      } catch (error) {
        throw new Error(error.message);
      }
    }
  }
});

spotifyWorker.on("completed", async ({ name, data: { data, last } }) => {
  if (typeof process.env.SPOTIFY !== "undefined") {
    if (typeof last !== "undefined" && last === true) {
      await spotifyQueue.close();
      logger.debug("spotify queue finished!");
      process.exit(0);
    }
  }
});

spotifyQueue.on("failed", async ({ name, data: { data } }, err) => {
  if (typeof process.env.SPOTIFY !== "undefined") {
    logger.error(`Project ${data.track.name} failed: ${err.message}!`);
  }
});

export default spotifyQueue;
