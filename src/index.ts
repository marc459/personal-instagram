import dotenv from 'dotenv';
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
      case '--set-friday-pic':
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
        break;
      case '--a':
        console.log('a');
        break;
      case '--b':
        console.log('b');
        break;
      default:
        break;
    }
  }
});

instagram.on('error', (error) => {
  logger.error(error);
});
