import { createRoot } from 'react-dom/client';
import { EditorView } from 'codemirror';
import {
  Compartment,
  EditorState,
  StateField,
} from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { svelte } from '@replit/codemirror-lang-svelte';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json1Sync } from 'codemirror-ot';

import { autocompletion } from '@codemirror/autocomplete';
import { indentationMarkers } from '@replit/codemirror-indentation-markers';
// import { showMinimap } from '@replit/codemirror-minimap';
import { vscodeKeymap } from '@replit/codemirror-vscode-keymap';
import {
  Diagnostic,
  linter,
  lintGutter,
} from '@codemirror/lint';

import { json1Presence, textUnicode } from '../../ot';
import { PaneId, ShareDBDoc, Username } from '../../types';
import { VizFileId, VizContent } from '@vizhub/viz-types';
import { json1PresenceBroadcast } from './json1PresenceBroadcast';
import { json1PresenceDisplay } from './json1PresenceDisplay';
import {
  colorsInTextPlugin,
  rotationIndicator,
  widgets,
} from './InteractiveWidgets';
import {
  EditorCache,
  editorCacheKey,
  EditorCacheValue,
} from '../useEditorCache';
import { ThemeLabel, themeOptionsByLabel } from '../themes';
import {
  keymap,
  Decoration,
  WidgetType,
  ViewUpdate,
  ViewPlugin,
  DecorationSet,
} from '@codemirror/view';
import { Range } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { RegExpCursor } from '@codemirror/search';
import { basicSetup } from './basicSetup';
import { InteractRule } from '@replit/codemirror-interact';
import rainbowBrackets from './rainbowBrackets';
import { cssLanguage } from '@codemirror/lang-css';
import { javascriptLanguage } from '@codemirror/lang-javascript';
import { copilot } from './Copilot';
import { type WorkerShape } from '@valtown/codemirror-ts/src/worker';
import * as Comlink from 'comlink';
import {
  tsAutocompleteWorker,
  tsFacetWorker,
  tsHoverWorker,
  tsLinterWorker,
  tsSyncWorker,
} from '@valtown/codemirror-ts';
import { getFileExtension } from '../utils/fileExtension';
import { SparklesSVG } from '../Icons/SparklesSVG';
import { MINIMAL_EXTENSIONS } from '../featureFlags';

const DEBUG = false;
const enableToDoPlugin = true;

// Define a StateField to store the file name.
// This should be defined at the module level if it's to be imported by other modules.
export const fileNameStateField = StateField.define<string>(
  {
    create: () => '', // Default initial value
    update: (value, _tr) => value, // Typically set once at creation for a given editor instance
  },
);

// Enables TypeScript +JSX support in CodeMirror.
const tsx = () =>
  javascript({ jsx: true, typescript: true });

// Lazy initialization of worker
let worker: Comlink.Remote<WorkerShape> | null = null;
const initializeWorker = async () => {
  if (worker === null) {
    const innerWorker = new Worker(
      new URL(
        './typescriptExtension/worker.ts',
        import.meta.url,
      ),
      {
        type: 'module',
      },
    );
    worker = Comlink.wrap<WorkerShape>(innerWorker);
    await worker.initialize();
  }
  return worker;
};

const htmlConfig = {
  matchClosingTags: true,
  selfClosingTags: false,
  autoCloseTags: true,
  extraTags: {},
  extraGlobalAttributes: {},
  nestedLanguages: [
    {
      tag: 'script',
      language: javascript,
      parser: javascriptLanguage.parser,
    },
    {
      tag: 'style',
      language: css,
      parser: cssLanguage.parser,
    },
  ],
  nestedAttributes: [],
};

// Language extensions for CodeMirror.
// Keys are file extensions.
// Values are CodeMirror extensions.
// TODO consider moving this to a separate file.
const languageExtensions = {
  json,
  tsx,
  js: tsx,
  jsx: tsx,
  ts: tsx,
  html: () => html(htmlConfig),
  css,
  md: markdown,
  prompt: markdown,
  svelte,
};

// Exported utility function to get language extension for a file extension
export const getLanguageExtension = (
  fileExtension: string,
) => {
  const languageFunc = languageExtensions[fileExtension];
  return languageFunc ? languageFunc() : undefined;
};

// Gets a value at a path in an object.
// e.g. getAtPath({a: {b: 1}}, ['a', 'b']) === 1
const getAtPath = (obj, path) => {
  let current = obj;
  for (const key of path) {
    if (!current) return undefined;
    current = current[key];
  }
  return current;
};

