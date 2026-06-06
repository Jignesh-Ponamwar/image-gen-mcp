// Simple test script for data URL regex used in openrouter
const dataUrlRegex = /data:image\/[a-zA-Z.-]+;base64,[a-zA-Z0-9+/=_-]+/g;

const samples = [
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA',
  'not a data url',
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD',
];

function assertEquals(a, b, msg) {
  if (a !== b) {
    console.error('FAIL:', msg, a, '!==', b);
    process.exit(1);
  }
}

const matches = samples[0].match(dataUrlRegex);
assertEquals(Array.isArray(matches) && matches.length === 1, true, 'should match png data url');

const matches2 = samples[1].match(dataUrlRegex);
assertEquals(matches2, null, 'non-data url should not match');

const matches3 = samples[2].match(dataUrlRegex);
assertEquals(Array.isArray(matches3) && matches3.length === 1, true, 'should match jpeg data url');

console.log('All data URL regex tests passed');
