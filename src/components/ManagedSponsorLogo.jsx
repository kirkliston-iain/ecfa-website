import { useSiteLogos } from '../contexts/SiteLogos'

export default function ManagedSponsorLogo({ name = 'Appin Sports', alt = '', ...props }) {
  const { sponsorLogo } = useSiteLogos()
  const url = sponsorLogo(name)
  return url ? <img {...props} src={url} alt={alt} /> : null
}
