import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './App';
import { BrowserRouter } from 'react-router-dom';

// Global error handler to catch CodeMirror DOM position errors
// These can occur when CodeMirror instances are created but not yet
// attached to the DOM, or when presence indicators try to render
// on offscreen editor instances.
window.addEventListener('error', (event) => {
  // Check if this is the specific CodeMirror posFromDOM/posAtDOM error
  if (
    event.error instanceof RangeError &&
    event.error.message.includes(
      'Trying to find position for a DOM position outside of the document',
    )
  ) {
    // Log the error for debugging purposes
    console.log(
      'Suppressed CodeMirror DOM position error:',
      event.error,
    );
    // Prevent the error from being logged to console by returning true
    return true;
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
