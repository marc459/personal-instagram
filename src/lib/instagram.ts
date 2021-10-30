import { createCanvas, loadImage, registerFont } from "canvas";
import { exec } from "child_process";
import EventEmitter from "events";
import {
  AccountFollowersFeedResponseUsersItem,
  AccountRepositoryCurrentUserResponseUser,
  IgApiClient,
  IgLoginTwoFactorRequiredError,
} from "instagram-private-api";
import {
  withFbnsAndRealtime,
  IgApiClientMQTT,
  GraphQLSubscriptions,
  SkywalkerSubscriptions,
} from "instagram_mqtt";
import sharp from "sharp";
import { blurImage, getImageBuffer, getImageColors, imageMetadata } from "../util/image";
import logger from "../util/logger";
import { HandleSession } from "./session";
import { createInterface, Interface } from "readline";

class Instagram extends EventEmitter {
  readonly config: InstagramConnectionParams;
  public ig: IgApiClientMQTT;
  public sessionHandlerInstance: HandleSession;
  public user: AccountRepositoryCurrentUserResponseUser;
  public std: Interface;

  constructor(config: InstagramConnectionParams) {
    super();
    this.std = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    logger.debug("Initializing IgApiClientMQTT...");
    this.ig = withFbnsAndRealtime(new IgApiClient());
    this.sessionHandlerInstance = new HandleSession(config.username);
    logger.debug("IgApiClient has been initialized!");
    this.ig.friendship.leastInteractedWith = () => this.leastInteractedWith();
    this.login(config);
  }

  public async listenEvents() {
    this.ig.realtime.on("receive", (topic, messages) =>
      logger.info(`receive: ${JSON.stringify(topic)} ${JSON.stringify(messages)}`)
    );

    // this is called with a wrapper use {message} to only get the "actual" message from the wrapper
    this.ig.realtime.on("message", ({ message }) => {
      logger.info(`messageWrapper ${JSON.stringify(message)}`);
    });

    // a thread is updated, e.g. admins/members added/removed
    this.ig.realtime.on("threadUpdate", (data) => {
      logger.info(`threadUpdateWrapper ${JSON.stringify(data)}`);
    });

    // other direct messages - no messages
    this.ig.realtime.on("direct", (data) => {
      logger.info(`direct ${JSON.stringify(data)}`);
    });

    // whenever something gets sent to /ig_realtime_sub and has no event, this is called
    this.ig.realtime.on("realtimeSub", ({ data }) => {
      logger.info(`realtimeSub ${JSON.stringify(data.message)}`);
    });

    // whenever the client has a fatal error
    this.ig.realtime.on("error", logger.error);

    this.ig.realtime.on("close", () => logger.error("RealtimeClient closed"));

    // connect
    // this will resolve once all initial subscriptions have been sent
    await this.ig.realtime.connect({
      // optional
      graphQlSubs: [
        // these are some subscriptions
        GraphQLSubscriptions.getAppPresenceSubscription(),
        GraphQLSubscriptions.getZeroProvisionSubscription(this.ig.state.phoneId),
        GraphQLSubscriptions.getDirectStatusSubscription(),
        GraphQLSubscriptions.getDirectTypingSubscription(this.ig.state.cookieUserId),
        GraphQLSubscriptions.getAsyncAdSubscription(this.ig.state.cookieUserId),
      ],
      // optional
      skywalkerSubs: [
        SkywalkerSubscriptions.directSub(this.ig.state.cookieUserId),
        SkywalkerSubscriptions.liveSub(this.ig.state.cookieUserId),
      ],
      // optional
      // this enables you to get direct messages
      irisData: await this.ig.feed.directInbox().request(),
    });
  }

  private async login(config: InstagramConnectionParams) {
    try {
      if (typeof config.username === "undefined" || typeof config.password === "undefined") {
        throw Error("IG_USERNAME OR IG_PASSWORD environment variables are not set!");
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
        logger.debug("Using session cache");
        await this.ig.state.deserialize(this.sessionHandlerInstance.loadSessionFile());
      } else {
        await this.ig.account.login(config.username, config.password);
      }
      this.user = await this.ig.account.currentUser();
      // await this.listenEvents();
      super.emit("loggedIn");
    } catch (error) {
      if (error instanceof IgLoginTwoFactorRequiredError) {
        logger.debug(error.message);
        const { username, totp_two_factor_on, two_factor_identifier } =
          error.response.body.two_factor_info;
        // decide which method to use
        const verificationMethod = totp_two_factor_on ? "0" : "1"; // default to 1 for SMS
        // At this point a code should have been sent
        // Get the code
        const verificationCode = await this.generateOathCode();
        // Use the code to finish the login process
        await this.ig.account.twoFactorLogin({
          username,
          verificationCode,
          twoFactorIdentifier: two_factor_identifier,
          verificationMethod,
        });
        this.user = await this.ig.account.currentUser();
        await this.listenEvents();
        super.emit("loggedIn");
      }
      this.emit("error", error.message);
    }
  }

