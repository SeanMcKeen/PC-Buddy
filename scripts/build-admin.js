const sudo = require('sudo-prompt');
const path = require('path');

const options = {
  name: 'PC Buddy Builder'
};

// Use PowerShell to run npm
const command = 'powershell.exe -Command "Set-Location \\"' + process.cwd() + '\\"; npm run build"';

sudo.exec(command, options, function(error, stdout, stderr) {
  if (error) {
    console.error('Error:', error);
    console.error('Stderr:', stderr);
    return;
  }
  console.log(stdout);
}); 