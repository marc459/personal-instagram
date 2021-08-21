import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export class HandleSession {
  path: string;

  constructor() {
    this.path = resolve(__dirname, '..', '..', 'data', 'data.json');
  }

  persistSession(data: SerializedSession): void {
    return writeFileSync(
      resolve(__dirname, '..', '..', 'data', 'data.json'),
      JSON.stringify(data, null, 2),
      {
        encoding: 'utf-8'
      }
    );
  }

  existSessionFile(): boolean {
    return existsSync(resolve(__dirname, '..', '..', 'data', 'data.json'));
  }

  loadSessionFile(): SerializedSession {
    return JSON.parse(
      readFileSync(resolve(__dirname, '..', '..', 'data', 'data.json'), {
        encoding: 'utf-8'
      })
    );
  }
}
