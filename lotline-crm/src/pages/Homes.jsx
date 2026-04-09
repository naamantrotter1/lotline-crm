export default function Homes() {
  return (
    <div className="-m-6 flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>
      <iframe
        src="/homes/index.html"
        className="w-full flex-1 border-0"
        title="LotLine Homes Dealership"
        allow="fullscreen"
      />
    </div>
  );
}
