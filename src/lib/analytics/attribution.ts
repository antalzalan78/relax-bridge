export interface CampaignAttribution {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
}

/** Campaign labels only: no full URLs, click identifiers or extra query parameters. */
export function normalizeCampaignValue(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, '').slice(0, 100)
    : '';
}

export function normalizeCampaign(input: Partial<CampaignAttribution>): CampaignAttribution {
  return {
    utmSource: normalizeCampaignValue(input.utmSource),
    utmMedium: normalizeCampaignValue(input.utmMedium),
    utmCampaign: normalizeCampaignValue(input.utmCampaign),
    utmContent: normalizeCampaignValue(input.utmContent),
  };
}

export function campaignChannel(source: string, campaign: CampaignAttribution): string {
  const origin = campaign.utmSource || source.replace(/^utm:/, '');
  const paid = ['cpc', 'ppc', 'paid', 'paid_search', 'paid_social', 'paid-social'].includes(campaign.utmMedium);
  if (origin === 'google' && paid) return 'Google Ads';
  if (origin === 'google' && campaign.utmCampaign === 'gbp' && campaign.utmMedium === 'organic') return 'Google Cégprofil';
  if (['facebook', 'instagram', 'meta'].includes(origin) && paid) return 'Meta hirdetés';
  if (origin === 'google') return 'Google · nem elkülöníthető';
  if (origin === 'direct') return 'Közvetlen / ismeretlen';
  if (origin === 'internal') return 'Belső oldalról';
  return origin || 'Ismeretlen';
}
