const fs = require('fs');
const path = require('path');

const transcriptPath = 'C:/Users/Administrator.TNEB/.gemini/antigravity-ide/brain/7e119f0a-eb20-4209-a032-e30c564d0a38/.system_generated/logs/transcript_full.jsonl';

try {
  const fileContent = fs.readFileSync(transcriptPath, 'utf8');
  const firstLine = fileContent.split('\n')[0];
  const parsed = JSON.parse(firstLine);
  const content = parsed.content;
  
  console.log("User request length:", content.length);
  
  // Search for conflict markers in the user's request
  const markers = ['<<<<<<<', '=======', '>>>>>>>'];
  markers.forEach(marker => {
    let index = -1;
    while ((index = content.indexOf(marker, index + 1)) !== -1) {
      console.log(`Found marker "${marker}" at index ${index}. Context around it:`);
      console.log(content.substring(Math.max(0, index - 200), Math.min(content.length, index + 200)));
      console.log("-".repeat(40));
    }
  });

  // Let's also print the last 2000 characters of the user prompt, in case the conflict is at the end.
  console.log("\nLast 2000 characters of the user prompt:");
  console.log(content.substring(content.length - 2000));
  
} catch (err) {
  console.error("Error:", err);
}
