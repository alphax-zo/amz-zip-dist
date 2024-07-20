const { program } = require('commander');
const fileZip = require('../functions/fileZip');

program
  .option('-zip, --auto-zip', 'wether to auto zip package')
  .option('-zn, --zip-name [name]', 'package zip name')
  .option('-vp, --version-package [version]', 'package version')
  .allowUnknownOption(true)
  .parse(process.argv);

fileZip.commandExecZip();
