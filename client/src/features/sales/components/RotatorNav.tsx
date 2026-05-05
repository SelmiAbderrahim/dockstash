interface RotatorNavProps {
  length: number;
  active: number;
  setPage: (index: number) => void;
}

export const RotatorNav = ({ length, active, setPage }: RotatorNavProps) => {
  const items = [];
  for (let i = 0; i < length; i++) {
    items.push(
      <li
        key={`${i}-nav`}
        className={i === active ? 'slider-nav-bullet active' : 'slider-nav-bullet'}
        onClick={() => setPage(i)}
      />,
    );
  }
  return <ul>{items}</ul>;
};
