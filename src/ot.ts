// Operational Transformation (OT) utilities.
// This file is the central point where the OT types are imported.
// Localized to one file so it's easy to change it in future.
import OTJSON1Presence from 'sharedb-client-browser/dist/ot-json1-presence-umd.cjs';
import jsondiff from 'json0-ot-diff';
import {
  diff_match_patch as DiffMatchPatch,
  DIFF_DELETE,
  DIFF_INSERT,
  DIFF_EQUAL,
} from '@dmsnell/diff-match-patch';

// Attach the constants to the class as static properties for compatibility with json0-ot-diff
DiffMatchPatch.DIFF_DELETE = DIFF_DELETE;
DiffMatchPatch.DIFF_INSERT = DIFF_INSERT;
DiffMatchPatch.DIFF_EQUAL = DIFF_EQUAL;

export const { json1Presence, textUnicode } =
  OTJSON1Presence;

// The OT type used throughout the codebase.
export const otType = json1Presence.type;

// Applies an OT op to an object.
export const apply = otType.apply;

// ---------------------------------------------------------------------------
// Unicode-safe text diffing
// ---------------------------------------------------------------------------
//
// `json0-ot-diff` asks diff-match-patch for text patches and converts the
// resulting offsets into `textUnicode` (ot-text-unicode) operations. This is
// incorrect for text containing astral-plane characters (emoji, etc.):
//
//  1. diff-match-patch measures offsets in UTF-16 code units, while
//     ot-text-unicode measures them in Unicode code points.
//  2. diff-match-patch can split a surrogate pair across diffs (it may treat
//     the high and low halves of an emoji as independent characters).
//
// Both produce operations that either fail to apply ("The op is too long for
// this document", "Invalid offset - splits unicode bytes") or apply
// incorrectly.
//
// The fix: when either string contains astral characters, encode each astral
// code point as a single unused BMP placeholder before diffing. One UTF-16
// unit then equals one code point and surrogate pairs can never be split. The
// generated text operation is decoded back to the original characters.
// Strings without astral characters keep using the original (correct and
// faster) code path.

const hasSurrogates = (value: string): boolean =>
  /[\uD800-\uDFFF]/.test(value);

const textDiffMatchPatch = new DiffMatchPatch();

// State describing the string currently being diffed by json0-ot-diff.
let currentOldValue = '';
let currentNewValue = '';
let pendingTextEdit = false;
let needsUnicodeSafeDiff = false;

interface AstralEncoding {
  encodedOldValue: string;
  encodedNewValue: string;
  decode: (value: string) => string;
}

// `for...of` over a string iterates code points; an astral code point is
// represented as two UTF-16 code units (i.e. `char.length === 2`).
const encodeAstralCharacters = (
  oldValue: string,
  newValue: string,
): AstralEncoding | null => {
  if (
    !hasSurrogates(oldValue) &&
    !hasSurrogates(newValue)
  ) {
    return null;
  }

  // BMP characters already used by the input, so placeholders never collide.
  const used = new Set<string>();
  for (const char of oldValue) used.add(char);
  for (const char of newValue) used.add(char);

  const astralCharacters = new Set<string>();
  for (const char of oldValue) {
    if (char.length === 2) astralCharacters.add(char);
  }
  for (const char of newValue) {
    if (char.length === 2) astralCharacters.add(char);
  }

  const astralToPlaceholder = new Map<string, string>();
  const placeholderToAstral = new Map<string, string>();

  // Assign each distinct astral code point an unused, non-surrogate BMP code
  // point. The BMP has ~63k usable code points, far more than the number of
  // distinct astral characters found in practice.
  let candidate = 0xe000;
  const nextPlaceholder = (): string => {
    for (let attempts = 0; attempts < 0x10000; attempts++) {
      if (candidate > 0xffff) candidate = 0x0020;
      const placeholder = String.fromCharCode(candidate++);
      if (!used.has(placeholder)) return placeholder;
    }
    throw new Error(
      'Unable to encode astral characters for diffing',
    );
  };

  for (const astral of astralCharacters) {
    const placeholder = nextPlaceholder();
    astralToPlaceholder.set(astral, placeholder);
    placeholderToAstral.set(placeholder, astral);
  }

  const encode = (value: string): string => {
    let encoded = '';
    for (const char of value) {
      encoded +=
        char.length === 2
          ? (astralToPlaceholder.get(char) as string)
          : char;
    }
    return encoded;
  };

  const decode = (value: string): string => {
    let decoded = '';
    for (const char of value) {
      decoded += placeholderToAstral.get(char) ?? char;
    }
    return decoded;
  };

  return {
    encodedOldValue: encode(oldValue),
    encodedNewValue: encode(newValue),
    decode,
  };
};

