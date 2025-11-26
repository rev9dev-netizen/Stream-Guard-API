
import { decode } from './src/providers/sources/vidsrc/decrypt';

const o = {
  y: 'xx??x?=xx?xx?=',
  u: '#1RyJzl3JYmljm0mkJWOGYWNyI6MfwVNGYXmj9uQj5tQkeYIWoxLCJXNkawOGF5QZ9sQj1YIWowLCJXO20VbVJ1OZ11QGiSlni0QG9uIn19',
};

try {
  console.log('Decoding o.u with standard Base64...');
  const base64Str = o.u.substring(2); // Remove #1
  const decoded = Buffer.from(base64Str, 'base64').toString('utf-8');
  console.log('Decoded string:', decoded);
  console.log('Parsing JSON...');
  const parsed = JSON.parse(decoded);
  console.log('Parsed JSON:', parsed);
} catch (error) {
  console.error('Error:', error);
}
