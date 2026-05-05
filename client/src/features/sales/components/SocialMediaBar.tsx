import type { SocialNetwork } from '../types';

interface SocialMediaBarProps {
  socialNetworks: SocialNetwork[];
}

export const SocialMediaBar = ({ socialNetworks }: SocialMediaBarProps) => (
  <div className="social-bar">
    <ul>
      {socialNetworks.map((network, index) => (
        <li key={`${network.name}-${index}`} className="social-icon">
          <a title={network.name} href={network.href}>
            <img alt={network.name} src={network.img} />
          </a>
        </li>
      ))}
    </ul>
  </div>
);
