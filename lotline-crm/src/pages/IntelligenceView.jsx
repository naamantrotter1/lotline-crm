import { Map } from 'lucide-react';

export default function IntelligenceView() {
  return (
    <div className="-m-6 h-full" style={{ height: 'calc(100vh - 56px)' }}>
      <iframe
        src="http://localhost:5173"
        className="w-full h-full border-0"
        title="LotLine Intelligence"
        style={{ height: 'calc(100vh - 56px)' }}
      />
    </div>
  );
}
