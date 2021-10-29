import { writeFileSync, readFileSync, existsSync } from 'fs';

export class HandleSession {
  path: string;

  constructor() {
    this.path = "data/instagram/data.json";
  }

  persistSession(data: SerializedSession): void {
    return writeFileSync(
      process.cwd() + "/data/instagram/data.json",
      JSON.stringify(data, null, 2),
      {
        encoding: 'utf-8'
      }
    );
  }

  existSessionFile(): boolean {
    return existsSync(process.cwd() + "/data/instagram/data.json");
  }

  loadSessionFile(): SerializedSession {
    return JSON.parse(
      readFileSync(process.cwd() + "/data/instagram/data.json", {
        encoding: 'utf-8'
      })
    );
  }
}
