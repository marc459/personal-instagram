import { readFileSync } from "fs";
import { StickerBuilder } from "instagram-private-api/dist/sticker-builder";
import { getImageBuffer, getImageColors } from "../util/image";
import logger from "../util/logger";
import Instagram from "./instagram";
import compareImages from "resemblejs/compareImages";
import { getAllItemsFromFeed } from "../util/instagram";
import Spotify from "./spotify";
import { delay } from "../util/custom";
import { MusicRepositoryLyricsResponseRootObject } from "instagram-private-api/dist/responses/music.repository.lyrics.response";

const highlightData = JSON.parse(
  readFileSync(process.cwd() + "/data/instagram/highlights.json", {
    encoding: "utf8",
  })
);

//-------------------//
// Instagram section //
//-------------------//
export const instagramSetFridayProfileAvatar = async function (
  instagram: Instagram
): Promise<void> {
  logger.debug("Generating friday profile picture...");
  const fridayProfilePic = await instagram.generateFridayProfilePic(instagram.user.username);
  try {
    await instagram.ig.account.changeProfilePicture(fridayProfilePic);
    logger.info(`Successfully changed to the friday's avatar!`);
  } catch (error) {
    logger.error(error.message);
  }
};

export const instagramResetProfileAvatar = async function (instagram: Instagram): Promise<void> {
  logger.debug("Reseting profile picture...");
  try {
    const profilePic = readFileSync(process.cwd() + "/data/instagram/avatar.jpeg");
    await instagram.ig.account.changeProfilePicture(profilePic);
    logger.info(`Successfully reset profile picture!`);
  } catch (error) {
    logger.error(error.message);
  }
};

export const instagramUploadHistory = async function (instagram: Instagram): Promise<void> {
  logger.debug("Uploading history...");
  try {
    const file = readFileSync(process.cwd() + "/data/instagram/avatar.jpeg");
    await instagram.ig.publish.story({
      file,
      // this creates a new config
      stickerConfig: new StickerBuilder()
        // these are all supported stickers
        .add(
          StickerBuilder.hashtag({
            tagName: "insta",
          }).center()
        )
        .add(
          StickerBuilder.mention({
            userId: instagram.ig.state.cookieUserId,
          }).center()
        )
        .add(
          StickerBuilder.question({
            question: "My Question",
          }).scale(0.5)
        )
        .add(
          StickerBuilder.question({
            question: "Music?",
            questionType: "text",
          })
        )
        .add(
          StickerBuilder.poll({
            question: "Question",
            tallies: [{ text: "Left" }, { text: "Right" }],
          })
        )
        .add(
          StickerBuilder.quiz({
            question: "Question",
            options: ["0", "1", "2", "3"],
            correctAnswer: 1,
          })
        )
        .add(
          StickerBuilder.slider({
            question: "Question",
            emoji: "❤",
          })
        )

        // mention the first media on your timeline
        .add(
          StickerBuilder.attachmentFromMedia(
            (
              await instagram.ig.feed.timeline().items()
            )[0]
          ).center()
        )

        // you can also set different values for the position and dimensions
        .add(
          StickerBuilder.hashtag({
            tagName: "insta",
            width: 0.5,
            height: 0.5,
            x: 0.5,
            y: 0.5,
          })
        )
        .build(),
    });
    logger.info(`Successfully uploaded the history!`);
  } catch (error) {
    logger.error(error.message);
    logger.error(error.stack);
  }
};

export const instagramFeedTest = async function (instagram: Instagram): Promise<void> {
  logger.debug("Getting last 3 feed pictures...");
  try {
    const feed = (await instagram.ig.feed.user(instagram.ig.state.cookieUserId).items()).slice(
      0,
      3
    );
    feed.forEach(async (item) => {
      const color = await getImageColors(item.image_versions2.candidates[0].url);
      console.log(color, item.image_versions2.candidates[0].url);
    });
  } catch (error) {
    logger.error(error.message);
  }
};

