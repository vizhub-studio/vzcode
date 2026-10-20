// A central place where the LLM streaming UI imports what it needs from
// react-bootstrap. This strange-looking way of importing makes it work
// with Vite's SSR build: otherwise we get
// `Error [ERR_UNSUPPORTED_DIR_IMPORT]: Directory import`.
import Form from 'react-bootstrap/cjs/Form.js';
import Button from 'react-bootstrap/cjs/Button.js';
import ButtonGroup from 'react-bootstrap/cjs/ButtonGroup.js';
import ToggleButton from 'react-bootstrap/cjs/ToggleButton.js';

// Pull in custom CSS from vizhub-ui.
import 'vizhub-ui/dist/vizhub-ui.css';

// Pull in Bootstrap Icons CSS.
import 'bootstrap-icons/font/bootstrap-icons.css';

export { Form, Button, ButtonGroup, ToggleButton };
