import { readFileSync /*writeFileSync*/ } from 'fs';
import { StickerBuilder } from 'instagram-private-api/dist/sticker-builder';
import { resolve } from 'path';
import { getImageBuffer, getImageColors } from '../util/image';
import logger from '../util/logger';
import Instagram from './instagram';
import highlightData from '../../data/highlights.json';
import compareImages from 'resemblejs/compareImages';
import { getAllItemsFromFeed } from '../util/instagram';

export const setFridayProfileAvatar = async function (
  instagram: Instagram
): Promise<void> {
  logger.debug('Generating friday profile picture...');
  const fridayProfilePic = await instagram.generateFridayProfilePic(
    instagram.user.username
  );
  try {
    await instagram.ig.account.changeProfilePicture(fridayProfilePic);
    logger.info(`Successfully changed to the friday's avatar!`);
  } catch (error) {
    logger.error(error.message);
  }
};

export const resetProfileAvatar = async function (
  instagram: Instagram
): Promise<void> {
  logger.debug('Reseting profile picture...');
  try {
    const profilePic = readFileSync(
      resolve(__dirname, '..', '..', 'data', 'avatar.jpeg')
    );
    await instagram.ig.account.changeProfilePicture(profilePic);
    logger.info(`Successfully reset profile picture!`);
  } catch (error) {
    logger.error(error.message);
  }
};

export const uploadHistory = async function (
  instagram: Instagram
): Promise<void> {
  logger.debug('Uploading history...');
  try {
    const file = readFileSync(
      resolve(__dirname, '..', '..', 'data', 'avatar.jpeg')
    );
    await instagram.ig.publish.story({
      file,
      // this creates a new config
      stickerConfig: new StickerBuilder()
        // these are all supported stickers
        .add(
          StickerBuilder.hashtag({
            tagName: 'insta'
          }).center()
        )
        .add(
          StickerBuilder.mention({
            userId: instagram.ig.state.cookieUserId
          }).center()
        )
        .add(
          StickerBuilder.question({
            question: 'My Question'
          }).scale(0.5)
        )
        .add(
          StickerBuilder.question({
            question: 'Music?',
            questionType: 'text'
          })
        )
        .add(
          StickerBuilder.poll({
            question: 'Question',
            tallies: [{ text: 'Left' }, { text: 'Right' }]
          })
        )
        .add(
          StickerBuilder.quiz({
            question: 'Question',
            options: ['0', '1', '2', '3'],
            correctAnswer: 1
          })
        )
        .add(
          StickerBuilder.slider({
            question: 'Question',
            emoji: '❤'
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
            tagName: 'insta',
            width: 0.5,
            height: 0.5,
            x: 0.5,
            y: 0.5
          })
        )
        .build()
    });
    logger.info(`Successfully uploaded the history!`);
  } catch (error) {
    logger.error(error.message);
    logger.error(error.stack);
  }
};

export const feedTest = async function (instagram: Instagram): Promise<void> {
  logger.debug('Getting last 3 feed pictures...');
  try {
    const feed = (
      await instagram.ig.feed.user(instagram.ig.state.cookieUserId).items()
    ).slice(0, 3);
    feed.forEach(async (item) => {
      const color = await getImageColors(
        item.image_versions2.candidates[0].url
      );
      console.log(color, item.image_versions2.candidates[0].url);
    });
  } catch (error) {
    logger.error(error.message);
  }
};

