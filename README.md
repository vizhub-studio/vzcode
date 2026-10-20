# VZCode: Mob Programming Code Editor

VZCode offers a multiplayer code editing environment that caters to a real-time collaborative development experience. It's the code editor component of [VizHub](https://vizhub.com/), and can also be used independently from VizHub.

![VZCode Interface](https://github.com/vizhub-core/vzcode/assets/68416/4eb1c037-6748-47be-a85f-db29b11c2223)

## Table of Contents

- [Usage](#usage)
- [Development](#development)
- [Features](#features)
- [Use Cases](#use-cases)
- [Visual Editor](#visual-editor)
- [Stack](#stack)
- [Goals](#goals)
- [Prior Work](#prior-work)
- [Milestones](#milestones)
- [Team](#team)
- [Spaces](#spaces)

## Usage

You can use VZCode as an editor for your current directory if you install it globally with:

```
npm install -g vzcode
```

To open it, navigate to the directory of your choice in the terminal, then run

```
vzcode
```

A new browser window should automatically pop open with the files in that directory exposed for interactive multiplayer editing.

**Note:** A known shortcoming of VZCode is that it does not (yet) watch for changes from the file system. VZCode assumes that no other programs are modifying the same files. If another program does modify the same files at the same time, each VZCode auto-save will clobber the changes made by the other program.

To invite others to edit with you in real time, share your IP in your LAN with them to access. You can also expose your VZCode instance publicly using a tunneling service such as [NGrok](https://ngrok.com/). In fact, if you set your `NGROK_TOKEN` environment variable, VZCode will automatically connect and log the public URL when it starts.

## Development

- **Backlog & Issues**: Use our [Kanban Board](https://github.com/orgs/vizhub-core/projects/2/views/1) to track the backlog, [good first issues](https://github.com/orgs/vizhub-core/projects/2/views/1?filterQuery=label%3A%22good+first+issue%22), and [known bugs](https://github.com/orgs/vizhub-core/projects/2/views/1?filterQuery=label%3Abug).

- **Local Setup**:

```bash
cd vzcode
npm install
npm run test-interactive
```

If you're on Windows, you'll also need to do this additional step:

```
npm install @rollup/rollup-win32-x64-msvc
```

For local development with hot reloading (for client-side changes only), _keep the server running, started by_ `npm run test-interactive`, and also in a separate terminal run this:

```bash
npm run dev
```

This will expose http://localhost:5173/ and proxy the requests for data to the server (running on port 3030).

You can also use [npm link](https://docs.npmjs.com/cli/v8/commands/npm-link) to set up the `vzcode` NPM package in another project to point to your clone of the repository. This can be useful when testing out how `vzcode` functions as a dependency.

## Features

- Browser-based editing environment
- Sidebar with file listings (directories support pending)
- Real-time collaboration via LAN or using services like [NGrok](https://ngrok.com/)
- File management through tabs
- Basic file operations: create, rename, delete
- Syntax highlighting for web languages
- Interactive widgets for editing numbers (Alt+drag on numbers)
- Auto-save, debounced after code changes
- Auto-save, throttled while using interactive widgets to support hot reloading environments

## Use Cases

- **Local Editor**:
  Use VZCode like VSCode or Vim:

  ```bash
  npm install -g vzcode
  cd myProject
  vzcode
  ```

- **Project-specific Editor**:
  Embed VZCode within your project for developers who might not have a preferred IDE, or to provide an editing experience that seamlessly integrates with hot reloading.

  ```json
  {
    "name": "example-project",
    "scripts": {
      "edit": "vzcode"
    },
    "dependencies": {
      "vzcode": "^0.1.0"
    }
  }
  ```

  Run using `npm run edit`.

  For example, as the editor of [Vite D3 Template](https://github.com/curran/vite-d3-template), which showcases the throttled auto-save behavior of VZCode while using the interactive widgets in the context of editing files served by the Vite dev server which supports hot reloading.

- **Hosting with Ngrok**: Allow external collaborators to join your VZCode session.
  - **With Ngrok Globally Installed**: (Requires authenticated Ngrok account)

    ```bash
    vzcode
    ngrok http 3030
    ```

  - **Through VZCode**: Coming soon!

- **Staging Site Editor (Experimental)**:
  Use VZCode on a persistent server, making code changes with multiplayer mode remotely, reflecting instantly on a staging site.

## Embedding the Visual Editor in a host application

Embedded clients can pass `initialSidebarView="visual"` to `VZCodeProvider` to open the Visual panel (standalone VZCode keeps its existing AI chat default). Pass `renderVisualEditorEmptyState={(reason) => ...}` to replace built-in empty states with your own UI. The callback receives `missing-config`, `invalid-config`, `missing-widgets`, `invalid-widgets`, or `empty-widgets`; return `null` to use the default message. A nonempty, valid `visualEditorWidgets` array activates the normal widgets.

When embedding VZCode beside a host-owned visualization iframe, pass the mutable `iframeRef` to `VZCodeProvider`. VZCode sends top-level config patches via `postMessage` after `config.json` changes; the host must make sure the iframe implements the message listener and that iframe recreations receive the current config. Host applications own any AI setup action: VZCode never triggers paid generation itself.

## Visual Editor

VZCode includes a visual editor feature that allows you to create interactive widgets (like sliders and color pickers) for tweaking configuration parameters in real-time. This is particularly useful for data visualizations where you want to adjust visual properties dynamically without editing code.

### Overview

The visual editor works by:

1. Loading a `config.json` file that defines configuration parameters
2. Defining interactive widgets in the `visualEditorWidgets` array
3. Listening for configuration updates via `postMessage`
4. Re-rendering the visualization when configuration changes

### Configuration Structure

Your project should include a `config.json` file with the following structure:

```json
{
  "xValue": "sepal_length",
  "yValue": "sepal_width",
  "margin": {
    "top": 20,
    "right": 67,
    "bottom": 60,
    "left": 60
  },
  "fontSize": "14px",
  "fontFamily": "sans-serif",
  "pointRadius": 17.2675034867503,
  "pointFill": "black",
  "pointOpacity": 0.7,
  "loadingFontSize": "24px",
  "loadingFontFamily": "sans-serif",
  "loadingMessage": "Loading...",
  "dataUrl": "iris.csv",
  "colorScale": {
    "setosa": "#1f77b4",
    "versicolor": "#ff7f0e",
    "virginica": "#2ca02c"
  },
  "visualEditorWidgets": [
    {
      "type": "slider",
      "label": "Point Radius",
      "property": "pointRadius",
      "min": 1,
      "max": 30
    },
    {
      "type": "slider",
      "label": "Left Margin",
      "property": "margin.left",
      "min": 0,
      "max": 200
    }
  ]
}
```

### Widget Configuration

The `visualEditorWidgets` array defines the interactive controls that will be available in the visual editor. Each widget has the following properties:

- **type**: The type of widget. Supported types are:
  - `"slider"` - A slider control for numeric values
  - `"checkbox"` - A checkbox for boolean values
  - `"textInput"` - A text input field for string values
  - `"dropdown"` - A dropdown selector with predefined options
  - `"color"` - A color picker with HCL (Hue, Chroma, Lightness) sliders
- **label**: Human-readable label displayed in the UI
- **property**: The configuration property to modify (supports nested properties using dot notation like `"margin.left"`)
- **min**: Minimum value (required for `slider` widgets)
- **max**: Maximum value (required for `slider` widgets)
- **step**: Step increment for `slider` widgets (optional, defaults to 1 if not specified)
- **options**: Array of string options (required for `dropdown` widgets)

Every widget's `property` must resolve to an **existing** value in `config.json` (dot-separated paths such as `margin.left` are supported, but arrays and prototype keys are not editable). Match the value to the widget: finite number for `slider`, boolean for `checkbox`, string for `textInput`, one of `options` for `dropdown`, and a valid, opaque CSS color for `color`. Invalid widget values or paths show the host-configurable `invalid-widgets` empty state rather than rendering broken controls.

### Setting Up Your Visualization

To make your visualization work with the visual editor, you need to:

#### 1. Load the Configuration

Use d3-rosetta's state management to load the configuration file:

```javascript
import { createStateField } from 'd3-rosetta';
import { json } from 'd3';

export const viz = (container, state, setState) => {
  const stateField = createStateField(state, setState);
  const [config, setConfig] = stateField('config');

  // Load config first if not already loaded
  if (!config) {
    json('config.json')
      .then((loadedConfig) => {
        setConfig(loadedConfig);
      })
      .catch((error) => {
        console.error('Failed to load config:', error);
      });
    return;
  }

  // ... rest of your visualization code
};
```

#### 2. Set Up postMessage Event Listener

Add an event listener to receive configuration updates from the visual editor:

```javascript
export const viz = (container, state, setState) => {
  // ... other code ...

  // Set up postMessage event listener if not already set
  if (!state.eventListenerAttached) {
    window.addEventListener('message', (event) => {
      // Verify the message contains config data
      if (event.data && typeof event.data === 'object') {
        // Update the config with the received data
        setState((state) => ({
          ...state,
          config: {
            ...state.config,
            ...event.data,
          },
        }));
      }
    });

    // Mark that we've attached the event listener to avoid duplicates
    setState((prevState) => ({
      ...prevState,
      eventListenerAttached: true,
    }));
  }

  // ... rest of your visualization code
};
```

#### 3. Use Configuration in Your Rendering

Use the configuration values when rendering your visualization:

```javascript
// Example: Rendering data points with configurable properties
export const renderMarks = (
  svg,
  {
    data,
    xScale,
    yScale,
    xValue,
    yValue,
    pointRadius,
    colorScale,
    pointOpacity,
  },
) =>
  svg
    .selectAll('circle.data-point')
    .data(data)
    .join('circle')
    .attr('class', 'data-point')
    .attr('cx', (d) => xScale(xValue(d)))
    .attr('cy', (d) => yScale(yValue(d)))
    .attr('r', pointRadius) // Uses config value
    .attr('fill', (d) => colorScale[d.species])
    .attr('opacity', pointOpacity); // Uses config value
```

#### 4. Handle Loading States

Display loading states while data is being fetched:

```javascript
export const renderLoadingState = (
  svg,
  { x, y, text, shouldShow, fontSize, fontFamily },
) => {
  svg
    .selectAll('text.loading-text')
    .data(shouldShow ? [null] : [])
    .join('text')
    .attr('class', 'loading-text')
    .attr('x', x)
    .attr('y', y)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', fontSize) // Uses config value
    .attr('font-family', fontFamily) // Uses config value
    .text(text);
};
```

#### 5. Manage Asynchronous Data Loading

Handle asynchronous data requests with proper state management:

```javascript
export const asyncRequest = (
  setDataRequest,
  loadAndParseData,
) => {
  setDataRequest({ status: 'Loading' });
  loadAndParseData()
    .then((data) => {
      setDataRequest({ status: 'Succeeded', data });
    })
    .catch((error) => {
      setDataRequest({ status: 'Failed', error });
    });
};
```

### Complete Example

Here's how everything fits together in your main visualization file:

```javascript
import { createStateField } from 'd3-rosetta';
import { setupSVG } from './setupSVG.js';
import { renderLoadingState } from './renderLoadingState.js';
import { asyncRequest } from './asyncRequest.js';
import { loadAndParseData } from './loadAndParseData.js';
import { scatterPlot } from './scatterPlot.js';
import { measureDimensions } from './measureDimensions.js';
import { json } from 'd3';

export const viz = (container, state, setState) => {
  const stateField = createStateField(state, setState);
  const [dataRequest, setDataRequest] =
    stateField('dataRequest');
  const [config, setConfig] = stateField('config');

  // Set up postMessage event listener if not already set
  if (!state.eventListenerAttached) {
    window.addEventListener('message', (event) => {
      if (event.data && typeof event.data === 'object') {
        setState((state) => ({
          ...state,
          config: {
            ...state.config,
            ...event.data,
          },
        }));
      }
    });

    setState((prevState) => ({
      ...prevState,
      eventListenerAttached: true,
    }));
  }

  // Load config first if not already loaded
  if (!config) {
    json('config.json')
      .then((loadedConfig) => {
        setConfig(loadedConfig);
      })
      .catch((error) => {
        console.error('Failed to load config:', error);
      });
    return;
  }

  // After config is loaded, load the data
  if (!dataRequest) {
    return asyncRequest(setDataRequest, () =>
      loadAndParseData(config.dataUrl),
    );
  }

  const { data, error } = dataRequest;
  const dimensions = measureDimensions(container);
  const svg = setupSVG(container, dimensions);

  renderLoadingState(svg, {
    shouldShow: !data,
    text: error
      ? `Error: ${error.message}`
      : config.loadingMessage,
    x: dimensions.width / 2,
    y: dimensions.height / 2,
    fontSize: config.loadingFontSize,
    fontFamily: config.loadingFontFamily,
  });

  if (data) {
    // Transform string properties in config to accessor functions
    const configWithAccessors = {
      ...config,
      xValue: (d) => d[config.xValue],
      yValue: (d) => d[config.yValue],
    };

    scatterPlot(svg, {
      ...configWithAccessors,
      data,
      dimensions,
    });
  }
};
```

### Required HTML Structure

Your `index.html` should include a container element and proper script imports:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Visual Editor Example</title>
    <link rel="stylesheet" href="styles.css" />
    <script type="importmap">
      {
        "imports": {
          "d3": "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm",
          "d3-rosetta": "https://cdn.jsdelivr.net/npm/d3-rosetta@3.0.0/+esm"
        }
      }
    </script>
  </head>
  <body>
    <div id="viz-container"></div>
    <script type="module" src="index.js"></script>
  </body>
</html>
```

### Styling

Use CSS to ensure your visualization container fills the viewport:

```css
#viz-container {
  position: fixed;
  inset: 0;
}
```

### Best Practices

1. **Use d3-rosetta**: The visual editor is designed to work with d3-rosetta's unidirectional data flow pattern
2. **Modular Code**: Separate your rendering logic into small, focused functions
3. **Configuration-Driven**: Make visual properties configurable through `config.json`
4. **Nested Properties**: Use dot notation (e.g., `"margin.left"`) to modify nested configuration values
5. **Hot Reloading**: The visual editor works seamlessly with VZCode's throttled auto-save for hot reloading environments

For a complete working example, see the [visualEditor sample directory](test/sampleDirectories/visualEditor) in this repository.

## Stack

Built using technologies such as:

- [NodeJS](https://nodejs.org/en/)
- [Express](https://expressjs.com/)
- [ShareDB](https://github.com/share/sharedb)
- [JSON1 Operational Transform](https://github.com/ottypes/json1)
- [CodeMirror 6](https://codemirror.net/)
- [React](https://reactjs.org/)
- [Vite](https://vitejs.dev/)

## Goals

The project aims to:

- Offer a feasible alternative to VSCode + Live Share for frontend development
- Facilitate easy project-specific IDE embedding
- Enhance user experience with advanced features
- Support instant feedback through hot reloading
- Keep improving based on feedback
- Serve as a core for [VizHub's](https://vizhub.com/) next-gen editor

## Prior Work

VZCode is inspired by [VizHub v2](https://github.com/vizhub-core/vizhub/). VizHub V2's code editor supports real-time collaboration using older versions of libraries such as CodeMirror 5 and JSON0 OT. For VZCode, the aim is to leverage the latest technologies to deliver a more streamlined experience.

![Prior Work Image](https://user-images.githubusercontent.com/68416/213894278-51c7c9a9-dc11-42bc-ba10-c23109c473cd.png)

## Spaces

- [VizHub Discord](https://discord.com/invite/wbtJ7SCtYr)
- [GitHub Repository](https://github.com/vizhub-core/vzcode)
- [Discord Channel within RCOS](https://discord.com/channels/738593165438746634/1066068656045441044)
