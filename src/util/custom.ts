import { Job } from "bullmq";

export const isPromise = (fn: Function): boolean => {
  return fn && Object.prototype.toString.call(fn) === "[object Promise]";
};

export const delay = (m: number, fn?: () => Promise<void> | void): Promise<Job<any> | any> => {
  return new Promise((resolve) => {
    if (typeof fn === "function") {
      setTimeout(async () => {
        if (isPromise(fn)) {
          resolve(await fn());
        } else {
          resolve(fn());
        }
      }, m);
    } else {
      setTimeout(resolve, m);
    }
  });
};