export const highlights = async function (instagram: Instagram): Promise<void> {
  logger.debug('Getting highlights...');
  try {
    const highlights = await instagram.ig.highlights.highlightsTray(
      instagram.ig.state.cookieUserId
    );
    const profilePic = await instagram
      .getProfilePic(instagram.user.username)
      .then(getImageBuffer);
    const delay = (m) => new Promise((resolve) => setTimeout(resolve, m));
    const profileColor = await getImageColors(profilePic);
    for (let i = 0; i < highlights.tray.length; i++) {
      const t = highlights.tray[i];
      const data = highlightData.find((d) => d.id === t.id);
      if (typeof data !== 'undefined') {
        logger.debug(`Generating new ${t.title} highlight cover...`);
        let number;
        if (/Friday #([0-9]+)/g.exec(t.title) !== null) {
          number = parseInt(/Friday #([0-9]+)/g.exec(t.title)![1]);
        }
        const cloudImgBuffer = await getImageBuffer(
          t.cover_media.cropped_image_version.url
        );
        const localImgBuffer = await instagram.generateHighlightCover(
          profileColor,
          data.emoticon,
          typeof number === 'number'
            ? number +
                (typeof process.env.NODE_FRIDAY_CRON === 'string' ? 1 : 0)
            : undefined
        );
        const compareResult = await compareImages(
          cloudImgBuffer,
          localImgBuffer,
          {
            scaleToSameSize: true,
            ignore: 'antialiasing'
          }
        );
        // Check if Images are different
        if (compareResult.rawMisMatchPercentage > 0) {
          logger.debug(
            `${t.title} highlight cover has ${compareResult.rawMisMatchPercentage}% difference. Updating...`
          );
          const { upload_id } = await instagram.ig.upload.photo({
            file: await instagram.generateHighlightCover(
              profileColor,
              data.emoticon,
              typeof number === 'number'
                ? number +
                    (typeof process.env.NODE_FRIDAY_CRON === 'string' ? 1 : 0)
                : undefined
            )
          });
          await instagram.ig.request.send({
            url: `/api/v1/highlights/${t.id}/edit_reel/`,
            method: 'POST',
            form: instagram.ig.request.sign({
              supported_capabilities_new: JSON.stringify(
                instagram.ig.state.supportedCapabilities
              ),
              source: 'story_viewer_default',
              added_media_ids: '[]',
              _csrftoken: instagram.ig.state.cookieCsrfToken,
              _uid: instagram.ig.state.cookieUserId,
              _uuid: instagram.ig.state.uuid,
              cover: JSON.stringify({
                upload_id,
                crop_rect: '[0.0,0.0,1.0,1.0]'
              }),
              title:
                typeof number === 'number'
                  ? data.title.replace(
                      '{COUNTER}',
                      (
                        number +
                        (typeof process.env.NODE_FRIDAY_CRON === 'string'
                          ? 1
                          : 0)
                      ).toString()
                    )
                  : data.title,
              removed_media_ids: '[]'
            })
          });
          logger.debug('Highlight cover set successfully...');
          await delay(Math.floor(Math.random() * 6000) + 2000);
        } else {
          logger.debug(
            `${t.title} highlight cover has same result as new. Skipping update...`
          );
        }
      }
    }
  } catch (error) {
    logger.error(error.message);
  }
};

export const followers = async function (instagram: Instagram): Promise<void> {
  const followersFeed = instagram.ig.feed.accountFollowers(
    instagram.ig.state.cookieUserId
  );
  const followingFeed = instagram.ig.feed.accountFollowing(
    instagram.ig.state.cookieUserId
  );
  const leastInteractedWith =
    await instagram.ig.friendship.leastInteractedWith();

  const followers = await getAllItemsFromFeed(followersFeed);
  const following = await getAllItemsFromFeed(followingFeed);
  // Making a new map of users username that follow you.
  const followersUsername = new Set(followers.map(({ username }) => username));
  // Filtering through the ones not verified and aren't following you.
  const notFollowingYou = following.filter(
    ({ username }) => !followersUsername.has(username)
  );
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
    Has interacted with you: ${leastInteractedWith
      .map((l) => l.pk)
      .includes(user.pk)}.
    Do you want to remove this friend? [y/n] `);
    if (['y', 'n'].includes(response as string)) {
      if (response === 'y') {
        await instagram.ig.friendship.destroy(user.pk);
        console.log(`Successfully unfollowed ${user.username}!`);
      } else {
        console.log(`Skipping ${user.username}...`);
      }
    }
  }
  instagram.std.close();
};

export const listenEvents = async function (
  instagram: Instagram
): Promise<void> {
  logger.debug(`Listening ${instagram.user.username}'s events...`);
  await instagram.listenEvents();
};
