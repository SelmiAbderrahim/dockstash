import { useState } from 'react';
import { RotatorItem } from './RotatorItem';
import { RotatorNav } from './RotatorNav';
import type { RotatorSlide } from '../types';

interface RotatorProps {
  rotators: RotatorSlide[];
}

export const Rotator = ({ rotators }: RotatorProps) => {
  const [index, setIndex] = useState(0);
  const selectedSlide = rotators.filter((_slide, slideIndex) => slideIndex === index);

  return (
    <div className="rotator-container">
      <RotatorItem selectedSlide={selectedSlide} />
      <RotatorNav length={rotators.length} active={index} setPage={setIndex} />
    </div>
  );
};