// Builds an ot-text-unicode operation from diff-match-patch's diffs. Skips are
// counted in code points, which (after encoding) equal UTF-16 units.
const buildTextOp = (
  oldValue: string,
  newValue: string,
): Array<unknown> => {
  const encoding = encodeAstralCharacters(
    oldValue,
    newValue,
  );
  const oldText = encoding
    ? encoding.encodedOldValue
    : oldValue;
  const newText = encoding
    ? encoding.encodedNewValue
    : newValue;
  const decode = encoding
    ? encoding.decode
    : (value: string) => value;

  const diffs = textDiffMatchPatch.diff_main(
    oldText,
    newText,
  );

  const components: Array<unknown> = [];
  for (const [operation, text] of diffs) {
    if (text.length === 0) continue;
    if (operation === DIFF_EQUAL) {
      components.push(text.length);
    } else if (operation === DIFF_DELETE) {
      components.push({ d: decode(text) });
    } else if (operation === DIFF_INSERT) {
      components.push(decode(text));
    }
  }

  // Canonicalize: merge adjacent skips and drop a trailing skip, as required
  // by ot-text-unicode's op validation.
  const op: Array<unknown> = [];
  for (const component of components) {
    if (typeof component === 'number') {
      if (component <= 0) continue;
      const last = op[op.length - 1];
      if (typeof last === 'number') {
        op[op.length - 1] = last + component;
      } else {
        op.push(component);
      }
    } else {
      op.push(component);
    }
  }
  while (
    op.length > 0 &&
    typeof op[op.length - 1] === 'number'
  ) {
    op.pop();
  }
  return op;
};

class UnicodeSafeDiffMatchPatch extends DiffMatchPatch {
  patch_make(a: any, b?: any): any {
    currentOldValue = a;
    currentNewValue = b;
    pendingTextEdit = true;
    needsUnicodeSafeDiff =
      hasSurrogates(a) || hasSurrogates(b);
    return b === undefined
      ? super.patch_make(a)
      : super.patch_make(a, b);
  }
}

// Wrap the json1 type so text edits for strings containing astral characters
// are built by the unicode-safe routine above. All other operations (and text
// without astral characters) delegate unchanged.
const unicodeSafeJson1 = {
  ...json1Presence,
  editOp: (
    path: Array<string | number>,
    type: unknown,
    op: unknown,
  ) => {
    if (type === textUnicode.type && needsUnicodeSafeDiff) {
      if (pendingTextEdit) {
        pendingTextEdit = false;
        return json1Presence.editOp(
          path,
          type,
          buildTextOp(currentOldValue, currentNewValue),
        );
      }
      // The full text op was already emitted for this string; the
      // remaining edits reported by json0-ot-diff are redundant.
      return json1Presence.editOp(path, type, []);
    }
    return json1Presence.editOp(path, type, op);
  },
};

export const diff = (a, b) =>
  jsondiff(
    a,
    b,
    UnicodeSafeDiffMatchPatch,
    unicodeSafeJson1,
    textUnicode,
  );
