import ipc from "node-ipc";
import logger from "../util/logger";

ipc.config.id = "shared";
ipc.config.stopRetrying = true;
ipc.config.silent = true;

ipc.connectTo("shared", function () {
  ipc.of.shared.on("connect", function () {
    let arg = process.argv[2];
    switch (arg) {
      case "--ig-set-friday-profile-avatar":
        ipc.of.shared.emit("message", {
          event: "ig-set-friday-profile-avatar"
        });
        break;
      case "--ig-reset-profile-avatar":
        ipc.of.shared.emit("message", {
          event: "ig-reset-profile-avatar"
        });
        break;
      case "--ig-upload-history":
        ipc.of.shared.emit("message", {
          event: "ig-upload-history"
        });
        break;
      case "--ig-highlights":
        ipc.of.shared.emit("message", {
          event: "ig-highlights"
        });
        break;
      case "--ig-followers":
        ipc.of.shared.emit("message", {
          event: "ig-followers"
        });
        break;
      case "--ig-listen-events":
        ipc.of.shared.emit("message", {
          event: "ig-listen-events"
        });
        break;
      case "--ig-music-lyrics":
        ipc.of.shared.emit("message", {
          event: "ig-music-lyrics",
          data: process.argv[3],
        });
        break;
      case "--sp-sync":
        ipc.of.shared.emit("message", {
          event: "sp-sync"
        });
        break;
      default:
        logger.warn(`${arg} argument not found!`);
        break;
    }
  });
  ipc.of.shared.on("message", function (data) {
    console.log(data);
  });
  ipc.of.shared.on("destroy", function () {
    process.exit(0);
  });
});
