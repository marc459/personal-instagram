import { LoggerOptions, createLogger, format, transports } from 'winston';
const { combine, colorize, timestamp, printf, simple } = format;

const options: LoggerOptions = {
  transports: [
    new transports.Console({
      level: 'debug',
      format: combine(
        colorize({
          message: true
        }),
        simple(),
        timestamp({ format: 'HH:mm:ss.SSS' }),
        printf(({ message, timestamp }) => {
          return `[${timestamp}] ${message}`;
        })
      )
    })
  ]
};

const logger = createLogger(options);

export default logger;
