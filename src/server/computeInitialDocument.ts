import fs from 'fs';
import path from 'path';
import { randomId } from '../randomId.js';
import {
  enableDirectories,
  debugDirectories,
  debugIgnore,
} from './featureFlags.js';
import createIgnore from 'ignore';
import { ignoreFilePattern, baseIgnore } from './config.js';
import { isDirectory } from './isDirectory.js';

// Import the image file utility
const isImageFile = (fileName) => {
  return (
    fileName.match(
      /\.(png|jpg|jpeg|gif|bmp|svg|webp)$/i,
    ) !== null
  );
};

/**
 * @param {string} fullPath - absolut path of the workspace root
 * @param {string} currentDirectoryPath - path where the ignore file is found, relative to fullPath
 * @param {string} fileName - name of the ignore file
 * @returns {string[]} parsed lines
 */
const parseIgnoreFile = (
  fullPath,
  currentDirectory,
  fileName,
) => {
  const filePath = path.join(
    fullPath,
    currentDirectory,
    fileName,
  );
  const content = fs.readFileSync(filePath, 'utf8');
  const globs = content
    .split(/[\n\r]+/)
    .filter(
      // remove blank line and comments
      (line) => line.length > 0 && !line.startsWith('#'),
    )
    .map((line) => {
      const { bang, slash, glob } = line.match(
        /^(?<bang>!?)(?<slash>\/?)(?<glob>.*)$/,
      ).groups;
      const hasSlash =
        Boolean(slash) || /\/.*\S/.test(glob);
      const relativeGlob = path.posix.join(
        currentDirectory.replace(
          // escape characters with special meaning in glob expressions
          /[*?!# \[\]\\]/g,
          (char) => '\\' + char,
        ),
        // a pattern that doesn't include a slash (not counting a trailing one) matches files in any descendant directory od the current one
        hasSlash ? '' : '**',
        glob,
      );
      // preserve leading `!` and `/` characters
      return bang + slash + relativeGlob;
    });
  if (debugIgnore) {
    console.debug(
      'at',
      currentDirectory,
      'parsing',
      fileName,
      'obtained globs',
      globs,
    );
  }
  return globs;
};

// Lists files from the file system,
// converts them into the VZCode internal
// ShareDB-compatible data structure.
export const computeInitialDocument = ({ fullPath }) => {
  // Isolate files, not directories.
  // Inspired by https://stackoverflow.com/questions/41472161/fs-readdir-ignore-directories

  // Initialize the document using our data structure for representing files.
  const initialDocument = {
    // `files`
    //  * Keys are file ids, which are random numbers.
    //  * Values are objects with properties:
    //    * text - the text content of the file
    //    * name - the file name
    files: {},

    // `isInteracting`
    //  * Whether the user is currently interacting with the document
    //    using an interactive code widget such as number dragger.
    //  * When true, the auto-save to the file system is changed to be
    //    more frequent (throttled not debounced).
    // isInteracting: false,
    // This is `undefined` initially.
  };

  /**
   * Stack for recursively traversing directories.
   * @type {string[]}
   */
  const files = [];

  const ignoreFileMatcher = createIgnore().add(
    ignoreFilePattern,
  );
  const isIgnoreFile = (fileName) =>
    ignoreFileMatcher.ignores(fileName);

  const unsearchedDirectories = [
    {
      currentDirectory: '.',
      ignore: createIgnore().add(baseIgnore),
    },
  ];

  while (unsearchedDirectories.length !== 0) {
    const { currentDirectory, ignore: parentIgnore } =
      unsearchedDirectories.pop();
    const currentDirectoryPath = path.join(
      fullPath,
      currentDirectory,
    );
    const dirEntries = fs
      .readdirSync(currentDirectoryPath, {
        withFileTypes: true,
      })
      // Reject symlinks and special files during the initial scan.
      // readFileSync would otherwise follow links outside the root.
      .filter(
        (dirent) =>
          dirent.isFile() ||
          (enableDirectories && dirent.isDirectory()),
      );
    // find .ignore or .gitignore files in the current directory
    const ignoreFiles = dirEntries
      .filter(
        (dirent) =>
          dirent.isFile() && isIgnoreFile(dirent.name),
      )
      .map((file) => file.name);
    let ignore = parentIgnore;
    if (ignoreFiles.length > 0) {
      const globs = ignoreFiles.flatMap((fileName) =>
        parseIgnoreFile(
          fullPath,
          currentDirectory,
          fileName,
        ),
      );
      ignore = createIgnore().add(parentIgnore).add(globs);
    }
    const newFiles = dirEntries
      .filter((dirent) => {
        const relativePath =
          path.posix.join(currentDirectory, dirent.name) +
          (dirent.isDirectory() ? '/' : '');
        const keep = !ignore.ignores(relativePath);
        if (debugIgnore && !keep) {
          console.debug(
            'at',
            currentDirectory,
            'ignoring',
            relativePath,
          );
        }
        return keep;
      })
      // Add a trailing slash for directories
      .map((dirent) => {
        const relativePath = path.posix.join(
          currentDirectory,
          dirent.name,
        );

        if (!dirent.isDirectory()) {
          return relativePath;
        }
        unsearchedDirectories.push({
          currentDirectory: relativePath,
          ignore,
        });
        return relativePath + '/';
      });
    // console.log(currentDirectory);

    files.push(...newFiles);
  }

  files.forEach((file) => {
    const id = randomId();
    let text = null;

    if (!isDirectory(file)) {
      const filePath = path.join(fullPath, file);

      if (isImageFile(file)) {
        // Read image files as binary and convert to base64
        const buffer = fs.readFileSync(filePath);
        text = buffer.toString('base64');
      } else {
        // Read non-image files as UTF-8 text
        text = fs.readFileSync(filePath, 'utf-8');
      }
    }

    initialDocument.files[id] = {
      text,
      name: file,
    };
  });

  if (debugDirectories) {
    console.log('files:');
    console.log(files);
    console.log('initialDocument:');
    console.log(JSON.stringify(initialDocument, null, 2));
  }
  return initialDocument;
};
