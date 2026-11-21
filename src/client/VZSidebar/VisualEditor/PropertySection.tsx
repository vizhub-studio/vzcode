import { useId, useState, type ReactNode } from 'react';

export const PropertySection = ({
  title,
  children,
  initiallyOpen = true,
}: {
  title: string;
  children: ReactNode;
  initiallyOpen?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const id = useId();

  return (
    <section className="visual-properties-section">
      <button
        type="button"
        className="visual-properties-section-toggle"
        aria-expanded={isOpen}
        aria-controls={id}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>{title}</span>
        <span
          aria-hidden="true"
          className={`visual-properties-chevron ${isOpen ? '' : 'collapsed'}`}
        >
          ▾
        </span>
      </button>
      <div
        id={id}
        className="visual-properties-section-body"
        hidden={!isOpen}
      >
        {isOpen && children}
      </div>
    </section>
  );
};
