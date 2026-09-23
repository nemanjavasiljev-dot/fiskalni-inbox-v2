export default function BrandWordmark({ suffix = '' }: { suffix?: string }) {
  return <span className="brand-wordmark"><span className="brand-fiscal">Fiscal</span><span className="brand-box">Box</span>{suffix ? <span className="brand-suffix">{suffix}</span> : null}</span>;
}
