import { readFileSync /*writeFileSync*/ } from 'fs';
import { StickerBuilder } from 'instagram-private-api/dist/sticker-builder';
import { resolve } from 'path';
import { getImageBuffer, getImageColors } from '../util/image';
import logger from '../util/logger';
import Instagram from './instagram';
import highlightData from '../../data/highlights.json';

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

export const highlightsTest = async function (
  instagram: Instagram
): Promise<void> {
  logger.debug('Getting last 3 feed pictures...');
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
        logger.debug('Setting new highlight cover...');
        let number;
        if (/Friday #([0-9]+)/g.exec(t.title) !== null) {
          number = parseInt(/Friday #([0-9]+)/g.exec(t.title)![1]);
        }
        const { upload_id } = await instagram.ig.upload.photo({
          file: await instagram.generateHighlightCover(
            profileColor,
            data.emoticon,
            typeof number === 'number' ? number + 1 : undefined
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
                ? data.title.replace('{COUNTER}', (number + 1).toString())
                : data.title,
            removed_media_ids: '[]'
          })
        });
        logger.debug('Highlight cover set successfully...');
        await delay(Math.floor(Math.random() * 6000) + 2000);
      }
    }
  } catch (error) {
    logger.error(error.message);
  }
};