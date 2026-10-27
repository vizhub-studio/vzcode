/**
 * VZCode-local React primitives. They use native controls and editor-scoped CSS.
 * Importing them never loads Bootstrap, VizHub UI, or a page-wide reset.
 */
import React, {
  createContext, forwardRef, useContext, useEffect, useId, useRef, useState, useCallback,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import './ui.scss';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline-secondary' | 'outline-primary';
  size?: 'sm' | 'lg';
};
export const Button = ({
  variant = 'secondary', size, type = 'button', className = '', ...props
}: ButtonProps) => (
  <button {...props} type={type}
    className={`vz-ui-button vz-ui-button--${variant} ${size ? `vz-ui-button--${size}` : ''} ${className}`} />
);

const fieldContext = createContext<string | undefined>(undefined);
const Group = ({
  controlId, className = '', children,
}: { controlId?: string; className?: string; children: ReactNode }) => {
  const generatedId = useId();
  return <fieldContext.Provider value={controlId || generatedId}>
    <div className={`vz-ui-field ${className}`}>{children}</div>
  </fieldContext.Provider>;
};
const Label = ({
  children, ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) => {
  const fieldId = useContext(fieldContext);
  return <label {...props} htmlFor={props.htmlFor ?? fieldId}
    className={`vz-ui-label ${props.className || ''}`}>{children}</label>;
};
const Control = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', id, ...props }, ref) => {
    const fieldId = useContext(fieldContext);
    return <input {...props} id={id ?? fieldId} ref={ref} className={`vz-ui-control ${className}`} />;
  },
);
Control.displayName = 'VZControl';
const FieldText = ({
  children, className = '',
}: { children?: ReactNode; className?: string }) =>
  <small className={`vz-ui-help ${className}`}>{children}</small>;
export const Form = Object.assign(
  ({ children }: { children?: ReactNode }) => <>{children}</>,
  { Group, Label, Control, Text: FieldText },
);

const modalContext = createContext<{ close: () => void; titleId: string } | null>(null);
type ModalProps = {
  show: boolean; onHide: () => void; children: ReactNode;
  className?: string; centered?: boolean; animation?: boolean;
  onKeyDown?: React.KeyboardEventHandler<HTMLDialogElement>;
};
const ModalRoot = ({
  show, onHide, children, className = '', onKeyDown,
}: ModalProps) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !show) return;
    if (!dialog.open) dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, [show]);
  if (!show || typeof document === 'undefined') return null;
  return createPortal(
    <modalContext.Provider value={{ close: onHide, titleId }}>
      <dialog ref={ref} className={`vz-ui-modal ${className}`}
        aria-labelledby={titleId} onKeyDown={onKeyDown}
        onCancel={(event) => { event.preventDefault(); onHide(); }}
        onClick={(event) => { if (event.target === event.currentTarget) onHide(); }}>
        <div className="vz-ui-modal-content">{children}</div>
      </dialog>
    </modalContext.Provider>,
    document.body,
  );
};
const ModalHeader = ({
  children, closeButton, onClick,
}: {
  children: ReactNode; closeButton?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}) => {
  const dialog = useContext(modalContext);
  return <div className="vz-ui-modal-header">{children}
    {closeButton && <button type="button" className="vz-ui-close"
      aria-label="Close dialog" onClick={onClick ?? dialog?.close}>×</button>}
  </div>;
};
const ModalTitle = ({ children }: { children: ReactNode }) => {
  const dialog = useContext(modalContext);
  return <h2 className="vz-ui-modal-title" id={dialog?.titleId}>{children}</h2>;
};
const ModalBody = ({ children, className = '' }: { children: ReactNode; className?: string }) =>
  <div className={`vz-ui-modal-body ${className}`}>{children}</div>;
const ModalFooter = ({ children }: { children: ReactNode }) =>
  <div className="vz-ui-modal-footer">{children}</div>;
export const Modal = Object.assign(ModalRoot, {
  Header: ModalHeader, Title: ModalTitle, Body: ModalBody, Footer: ModalFooter,
});

export const Tooltip = ({
  id, children,
}: { id: string; children: ReactNode }) => (
  <span id={id} role="tooltip" className="vz-ui-tooltip">{children}</span>
);
/**
 * Tooltips render in a portal so the sidebar's overflow: hidden/auto does
 * not crop them (as Bootstrap's overlays previously avoided).
 */
export const OverlayTrigger = ({
  children, overlay, placement = 'top',
}: {
  children: ReactNode; overlay: ReactNode;
  placement?: 'top' | 'right' | 'bottom' | 'left';
}) => {
  const anchor = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<React.CSSProperties | null>(null);
  const update = useCallback(() => {
    const rect = anchor.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const offset = 8;
    const next: React.CSSProperties =
      placement === 'right'
        ? { left: rect.right + offset, top: centerY, transform: 'translateY(-50%)' }
        : placement === 'left'
          ? { left: rect.left - offset, top: centerY, transform: 'translate(-100%, -50%)' }
          : placement === 'bottom'
            ? { left: centerX, top: rect.bottom + offset, transform: 'translateX(-50%)' }
            : { left: centerX, top: rect.top - offset, transform: 'translate(-50%, -100%)' };
    setPosition(next);
  }, [placement]);
  useEffect(() => {
    if (!position) return;
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [position, update]);

  return (
    <span ref={anchor} className="vz-ui-tooltip-anchor" tabIndex={0}
      onPointerEnter={update} onPointerLeave={() => setPosition(null)}
      onFocus={update} onBlur={() => setPosition(null)}>
      {children}
      {position && typeof document !== 'undefined' && createPortal(
        <span className="vz-ui-tooltip-floating" style={position}>{overlay}</span>,
        document.body,
      )}
    </span>
  );
};
