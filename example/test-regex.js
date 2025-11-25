// Quick test to verify the regex pattern works with the actual HTML
import { readFileSync } from 'fs';

// Read the cloudnestra.html file
const html = readFileSync('w:/providers-vidninja-production/example/cloudnestra.html', 'utf8');

// Test the regex pattern
const pattern = /src:\s+'(\/prorcp\/[^']+)'/;
const match = html.match(pattern);

if (match) {
    console.log('✅ SUCCESS! Found /prorcp/ URL:');
    console.log('Full match:', match[0]);
    console.log('Captured URL:', match[1]);
} else {
    console.log('❌ FAILED! Could not find /prorcp/ URL');
    console.log('\nSearching for variations...');
    
    // Try to find what's actually in the HTML
    const srcPattern = /src:\s*['"][^'"]*prorcp[^'"]*['"]/g;
    const allMatches = html.match(srcPattern);
    if (allMatches) {
        console.log('Found these src patterns with prorcp:');
        allMatches.forEach(m => console.log('  -', m));
    }
}