export const instagramHighlights = async function (instagram: Instagram): Promise<void> {
  logger.debug("Getting highlights...");
  try {
    const highlights = await instagram.ig.highlights.highlightsTray(
      instagram.ig.state.cookieUserId
    );
    const profilePic = await instagram.getProfilePic(instagram.user.username).then(getImageBuffer);
    const profileColor = await getImageColors(profilePic);
    for (let i = 0; i < highlights.tray.length; i++) {
      const t = highlights.tray[i];
      const data = highlightData.find((d) => d.id === t.id);
      if (typeof data !== "undefined") {
        logger.debug(`Generating new ${t.title} highlight cover...`);
        let number;
        if (/Friday #([0-9]+)/g.exec(t.title) !== null) {
          number = parseInt(/Friday #([0-9]+)/g.exec(t.title)![1]);
        }
        const cloudImgBuffer = await getImageBuffer(t.cover_media.cropped_image_version.url);
        const localImgBuffer = await instagram.generateHighlightCover(
          profileColor,
          data.emoticon,
          typeof number === "number"
            ? number + (typeof process.env.NODE_FRIDAY_CRON !== "undefined" ? 1 : 0)
            : undefined
        );
        const compareResult = await compareImages(cloudImgBuffer, localImgBuffer, {
          scaleToSameSize: true,
          ignore: "antialiasing",
        });
        // Check if Images are different
        if (compareResult.rawMisMatchPercentage > 0) {
          logger.debug(
            `${t.title} highlight cover has ${compareResult.rawMisMatchPercentage}% difference. Updating...`
          );

          const { upload_id } = await instagram.ig.upload.photo({
            file: await instagram.generateHighlightCover(
              profileColor,
              data.emoticon,
              typeof number === "number"
                ? number + (typeof process.env.NODE_FRIDAY_CRON !== "undefined" ? 1 : 0)
                : undefined
            ),
          });
          await instagram.ig.request.send({
            url: `/api/v1/highlights/${t.id}/edit_reel/`,
            method: "POST",
            form: instagram.ig.request.sign({
              supported_capabilities_new: JSON.stringify(instagram.ig.state.supportedCapabilities),
              source: "story_viewer_default",
              added_media_ids: "[]",
              _csrftoken: instagram.ig.state.cookieCsrfToken,
              _uid: instagram.ig.state.cookieUserId,
              _uuid: instagram.ig.state.uuid,
              cover: JSON.stringify({
                upload_id,
                crop_rect: "[0.0,0.0,1.0,1.0]",
              }),
              title:
                typeof number === "number"
                  ? data.title.replace(
                      "{COUNTER}",
                      (
                        number + (typeof process.env.NODE_FRIDAY_CRON === "string" ? 1 : 0)
                      ).toString()
                    )
                  : data.title,
              removed_media_ids: "[]",
            }),
          });
          logger.debug("Highlight cover set successfully...");
          await delay(Math.floor(Math.random() * 6000) + 2000);
        } else {
          logger.debug(`${t.title} highlight cover has same result as new. Skipping update...`);
        }
      }
    }
  } catch (error) {
    logger.error(error.message);
  }
};

export const instagramFollowers = async function (instagram: Instagram): Promise<void> {
  const followersFeed = instagram.ig.feed.accountFollowers(instagram.ig.state.cookieUserId);
  const followingFeed = instagram.ig.feed.accountFollowing(instagram.ig.state.cookieUserId);
  const leastInteractedWith = await instagram.ig.friendship.leastInteractedWith();

  const followers = await getAllItemsFromFeed(followersFeed);
  const following = await getAllItemsFromFeed(followingFeed);
  // Making a new map of users username that follow you.
  const followersUsername = new Set(followers.map(({ username }) => username));
  // Filtering through the ones not verified and aren't following you.
  const notFollowingYou = following.filter(({ username }) => !followersUsername.has(username));
  // Looping through and unfollowing each user

  const AskQuestion = (question) => {
    return new Promise((resolve) => {
      instagram.std.question(question, (answer) => {
        resolve(answer);
      });
    });
  };

  for (const user of notFollowingYou) {
    const response = await AskQuestion(`
Username ${user.username} (${user.full_name} https://www.instagram.com/${
      user.username
    }/) is not following you.
    Has interacted with you: ${leastInteractedWith.map((l) => l.pk).includes(user.pk)}.
    Do you want to remove this friend? [y/n] `);
    if (["y", "n"].includes(response as string)) {
      if (response === "y") {
        await instagram.ig.friendship.destroy(user.pk);
        console.log(`Successfully unfollowed ${user.username}!`);
      } else {
        console.log(`Skipping ${user.username}...`);
      }
    }
  }
  instagram.std.close();
};

export const instagramListenEvents = async function (instagram: Instagram): Promise<void> {
  logger.debug(`Listening ${instagram.user.username}'s events...`);
  await instagram.listenEvents();
};

export const instagramMusicTest = async function (instagram: Instagram, query: string): Promise<MusicRepositoryLyricsResponseRootObject | void> {
  try {
    let response = (await instagram.ig.feed.musicSearch(query).items())[0];
    if (response.track.has_lyrics)
    {
      let lyrics = await instagram.ig.music.lyrics(response.track.id);
      //@ts-ignore
      lyrics.song = response.track.title;
      return lyrics;
    }
  } catch (error) {

  }
};

//-------------------//
//  Spotify section  //
//-------------------//
export const spotifySync = async function (
  spotify: Spotify,
  pages?: SpotifyResponse<SpotifyApi.PlaylistTrackResponse>
): Promise<void> {
  const spotifyQueue = (await import("./queue/spotify")).default;
  const spotifyCache: SpotifyApi.TrackObjectFull[] = JSON.parse(
    readFileSync(process.cwd() + "/data/spotify/data.json", {
      encoding: "utf8",
    })
  );
  const playlistId = await (
    await spotify.cl.getUserPlaylists("g0da7bdi5cbu3lpgdspx27cb9")
  ).body.items.filter((i) => i.name === "Session music")[0].id;
  const page = await spotify.cl.getPlaylistTracks(playlistId, {
    offset: pages?.body.offset ?? 0,
    limit: pages?.body.limit ?? 100,
  });
  if (typeof pages === "undefined") {
    pages = page;
  } else {
    pages.body = {
      ...pages.body,
      items: pages.body.items.concat(page.body.items),
    };
  }

  if (pages.body.offset + pages.body.limit < pages.body.total) {
    pages.body.offset = pages.body.offset + pages.body.limit;
    return await delay(200, () => spotifySync(spotify, pages));
  }
  logger.info(`Retrieved +${pages.body.items.length} songs in total!`);

  for (let i = 0; i < spotifyCache.length; i++) {
    const item = spotifyCache[i];
    const data = { data: item };
    if (pages.body.items.filter((i: any) => i.track.id === item.id).length === 0) {
      delay(20);
      await spotifyQueue.add("remove", data);
    }
  }
  for (let i = 0; i < pages.body.items.length; i++) {
    const item = pages.body.items[i];
    const data = { data: item };
    if (i + 1 === pages.body.items.length) {
      //@ts-ignore
      data.last = true;
    }
    await delay(50);
    await spotifyQueue.add("download", data);
  }
};
