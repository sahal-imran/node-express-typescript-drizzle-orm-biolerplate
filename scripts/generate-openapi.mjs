import { writeFile } from 'node:fs/promises';
import { openapi } from '../dist/docs/openapi.js';

await writeFile('openapi.generated.json', `${JSON.stringify(openapi, null, 2)}\n`);
console.log('Generated openapi.generated.json');
