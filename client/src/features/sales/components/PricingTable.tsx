import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';

interface PricingTableProps {
  planName: string;
  price: string;
  features: string[];
  color?: string;
  fontColor?: string;
}

export const PricingTable = ({
  planName,
  price,
  features,
  color = '#5BC0DE',
  fontColor = '#FFF',
}: PricingTableProps) => {
  const componentStyle: CSSProperties = {
    backgroundColor: color,
    color: fontColor,
  };

  return (
    <div className="pricing-table">
      <div className="col-md-4 col-sm-6 col-xs-12">
        <div className="price_table_container">
          <div className="price_table_heading">{planName}</div>
          <div className="price_table_body">
            <div className="price_table_row cost" style={componentStyle}>
              <strong>{price}</strong>
              <span>/MONTH</span>
            </div>
            {features.map((feature, index) => (
              <div key={`${feature}-${index}`} className="price_table_row">
                {feature}
              </div>
            ))}
          </div>
          <Link
            to={`/checkout/${planName.toLowerCase()}`}
            className="btn btn-lg btn-block"
            style={componentStyle}
          >
            Subscribe!
          </Link>
        </div>
      </div>
    </div>
  );
};
