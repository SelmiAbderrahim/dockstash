import type { ReactNode } from 'react';

interface ModalProps {
  handleClose: () => void;
  heading: string;
  isOpen: boolean;
  children?: ReactNode;
}

export const Modal = ({ handleClose, heading, isOpen, children }: ModalProps) => (
  <div className={`modal ${isOpen ? 'is-open' : ''}`}>
    <div className="modal-container">
      <div className="modal-content">
        <button type="button" onClick={handleClose} className="close" aria-label="Close">
          ×
        </button>
        <h3>{heading}</h3>
        {children}
      </div>
    </div>
  </div>
);
