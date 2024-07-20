const { program } = require('commander');
const fileZip = require('../functions/fileZip');

program
    .option('-zn, --zip-name [name]', 'package zip name')
    .option('-vp, --version-package [version]', 'package version')
    .parse(process.argv);

fileZip.commandExecZip();
