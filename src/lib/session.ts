import { writeFileSync, readFileSync, existsSync } from 'fs';

export class HandleSession {
  path: string;
  username: string;

  constructor(username: string) {
    this.path = `data/instagram/${username}-data.json`;
    this.username = username;
  }

  persistSession(data: SerializedSession): void {
    return writeFileSync(
      process.cwd() + `/data/instagram/${this.username}-data.json`,
      JSON.stringify(data, null, 2),
      {
        encoding: 'utf-8'
      }
    );
  }

  existSessionFile(): boolean {
    return existsSync(process.cwd() + `/data/instagram/${this.username}-data.json`);
  }

  loadSessionFile(): SerializedSession {
    return JSON.parse(
      readFileSync(process.cwd() + `/data/instagram/${this.username}-data.json`, {
        encoding: 'utf-8'
      })
    );
  }
}
