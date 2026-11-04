import PlatformPrototype from '../src/PlatformPrototype';
import { DemoBoundary } from '../src/CloudBoundary';

export const dynamic = 'force-dynamic';
export default function Home() {
  return <DemoBoundary><PlatformPrototype /></DemoBoundary>;
}
