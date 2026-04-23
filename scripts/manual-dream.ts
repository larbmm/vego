import { Character } from '../src/character/character.js';
import { DreamTask } from '../src/scheduler/tasks.js';
import { config, getVegoHome } from '../src/config/config.js';
import * as path from 'path';

async function runManualDream(characterName: string) {
  console.log(`Starting manual dream task for ${characterName}...`);

  // Find character config
  const charConfig = config.character[characterName];
  if (!charConfig) {
    console.error(`Character ${characterName} not found in config`);
    console.error(`Available characters: ${Object.keys(config.character).join(', ')}`);
    process.exit(1);
  }

  // Initialize character
  const workspacePath = path.join(getVegoHome(), `workspace_${characterName}`);
  const character = new Character(
    charConfig.name,
    charConfig.display_name,
    workspacePath,
    charConfig.api_key || config.api.key,
    charConfig.api_base || config.api.base,
    charConfig.api_model || config.api.model,
    charConfig.api_timeout
  );

  // Create dream task
  const dreamTask = new DreamTask(character, 1); // Set min_conversations to 1 to force processing

  // Execute dream task
  console.log('Executing dream task...');
  const result = await dreamTask.call({});  // Pass empty state object
  
  console.log('Dream task completed!');
  console.log('Result:', JSON.stringify(result, null, 2));
}

// Get character name from command line
const characterName = process.argv[2];
if (!characterName) {
  console.error('Usage: npm run manual-dream <character_name>');
  console.error('Example: npm run manual-dream xiyue');
  process.exit(1);
}

runManualDream(characterName).catch(error => {
  console.error('Error running manual dream:', error);
  process.exit(1);
});