// Extend the EditorCacheValue type to include the compartments and the updateRainbowBrackets method
interface ExtendedEditorCacheValue extends EditorCacheValue {
  themeCompartment: Compartment;
  languageCompartment: Compartment;
  rainbowBracketsCompartment: Compartment;
  updateRainbowBrackets: (enabled: boolean) => void;
}

// Gets or creates an `editorCache` entry for the given file id.
// Looks in `editorCache` first, and if not found, creates a new editor.
export const getOrCreateEditor = async ({
  paneId = 'root',
  fileId,
  shareDBDoc,
  filesPath,
  localPresence,
  docPresence,
  theme,
  onInteract,
  editorCache,
  usernameRef,
  customInteractRules,
  enableAutoFollowRef,
  aiCopilotEndpoint,
  esLintSource,
  rainbowBracketsEnabled = true,
  setIsAIChatOpen,
  setAIChatMessage,
  enableBuiltInAIChat = true,
}: {
  // TODO pass this in from the outside
  paneId?: PaneId;
  fileId: VizFileId;

  // The ShareDB document that contains the file.
  // Used when the editor is created for:
  //  * Figuring out the initial text
  //  * Figuring out the initial language extension
  //    based on the file extension.
  // It's also passed into the `json1Sync` extension,
  // which is used for multiplayer editing.
  // This can be `undefined` in the case where we are
  // viewing files read-only, in which case multiplayer
  // editing is not enabled.
  shareDBDoc: ShareDBDoc<VizContent>;

  filesPath: string[];
  localPresence: any;
  docPresence: any;
  theme: ThemeLabel;
  onInteract?: () => void;
  editorCache: EditorCache;
  usernameRef: React.MutableRefObject<Username>;
  aiAssistEndpoint?: string;
  customInteractRules?: Array<InteractRule>;

  // Ref to a boolean that determines whether to
  // enable auto-following the cursors of remote users.
  enableAutoFollowRef: React.MutableRefObject<boolean>;
  aiCopilotEndpoint?: string;
  esLintSource: (
    view: EditorView,
  ) => Promise<readonly Diagnostic[]>;
  rainbowBracketsEnabled?: boolean; // New parameter type
  setIsAIChatOpen: (isAIChatOpen: boolean) => void;
  setAIChatMessage: (message: string) => void;
  // When false, skip the "Implement the TODO" widget, which opens
  // VZCode's built-in AI chat (hosts that own the AI entry point
  // disable it).
  enableBuiltInAIChat?: boolean;
}): Promise<ExtendedEditorCacheValue> => {
  // Cache hit

  const cacheKey = editorCacheKey(fileId, paneId);

  if (editorCache.has(cacheKey)) {
    return editorCache.get(
      cacheKey,
    ) as ExtendedEditorCacheValue;
  }

  // Cache miss

  // Compute `text` and `fileExtension` from the ShareDB document.
  const textPath = [...filesPath, fileId, 'text'];
  const namePath = [...filesPath, fileId, 'name'];
  const content = shareDBDoc.data;
  const text = getAtPath(content, textPath);
  const name = getAtPath(content, namePath);

  const fileExtension = getFileExtension(name);

  // Create a compartment for the theme so that it can be changed dynamically.
  // Inspired by: https://github.com/craftzdog/cm6-themes/blob/main/example/index.ts
  const themeCompartment = new Compartment();

  // Create a compartment for rainbow brackets so that it can be enabled/disabled dynamically.
  const rainbowBracketsCompartment = new Compartment();

  // Create a compartment for language so that it can be changed dynamically.
  const languageCompartment = new Compartment();

  // The CodeMirror extensions to use.
  const extensions = [];

  // Initialize the fileNameStateField with the actual file name
  extensions.push(fileNameStateField.init(() => name));

  // This plugin implements multiplayer editing,
  // real-time synchronozation of changes across clients.
  // Does not deal with showing others' cursors.
  if (shareDBDoc) {
    extensions.push(
      json1Sync({
        shareDBDoc,
        path: textPath,
        json1: json1Presence,
        textUnicode,
      }),
    );

    // Only add presence extensions if MINIMAL_EXTENSIONS is false
    if (!MINIMAL_EXTENSIONS) {
      // Deals with broadcasting changes in cursor location and selection.
      if (localPresence) {
        extensions.push(
          json1PresenceBroadcast({
            path: textPath,
            localPresence,
            usernameRef,
          }),
        );
      }

      // Deals with receiving the broadcast from other clients and displaying them.
      if (docPresence) {
        extensions.push(
          json1PresenceDisplay({
            path: textPath,
            docPresence,
            enableAutoFollowRef,
          }),
        );
      }
    }
  } else {
    // If the ShareDB document is not provided,
    // then we do not allow editing.
    extensions.push(EditorView.editable.of(false));
  }

  // Add language extension (needed for both minimal and full modes)
  const languageExtension =
    getLanguageExtension(fileExtension);
  if (languageExtension) {
    extensions.push(
      languageCompartment.of(languageExtension),
    );
  } else {
    extensions.push(languageCompartment.of([]));
  }

  // If MINIMAL_EXTENSIONS is true, only include the JSON1 OT extension and essential functionality
  if (MINIMAL_EXTENSIONS) {
    // Only the most basic extensions are added
    // The JSON1 OT extension and language extension are already added above
  } else {
    // Full feature set - include all extensions
    extensions.push(colorsInTextPlugin);

    // This is the "basic setup" for CodeMirror,
    // which actually adds a ton on functionality.
    // TODO vet this functionality, and determine how much
    // we want to replace with
    // https://github.com/vizhub-core/vzcode/issues/134
    extensions.push(basicSetup);

    if (esLintSource) {
      extensions.push(lintGutter()); // Show lint icons in the gutter
      extensions.push(
        linter(esLintSource, {
          // You can configure linter options here, e.g., delay
          delay: 750,
        }),
      );
    }

    // This supports dynamic changing of the theme.
    extensions.push(
      themeCompartment.of(themeOptionsByLabel[theme].value),
    );

    // Adds compartment for rainbow brackets with initial toggle state.
    extensions.push(
      rainbowBracketsCompartment.of(
        rainbowBracketsEnabled ? rainbowBrackets() : [],
      ),
    );

    // Enable line wrapping for Markdown files
    if (
      fileExtension === 'md' ||
      fileExtension === 'prompt'
    ) {
      extensions.push(EditorView.lineWrapping);
    }

    // Add interactive widgets.
    // Includes the Alt+drag functionality for numbers.
    // Calls `onInteract` when one of those widgets is interacted with.
    // This can be used to trigger a transition to throttled mode
    // for hot reloading.
    // TODO consider leveraging the new `dragEnd` event handler.
    // and removing the `onInteract` callback, replacing it with
    // `onInteractStart` and `onInteractEnd`.
    // That may be tricky for one-off interactions though, like
    // the boolean checkboxes. The color pickers are also tricky,
    // as they would also need to be able to handle `onInteractEnd`.
    // See https://github.com/replit/codemirror-interact/issues/14
    extensions.push(
      widgets({ onInteract, customInteractRules }),
    );

    // TODO fix the bugginess in this one where
    // the highlight persists after the mouse leaves.
    // extensions.push(highlightWidgets);

    extensions.push(rotationIndicator);

    // extensions.push(
    //   AIAssistCodeMirrorKeyMap({
    //     shareDBDoc,
    //     fileId,
    //     tabList,
    //     aiAssistEndpoint,
    //     aiAssistOptions,
    //   }),
    // );

    // Add the extension that provides indentation markers.
    extensions.push(
      indentationMarkers({
        // thickness: 2,
        colors: {
          light: '#4d586b',
          dark: '#4d586b',
          activeLight: '#8e949f',
          activeDark: '#8e949f',
        },
      }),
    );

    if (name.endsWith('ts') || name.endsWith('tsx')) {
      // Initialize worker if needed
      const tsWorker = await initializeWorker();

      extensions.push(
        ...[
          tsFacetWorker.of({
            worker: tsWorker,
            path: name,
          }),
          tsSyncWorker(),
          tsLinterWorker(),
          autocompletion({
            override: [tsAutocompleteWorker()],
          }),
          tsHoverWorker(),
        ],
      );
    }

    // Show the minimap
    // See https://github.com/replit/codemirror-minimap#usage
    // This extension has poor performance, so it's disabled for now.
    // extensions.push(
    //   showMinimap.compute(['doc'], () => ({
    //     create: () => ({
    //       dom: document.createElement('div'),
    //     }),
    //     // Without this, performance is terrible.
    //     displayText: 'blocks',
    //   })),
    // );

    // VSCode keybindings
    // See https://github.com/replit/codemirror-vscode-keymap#usage
    // extensions.push(keymap.of(vscodeKeymap));
    extensions.push(
      keymap.of(
        vscodeKeymap.map((binding) => {
          // Here we override the Shift+Enter behavior specifically,
          // as that can be used to trigger a manual save/Prettier,
          // and the default behavior from the keymap interferes.
          if (binding.key === 'Enter') {
            delete binding.shift;
          }
          return binding;
        }),
      ),
    );

    // Adds copilot completions
    DEBUG &&
      console.log(
        '[getOrCreateEditor] aiCopilotEndpoint: ',
        aiCopilotEndpoint,
      );
    if (aiCopilotEndpoint) {
      extensions.push(copilot({ aiCopilotEndpoint }));
    }

    // const { setIsAIChatOpen } = useContext(VZCodeContext);

    // Widget appears after instances of "todo" in code editor, allowing AI to implement todo tasks when clicked
    function createToDoPlugin() {
      // setIsAIChatOpen: (open: boolean) => void,
      class ToDoWidget extends WidgetType {
        constructor() {
          super();
        }

        eq(_other: ToDoWidget) {
          return false;
        }

        toDOM() {
          const wrap = document.createElement('i');
          wrap.style.display = 'inline-flex'; // prevent block expansion
          wrap.style.alignItems = 'center';
          wrap.style.justifyContent = 'center';
          wrap.className = 'icon-button icon-button-dark';
          wrap.style.cursor = 'pointer';

          // Handle click directly on the wrapper element
          wrap.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            setAIChatMessage('Implement the TODO');
            setIsAIChatOpen(true);
          });

          const reactContainer =
            document.createElement('div');
          wrap.appendChild(reactContainer);

          const root = createRoot(reactContainer);
          root.render(
            <SparklesSVG width={14} height={14} />,
          );

          return wrap;
        }

        ignoreEvent() {
          return false;
        }
      }

      function toDoWidgets(editor: EditorView) {
        const { state } = editor;
        const tree = syntaxTree(state);
        const findToDo = new RegExpCursor(
          state.doc,
          'todo',
          {
            ignoreCase: true,
          },
        );
        const widgets: Range<Decoration>[] = [];

        while (!findToDo.next().done) {
          const { from, to } = findToDo.value;
          const node = tree.resolve(from);
          let inComment = false;

          // Walk up the parents until we hit the root, looking for a comment node
          for (let cur: any = node; cur; cur = cur.parent) {
            if (
              cur.type.is('Comment') || // grammars that group comments
              cur.type.is('comment') || // generic lowercase group
              /Comment$/.test(cur.type.name) // fallback for e.g. LineComment
            ) {
              inComment = true;
              break;
            }
          }
          if (!inComment) continue; // skip non-comment TODOs

          const deco = Decoration.widget({
            widget: new ToDoWidget(),
            side: 1,
          }).range(to);
          widgets.push(deco);
        }
        return Decoration.set(widgets);
      }

      const todoPlugin = ViewPlugin.fromClass(
        class {
          decorations: DecorationSet;

          constructor(view: EditorView) {
            this.decorations = toDoWidgets(view);
          }

          update(update: ViewUpdate) {
            if (
              update.docChanged ||
              update.viewportChanged ||
              syntaxTree(update.startState) !==
                syntaxTree(update.state)
            )
              this.decorations = toDoWidgets(update.view);
          }
        },
        {
          decorations: (v) => v.decorations,
        },
      );

      return todoPlugin;
    }

    if (enableToDoPlugin && enableBuiltInAIChat) {
      extensions.push(createToDoPlugin());
    }
  }

  const editor = new EditorView({
    state: EditorState.create({
      doc: text,
      extensions,
    }),
  });

  const editorCacheValue: ExtendedEditorCacheValue = {
    editor,
    themeCompartment,
    languageCompartment,
    rainbowBracketsCompartment,
    updateRainbowBrackets: (enabled) => {
      editor.dispatch({
        effects: rainbowBracketsCompartment.reconfigure(
          enabled ? rainbowBrackets() : [],
        ),
      });
    },
  };

  // Populate the cache.
  editorCache.set(cacheKey, editorCacheValue);

  // Initialize rainbow brackets based on the toggle state
  editorCacheValue.updateRainbowBrackets(
    rainbowBracketsEnabled,
  );

  return editorCacheValue;
};
