const fs = require('node:fs');
const path = require('node:path');

/** Requires every .js file in a directory (relative to the project root). */
const loadModules = (directory) => {
  const absolute = path.join(__dirname, '..', directory);
  return fs
    .readdirSync(absolute)
    .filter((file) => file.endsWith('.js'))
    .map((file) => ({
      file: path.join(directory, file),
      module: require(path.join(absolute, file)),
    }));
};

const loadCommands = () => {
  const commands = [];
  for (const { file, module: command } of loadModules('commands')) {
    if (command.data && command.execute) commands.push(command);
    else console.warn(`[commands] ${file} is missing a "data" or "execute" export, skipping.`);
  }
  return commands;
};

module.exports = { loadModules, loadCommands };
