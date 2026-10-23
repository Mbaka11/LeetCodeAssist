import { COMPANY_LOGOS } from '../data/companyLogos';

/** Brand mark when one is bundled, otherwise a neutral monogram. Decorative: the company name is always rendered next to it. */
export function CompanyLogo({ companyId, name, size = 18 }: { companyId: string; name: string; size?: number }) {
  const logo = COMPANY_LOGOS[companyId];
  return logo ? (
    <svg className="company-logo" width={size} height={size} viewBox="0 0 24 24" role="presentation" aria-hidden="true" focusable="false">
      <path d={logo.path} fill={logo.color} />
    </svg>
  ) : (
    <span className="company-logo company-monogram" style={{ width: size, height: size, fontSize: size * 0.6 }} aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
