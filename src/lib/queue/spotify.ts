import { Queue, Worker } from "bullmq";
import logger from "../../util/logger";
import { readFileSync, writeFileSync, statSync, existsSync } from "fs";
import { resolve } from "path";
import { delay } from "../../util/custom";
import { exec } from "child_process";
import { spotify } from "../../index";
import NodeID3 from "node-id3";
import { parseStringPromise, Builder } from "xml2js";
import { parseTrackFeatures } from "../../util/spotify";

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

let initialXmlObject;

parseStringPromise(
  readFileSync("/home/ubuntu/dj/rekordbox.xml", {
    encoding: "utf8",
  })
).then((result) => {
  initialXmlObject = JSON.parse(JSON.stringify(result));
});

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
                if (error) {
                  console.log(error);
                  return reject(`exec error: ${error.message}`);
                }
                logger.info(`${parsedData.name} added to the folder ⚡`);
                logger.info(`Getting ${parsedData.name} analysis...`);
                let features = parseTrackFeatures(
                  (await (
                    await spotify.cl.getAudioFeaturesForTrack(parsedData.id)
                  ).body) as SpotifyApi.AudioFeaturesResponse
                );
                //@ts-ignore
                parsedData.analysis = await (
                  await spotify.cl.getAudioAnalysisForTrack(parsedData.id)
                ).body;
                //@ts-ignore
                let analysis = parsedData.analysis;
                if (
                  !existsSync(
                    "/home/ubuntu/dj/" +
                      parsedData.artists.map((a) => a.name).join(", ") +
                      " - " +
                      parsedData.name +
                      ".mp3"
                  )
                ) {
                  return reject("File does not exist! Retring...");
                }
                const tags = NodeID3.read(
                  "/home/ubuntu/dj/" +
                    parsedData.artists.map((a) => a.name).join(", ") +
                    " - " +
                    parsedData.name +
                    ".mp3"
                );
                let index = 0;
                if (typeof initialXmlObject.DJ_PLAYLISTS.COLLECTION[0].TRACK === "undefined") {
                  initialXmlObject.DJ_PLAYLISTS.COLLECTION[0].TRACK = [];
                } else {
                  index = initialXmlObject.DJ_PLAYLISTS.COLLECTION[0].TRACK.length;
                }
                let track = {
                  $: {
                    TrackId: index.toString(),
                    Name: parsedData.name,
                    Artist: parsedData.artists.map((a) => a.name).join("/"),
                    Album: parsedData.album.name,
                    Kind: "mp3",
                    Location:
                      "file://localhost/Users/alex/Music/dj/" +
                      parsedData.artists.map((a) => a.name).join(", ") +
                      " - " +
                      parsedData.name +
                      ".mp3",
                    Size: statSync(
                      "/home/ubuntu/dj/" +
                        parsedData.artists.map((a) => a.name).join(", ") +
                        " - " +
                        parsedData.name +
                        ".mp3"
                    ).size,
                    TotalTime: Math.round((parsedData.duration_ms / 1000) * 100) / 100,
                    Year: tags.date,
                    BitRate: tags.date,
                    AverageBpm: features.bpm,
                    Comments: features.tonality + " - Energy " + features.energy,
                    Tonality: features.tonality,
                    Label: "",
                  },
                  POSITION_MARK: [] as any,
                  TEMPO: [] as any,
                };

                analysis.sections.forEach((section, index) => {
                  if (index === 0) {
                    track.POSITION_MARK.push({
                      $: {
                        Name: "AutoGrid",
                        Type: "0",
                        Start: section.start.toFixed(3),
                        Num: index,
                      },
                    });
                    track.TEMPO.push({
                      $: {
                        Inizio: section.start,
                        Bpm: features.bpm,
                        Metro: features.time_signature,
                        Battito: "1",
                      },
                    });
                  }
                  track.POSITION_MARK.push({
                    $: {
                      Name: "Cue " + index,
                      Type: "0",
                      Start: section.start.toFixed(3),
                      Num: index,
                    },
                  });
                });
                initialXmlObject.DJ_PLAYLISTS.COLLECTION[0].TRACK.push(track);
                spotifyCache.push(parsedData as never);
                writeFileSync(
                  resolve(__dirname, "../../../data/spotify/data.json"),
                  JSON.stringify(spotifyCache)
                );
                initialXmlObject.DJ_PLAYLISTS.COLLECTION[0].$.Entries =
                  initialXmlObject.DJ_PLAYLISTS.COLLECTION[0].TRACK.length.toString();
                var builder = new Builder();
                var xml = builder.buildObject(initialXmlObject);
                writeFileSync("/home/ubuntu/dj/rekordbox.xml", xml);
                logger.debug("xml file updated!");
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
    }
    if (name === "remove" && typeof data.track.name !== "undefined") {
      try {
        console.log(data.track);
        logger.info(`${data.track.name} removing. Adding task...`);
        await new Promise((_resolve, reject) => {
          exec(
            "cd /home/ubuntu/dj && rm '" +
              data.track.artists.map((a) => a.name).join(", ") +
              " - " +
              data.track.name +
              ".mp3'",
            (error, stdout, stderr) => {
              if (error) {
                return reject(`exec error: ${error.message}`);
              }
              logger.info(`${data.track.name} removed from the folder ⚡`);
              spotifyCache.splice(
                spotifyCache.findIndex((c) => c.id === data.track.id),
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
    if (typeof last !== "undefined") {
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
