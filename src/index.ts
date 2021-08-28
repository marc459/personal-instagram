import dotenv from 'dotenv';
import {
  highlights,
  resetProfileAvatar,
  setFridayProfileAvatar,
  uploadHistory
} from './lib/cli';
import Instagram from './lib/instagram';
import logger from './util/logger';
// Load .env environment values.
dotenv.config();

const instagram = new Instagram({
  username: process.env.IG_USERNAME!,
  password: process.env.IG_PASSWORD!,
  oath: process.env.OATH_KEY!
});

instagram.on('loggedIn', async () => {
  logger.info(
    `Successfully logged in with ${instagram.user.username}'s account!`
  );
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    switch (arg) {
      case '--set-friday-profile-avatar':
        await setFridayProfileAvatar(instagram);
        break;
      case '--reset-profile-avatar':
        await resetProfileAvatar(instagram);
        break;
      case '--upload-history':
        await uploadHistory(instagram);
        break;
      case '--highlights':
        await highlights(instagram);
        break;
      default:
        logger.warn(`${arg} argument not found!`);
        break;
    }
  }
});

instagram.on('error', (error) => {
  logger.error(error);
});
