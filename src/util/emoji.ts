import { Image, loadImage } from 'canvas';
import sharp from 'sharp';
import { parse } from 'twemoji-parser';
import { getImageBuffer } from './image';

// Get font size by cssFont and Return size in px.
export function getFontSizeByCssFont(cssFont: string): number {
  const pxMatch = cssFont.match(/([0-9]+)px/);
  if (pxMatch) return Number(pxMatch[1]);
  // default
  return 10;
}
const cachedTwemojiImages = new Map();

export async function loadTwemojiImageByUrl(
  url: string,
  size = 300
): Promise<Image> {
  return new Promise(async (resolve) => {
    if (cachedTwemojiImages.has(url)) {
      return resolve(cachedTwemojiImages.get(url));
    }
    const image = await loadImage(
      await sharp(await getImageBuffer(url, size))
        .png()
        .toBuffer()
    );
    cachedTwemojiImages.set(url, image);
    return resolve(image);
  });
}

/*
 * Split Text
 * ex)
 *  '君👼の味方🤝だよ'
 *  > ['君', TwemojiObj(👼), 'の味方', TwemojiObj(🤝), 'だよ']
 */
export function splitEntitiesFromText(text: string): any {
  const twemojiEntities = parse(text, { assetType: 'svg' });
  let unparsedText = text;
  let lastTwemojiIndice = 0;
  const textEntities: any = [];

  twemojiEntities.forEach((twemoji) => {
    textEntities.push(
      unparsedText.slice(0, twemoji.indices[0] - lastTwemojiIndice)
    );
    textEntities.push(twemoji);
    unparsedText = unparsedText.slice(twemoji.indices[1] - lastTwemojiIndice);
    lastTwemojiIndice = twemoji.indices[1];
  });
  textEntities.push(unparsedText);
  return textEntities;
}
