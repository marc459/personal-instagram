import { LoggerOptions, createLogger, format, transports } from 'winston';
const { combine, colorize, timestamp, printf, simple, json } = format;

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
    }),
    new transports.File({
			filename: 'logs/combined.log',
			maxsize: 50000000, // 15MB,
      level: "debug",
			maxFiles: 1,
			format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), json())
		})
  ]
};

const logger = createLogger(options);

export default logger;
