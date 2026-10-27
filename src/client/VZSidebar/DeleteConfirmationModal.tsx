import { Button, Modal } from '../ui';
import { useCallback, useEffect } from 'react';

// Confirmation modal for deleting a file or directory.
// Inspired by https://react-bootstrap.netlify.app/docs/components/modal/#live-demo

export const DeleteConfirmationModal = ({
  show,
  onClose,
  onConfirm,
  isDirectory,
  name,
}) => {
  const handleEnterKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        onConfirm();
      }
    },
    [onConfirm],
  );

  useEffect(() => {
    if (show) {
      window.addEventListener('keydown', handleEnterKey);
    } else {
      window.removeEventListener('keydown', handleEnterKey);
    }

    return () => {
      window.removeEventListener('keydown', handleEnterKey);
    };
  }, [show, handleEnterKey]);

  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton onClick={onClose}>
        <Modal.Title>
          Delete{' '}
          {name === 'all files'
            ? 'All Files'
            : isDirectory
              ? 'Directory'
              : 'File'}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <p>
          {name === 'all files' ? (
            'This will delete all files in the project.'
          ) : (
            <>
              This will delete the{' '}
              {isDirectory ? 'directory' : 'file'}{' '}
              <strong>{name}</strong>.
            </>
          )}
        </p>
      </Modal.Body>

      <Modal.Footer>
        <Button
          variant="secondary"
          type="button"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button variant="primary" onClick={onConfirm}>
          Delete
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
