//import Vibrant from 'node-vibrant';
import { loadImage } from 'canvas';
import request from 'request';
import sharp, { Metadata } from 'sharp';
import getImagePalette from './palette';

export const getImageBuffer = function (url: string): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      request.get({ url, encoding: null }, async (err, res, body) => {
        if (res.statusCode !== 200) {
          throw Error(res.statusMessage);
        }
        resolve(await sharp(body).toFormat('png').toBuffer());
      });
    } catch (error) {
      reject(error);
    }
  });
};

export const getImageColors = function (
  url: Buffer | string
): Promise<Palette> {
  return new Promise(async (resolve, reject) => {
    try {
      let buffer;
      if (typeof url === 'string') {
        buffer = await getImageBuffer(url);
      } else {
        buffer = url;
      }
      const palette = getImagePalette(await loadImage(buffer));
      resolve(palette);
    } catch (error) {
      reject(error);
    }
  });
};

export const blurImage = function (
  url: Buffer | string,
  sigma: number
): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      let buffer;
      if (typeof url === 'string') {
        buffer = await getImageBuffer(url);
      } else {
        buffer = url;
      }
      resolve(await sharp(buffer).blur(sigma).toBuffer());
    } catch (error) {
      reject(error);
    }
  });
};

export const imageMetadata = function (
  url: Buffer | string
): Promise<Metadata> {
  return new Promise(async (resolve, reject) => {
    try {
      let buffer;
      if (typeof url === 'string') {
        buffer = await getImageBuffer(url);
      } else {
        buffer = url;
      }
      resolve(await sharp(buffer).metadata());
    } catch (error) {
      reject(error);
    }
  });
};
