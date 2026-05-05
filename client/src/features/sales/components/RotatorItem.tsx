import type { RotatorSlide } from '../types';

interface RotatorItemProps {
  selectedSlide: RotatorSlide[];
}

export const RotatorItem = ({ selectedSlide }: RotatorItemProps) => (
  <div className="slide">
    {selectedSlide.map((rotator, index) => (
      <div className="rotator-item" key={`${index}-${rotator.headline}`}>
        {rotator.img ? <img className="rotator-image" src={rotator.img} alt="" /> : null}
        {rotator.headline ? <h3>{rotator.headline}</h3> : null}
        <div className="rotator-text-container">
          <p className="rotator-text">{rotator.text}</p>
          <p className="rotator-author">{rotator.author}</p>
        </div>
      </div>
    ))}
  </div>
);
