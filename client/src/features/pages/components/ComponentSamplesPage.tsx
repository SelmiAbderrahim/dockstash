import { PricingTable, Rotator, SocialMediaBar } from '@features/sales';
import type { RotatorSlide, SocialNetwork } from '@features/sales';

const bronzeFeatures = ['Really cool', 'Pretty cheap', 'Awesome'];
const silverFeatures = ['A couple features', 'Pretty neat'];
const goldFeatures = ['A bit cooler yet'];

const social: SocialNetwork[] = [
  { name: 'Facebook', href: 'http://facebook.com/', img: '' },
  { name: 'Twitter', href: 'http://twitter.com/', img: '' },
];

const rotators: RotatorSlide[] = [
  { img: '', headline: '', text: 'I love React!', author: 'JS' },
  { img: '', headline: '', text: 'MERN stack is pretty cool.', author: 'DM' },
];

export const ComponentSamplesPage = () => (
  <div className="select-plan">
    <div className="row">
      <PricingTable planName="Bronze" color="#CCC" price="$10" features={bronzeFeatures} />
      <PricingTable planName="Silver" price="$15" features={silverFeatures} />
      <PricingTable planName="Gold" price="$20" features={goldFeatures} />
    </div>

    <SocialMediaBar socialNetworks={social} />

    <Rotator rotators={rotators} />
  </div>
);