  private async leastInteractedWith(): Promise<AccountFollowersFeedResponseUsersItem[]> {
    const { body } = await this.ig.request.send({
      url: `/api/v1/friendships/smart_groups/least_interacted_with/`,
      method: "GET",
      qs: {
        includes_hashtags: true,
        search_surface: "follow_list_page",
        query: "",
        enable_groups: true,
      },
      form: this.ig.request.sign({
        supported_capabilities_new: JSON.stringify(this.ig.state.supportedCapabilities),
        _csrftoken: this.ig.state.cookieCsrfToken,
        _uid: this.ig.state.cookieUserId,
        _uuid: this.ig.state.uuid,
      }),
    });
    return body.users;
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
    return new Promise(async (_resolve, reject) => {
      try {
        const profilePic = await this.getProfilePic(username).then(getImageBuffer);
        const blurredImage = await blurImage(profilePic, 10);
        const { width, height } = await imageMetadata(profilePic);
        getImageColors(profilePic)
          .then(async (result) => {
            registerFont("src/fonts/Solena/Solena-Regular.ttf", { family: "Solena" });
            const canvas = createCanvas(width!, height!);
            const ctx = canvas.getContext("2d");
            ctx.drawImage(await loadImage(blurredImage), 0, 0);
            ctx.font = "200px Solena";
            ctx.textAlign = "center";
            ctx.fillStyle = result.color;
            ctx.lineWidth = 4;
            await ctx.drawTextAlongArc(
              "Feliz viernes!",
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

  public async generateHighlightCover(
    color: Palette,
    emoticon: string,
    counter?: number
  ): Promise<Buffer> {
    return new Promise(async (_resolve, reject) => {
      try {
        registerFont("src/fonts/Solena/Solena-Regular.ttf", {
          family: "Solena",
        });
        const canvas = createCanvas(800, 800);
        const ctx = canvas.getContext("2d");
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2);
        ctx.fillStyle = color.backgroundColor;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2.5, 0, 2 * Math.PI);
        ctx.lineWidth = 3;
        ctx.strokeStyle = color.color;
        ctx.stroke();
        ctx.closePath();
        if (typeof counter !== "undefined") {
          ctx.font = "225px Solena";
          ctx.textAlign = "center";
          ctx.fillStyle = color.color;
          ctx.lineWidth = 4;
          ctx.fillText(`#${counter}`, canvas.width / 2, canvas.height / 3);
        }
        ctx.beginPath();
        ctx.rect(0, canvas.height / 2, (canvas.width - (canvas.width / 2.5) * 2) / 2, 1);
        ctx.rect(
          canvas.width - (canvas.width - (canvas.width / 2.5) * 2) / 2,
          canvas.height / 2,
          (canvas.width - (canvas.width / 2.5) * 2) / 2,
          1
        );
        ctx.strokeStyle = color.color;
        ctx.stroke();
        ctx.closePath();
        ctx.textAlign = "center";
        ctx.fillStyle = color.color;
        ctx.font = `${canvas.width / 2}px san-serif`;
        if (typeof counter !== "undefined") {
          await ctx.drawTextWithEmoji(
            "fill",
            emoticon,
            canvas.width / 2,
            canvas.height / 2 + canvas.height / 10
          );
        } else {
          await ctx.drawTextWithEmoji("fill", emoticon, canvas.width / 2, canvas.height / 2);
        }
        _resolve(await sharp(canvas.toBuffer()).jpeg().toBuffer());
      } catch (error) {
        reject(error.message);
      }
    });
  }

  private async generateOathCode(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (typeof this.config.oath === "undefined") {
        reject("OATH_KEY environment variable not set!");
      }
      exec(`oathtool --totp -b ${this.config.oath}`, (err, stdout) => {
        if (err) {
          reject(err.message);
        }
        resolve(stdout.split("\n")[0]);
      });
    });
  }
}

export default Instagram;
