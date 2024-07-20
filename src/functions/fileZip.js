/*
 * @Author: AlphaX Zo
 * @Email: zhouzhixuan@chinasie.com
 * @Date: 2023-03-26 18:48:22
 * @LastEditTime: 2023-04-07 08:52:19
 * @LastEditors: Do not edit
 * @FilePath: \WeBoard\scripts\functions\fileZip.js
 * @Description: 压缩业务项目代码
 */

const { program } = require("commander");
const fileUtils = require("./fileUtils");
const fs = require("fs");
const fse = require("fs-extra");
const globby = require("globby");
const ora = require("ora");
const colors = require("chalk");
const path = require("path");
const archiver = require("archiver");
const fileUtil = require("./fileUtils");
const log = require("../common/logUtils");

module.exports = {
  getOutputPath(ext = "zip", outputPath, fileName) {
    return path.join(
      outputPath || process.env.DEV_BACKUP_PATH,
      `${fileName}.${ext}`
    );
  },
  createArchiver(option = {}, callback, appendCall) {
    log.succeed(`[Archiver] Begins To Compresse File...`, "", "");
    // create a file to stream archive data to.
    const { ext = "zip", outputPath, fileName } = option;
    const outputName = this.getOutputPath(ext, outputPath, fileName);
    const output = fs.createWriteStream(outputName);
    const archive = archiver(ext, {
      zlib: { level: 9 }, // Sets the compression level.
    });

    this.bindEvent(output, archive, callback, outputName);

    // pipe archive data to the file
    archive.pipe(output);

    if (typeof appendCall === "function") {
      appendCall(archive);
    } else {
      archive.directory(process.cwd(), false);
    }

    archive.finalize();
  },
  bindEvent(output, archive, callback, outputName) {
    output.on("open", function () {
      log.succeed(`[Archiver] The Compressed File Begins To Write...`, "", "");
      typeof callback === "function" && callback("open");
    });

    // listen for all archive data to be written
    // 'close' event is fired only when a file descriptor is involved
    output.on("close", function () {
      const total = log.colors.cyan(
        (archive.pointer() / 1024).toFixed(2) + "KB"
      );
      log.succeed(`[Archiver] ${total} Total Bytes Have Been Treated`, "", "");
      log.succeed(`[Archiver] Archiver Has Been finalized`, "", "");
      log.succeed(`[Archiver] The Output File Descriptor Has Closed`, "");
      log.succeed(`[Archiver] File Be Compressed`, outputName);
      typeof callback === "function" && callback("succeed");
    });

    // This event is fired when the data source is drained no matter what was the data source.
    // It is not part of this library but rather from the NodeJS Stream API.
    // @see: https://nodejs.org/api/stream.html#stream_event_end
    output.on("end", function () {
      log.failed(`[Archiver] Data Has Been Drained`, "", "");
      typeof callback === "function" && callback("drained");
    });

    // good practice to catch warnings (ie stat failures and other non-blocking errors)
    archive.on("warning", function (err) {
      if (err.code === "ENOENT") {
        log.warned(`[Archiver] Archive Has Encountered A`, outputName, "");
        typeof callback === "function" && callback("waning", err);
      } else {
        log.failed(`[Archiver] Archive Has Encountered An Error`, "", "", err);
        typeof callback === "function" && callback("failed", err);
        throw err;
      }
    });

    // good practice to catch this error explicitly
    archive.on("error", function (err) {
      log.failed(
        `[Archiver] Archive Has Encountered An Error`,
        "",
        "Failed",
        err
      );
      typeof callback === "function" && callback("error", err);
      throw err;
    });
  },
  getZipName(zipName, fileName) {
    return zipName || path.basename(fileName);
  },
  zipDirectory(dir, ignores, option = {}, globOption = {}) {
    const { ext = "zip", outputPath, fileName } = option;
    const zipRootPath = dir.replace(/\\/g, "/");
    const zipTemp = "/.zipTemp";
    const dirIgnores = ignores.map((item) =>
      path.join(dir, item).replace(/\\/g, "/")
    );
    log.message(
      `[Archiver] Begins To Collect The Files Need To Be Compressed...`,
      "",
      ""
    );
    const spinner = ora(colors.green(`Files Collecting...`)).start();
    spinner.color = "green";
    globby(`${zipRootPath}/**/*`, {
      gitignore: true,
      cwd: process.cwd(),
      dot: true,
      ...globOption,
      // ignoreFiles: ['package-lock.json'],
      // onlyDirectories: false,
      // ignore:['**/.packaged/**']
      // deep: 2,
    }).then((srcFiles) => {
      log.succeed(`[Archiver] Total Files To Be Compressed Is Collected`);
      spinner.stop();
      srcFiles = fileUtil.filterFiles(srcFiles, dirIgnores);
      const desFiles = srcFiles.map((file) => {
        const arrFile = file.split(zipRootPath);
        return [zipRootPath, zipTemp, arrFile[1]].join("");
      });

      srcFiles.map((file, idx) => fse.copySync(file, desFiles[idx]));
      const spinnerCompress = ora(colors.green(`Files Compressing...`)).start();
      spinnerCompress.color = "green";
      this.createArchiver(
        { ext, outputPath, fileName },
        (eventType) => {
          if (eventType === "succeed") {
            fse.remove(path.join(zipRootPath, zipTemp));
            spinnerCompress.succeed(colors.green("Compressed Successfully"));
            if (typeof callback === "function") callback();
          }

          if (["error", "failed"].includes(eventType)) {
            spinnerCompress.fail(colors.red("Compressed Failed"));
          }
        },
        (archive) => {
          archive.directory(path.join(zipRootPath, zipTemp), false);
        }
      );
    });
  },
  editMenuConfig(assetsContent) {
    // 解析命令行参数前可以添加以下代码来允许未知选项
    program
      .option("-zip, --auto-zip", "wether to auto zip package", false)
      .option("-zn, --zip-name [name]", "package zip name")
      .option("-vp, --version-package [version]", "package version")
      .allowUnknownOption(true)
      .parse(process.argv);

    const options = program.opts();

    if (!options.zipName && !options.versionPackage) return assetsContent;

    let content = "";
    if (this.isBuffer(assetsContent)) {
      assetsContent = assetsContent.toString("utf8");
    }

    content = eval(`(${assetsContent})`);

    if (typeof options.zipName === "string" && options.zipName) {
      content.zipname = options.zipName;
    } else {
      content.zipname = +content.zipname;
      content.zipname += 1;
    }

    this.zipName = content.zipname;

    if (typeof options.versionPackage === "string" && options.versionPackage) {
      content.version = options.versionPackage;
    } else {
      let version = content.version;
      let lastPart = +version.substring(version.lastIndexOf(".") + 1);
      lastPart += 1;
      content.version =
        version.substring(0, version.lastIndexOf(".") + 1) + lastPart;
    }

    return JSON.stringify(content, null, "\t");
  },
  commandExecZip() {
    const tmpPath = fileUtils.getPath("dist/menus.config", process.cwd());
    fileUtils.editSync(tmpPath, (fileContent) => {
      return this.editMenuConfig(fileContent);
    });

    this.exec();
  },
  execZip() {
    program
      .option("-zip, --auto-zip", "wether to auto zip package")
      .allowUnknownOption(true)
      .parse(process.argv);

    const options = program.opts();
    if (options.autoZip) {
      this.exec();
    }
  },
  exec() {
    Promise.resolve().then(() => {
      const tmpSrc = fileUtils.getPath("dist/menus.config", process.cwd());
      const tmpDes = fileUtils.getPath("static/menus.config", process.cwd());
      fileUtils.fsCopy(tmpSrc, tmpDes, () => {
        const ignores = [];
        const rootPath = fileUtils.getPath("dist", process.cwd());

        this.zipDirectory(
          rootPath,
          ignores,
          { outputPath: rootPath, fileName: this.zipName || "dist" },
          { gitignore: false }
        );
      });
    });
  },
  isBuffer(str) {
    return str && typeof str === "object" && Buffer.isBuffer(str);
  },
};
