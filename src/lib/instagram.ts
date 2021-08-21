import {
  createCanvas,
  loadImage,
  NodeCanvasRenderingContext2D,
  registerFont
} from 'canvas';
import { exec } from 'child_process';
import EventEmitter from 'events';
import {
  AccountRepositoryCurrentUserResponseUser,
  IgApiClient,
  IgLoginTwoFactorRequiredError
} from 'instagram-private-api';
import { resolve } from 'path';
import sharp from 'sharp';
import {
  blurImage,
  getImageBuffer,
  getImageColors,
  imageMetadata
} from '../util/image';
import logger from '../util/logger';
import { HandleSession } from './session';

class Instagram extends EventEmitter {
  readonly config: ConnectionParams;
  public ig: IgApiClient;
  public sessionHandlerInstance: HandleSession;
  public user: AccountRepositoryCurrentUserResponseUser;

  constructor(config: ConnectionParams) {
    super();
    logger.debug('Initializing IgApiClient...');
    this.ig = new IgApiClient();
    this.sessionHandlerInstance = new HandleSession();
    logger.debug('IgApiClient has been initialized!');
    this.login(config);
  }

  private async login(config: ConnectionParams) {
    try {
      if (
        typeof config.username === 'undefined' ||
        typeof config.password === 'undefined'
      ) {
        throw Error(
          'IG_USERNAME OR IG_PASSWORD environment variables are not set!'
        );
      }
      this.ig.state.generateDevice(config.username);
      // This function executes after every request
      this.ig.request.end$.subscribe(async () => {
        const serialized = await this.ig.state.serialize();
        delete serialized.constants;
        this.sessionHandlerInstance.persistSession(serialized);
      });

      // If exists some session file, then we load the session from it
      if (this.sessionHandlerInstance.existSessionFile()) {
        logger.debug('Using session cache');
        await this.ig.state.deserialize(
          this.sessionHandlerInstance.loadSessionFile()
        );
      } else {
        await this.ig.account.login(config.username, config.password);
      }
      this.user = await this.ig.account.currentUser();
      super.emit('loggedIn');
    } catch (error) {
      if (error instanceof IgLoginTwoFactorRequiredError) {
        logger.debug(error.message);
        const { username, totp_two_factor_on, two_factor_identifier } =
          error.response.body.two_factor_info;
        // decide which method to use
        const verificationMethod = totp_two_factor_on ? '0' : '1'; // default to 1 for SMS
        // At this point a code should have been sent
        // Get the code
        const verificationCode = await this.generateOathCode();
        // Use the code to finish the login process
        await this.ig.account.twoFactorLogin({
          username,
          verificationCode,
          twoFactorIdentifier: two_factor_identifier,
          verificationMethod
        });
        this.user = await this.ig.account.currentUser();
        super.emit('loggedIn');
      }
      this.emit('error', error.message);
    }
  }

  public async getProfilePic(username: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        const userId = await this.ig.user.getIdByUsername(username);
        const info = await this.ig.user.info(userId);
        resolve(info.hd_profile_pic_url_info.url);
      } catch (error) {
        reject(error.message);
      }
    });
  }

  public async generateFridayProfilePic(username: string): Promise<Buffer> {
    function drawTextAlongArc(
      context: NodeCanvasRenderingContext2D,
      str,
      centerX,
      centerY,
      radius,
      angle
    ) {
      const len = str.length;
      context.save();
      context.translate(centerX, centerY);
      context.rotate((-1 * angle) / 2);
      context.rotate((-1 * (angle / len)) / 2);
      for (let n = 0; n < len; n++) {
        context.rotate(angle / len);
        context.save();
        context.translate(0, -1 * radius);
        context.fillText(str[n], 0, 0);
        context.restore();
      }
      context.restore();
    }

    return new Promise(async (_resolve, reject) => {
      try {
        const profilePic = await this.getProfilePic(username).then(
          getImageBuffer
        );
        const blurredImage = await blurImage(profilePic, 10);
        const { width, height } = await imageMetadata(profilePic);
        getImageColors(profilePic)
          .then(async (result) => {
            registerFont(
              resolve(
                __dirname,
                '..',
                'fonts',
                'Lovelo',
                'Lovelo-LineBold.woff'
              ),
              { family: 'Lovelo' }
            );
            const canvas = createCanvas(width!, height!);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(await loadImage(blurredImage), 0, 0);
            ctx.font = '150px Lovelo';
            ctx.textAlign = 'center';
            ctx.fillStyle = result.color;
            ctx.lineWidth = 4;
            drawTextAlongArc(
              ctx,
              'Feliz viernes!',
              canvas.width / 2,
              canvas.height / 2,
              canvas.width / 2.7,
              Math.PI
            );
            _resolve(await sharp(canvas.toBuffer()).jpeg().toBuffer());
          })
          .catch((err) => {
            logger.error(err.stack);
          });
      } catch (error) {
        reject(error.message);
      }
    });
  }

  private async generateOathCode(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (typeof this.config.oath === 'undefined') {
        reject('OATH_KEY environment variable not set!');
      }
      exec(`oathtool --totp -b ${this.config.oath}`, (err, stdout) => {
        if (err) {
          reject(err.message);
        }
        resolve(stdout.split('\n')[0]);
      });
    });
  }
}

export default Instagram;
