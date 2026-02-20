const TEAM_MAP: Record<string, { bg: string; fg: string; short: string }> = {
  liverpool: { bg: '#C8102E', fg: '#fff', short: 'LFC' },
  arsenal: { bg: '#EF0107', fg: '#fff', short: 'ARS' },
  'manchester city': { bg: '#6CABDD', fg: '#1C2C5B', short: 'MCI' },
  'man city': { bg: '#6CABDD', fg: '#1C2C5B', short: 'MCI' },
  chelsea: { bg: '#034694', fg: '#fff', short: 'CHE' },
  'manchester united': { bg: '#DA291C', fg: '#FBE122', short: 'MUN' },
  'man united': { bg: '#DA291C', fg: '#FBE122', short: 'MUN' },
  tottenham: { bg: '#132257', fg: '#fff', short: 'TOT' },
  spurs: { bg: '#132257', fg: '#fff', short: 'TOT' },
  wolves: { bg: '#FDB913', fg: '#231F20', short: 'WOL' },
  newcastle: { bg: '#241F20', fg: '#fff', short: 'NEW' },
  everton: { bg: '#003399', fg: '#fff', short: 'EVE' },
  'aston villa': { bg: '#7B003C', fg: '#95BFE5', short: 'AVL' },
  'west ham': { bg: '#7A263A', fg: '#1BB1E7', short: 'WHU' },
  brighton: { bg: '#0057B8', fg: '#FFCD00', short: 'BHA' },
  brentford: { bg: '#E30613', fg: '#fff', short: 'BRE' },
  fulham: { bg: '#CC0000', fg: '#fff', short: 'FUL' },
  'nottingham forest': { bg: '#DD0000', fg: '#fff', short: 'NFO' },
  'nottm forest': { bg: '#DD0000', fg: '#fff', short: 'NFO' },
  'crystal palace': { bg: '#1B458F', fg: '#A7A5A6', short: 'CRY' },
  leicester: { bg: '#003090', fg: '#FDBE11', short: 'LEI' },
  southampton: { bg: '#D71920', fg: '#fff', short: 'SOU' },
  ipswich: { bg: '#0044A9', fg: '#fff', short: 'IPS' },
  sunderland: { bg: '#EB172B', fg: '#fff', short: 'SUN' },
  england: { bg: '#003090', fg: '#fff', short: 'ENG' },
  germany: { bg: '#000000', fg: '#FFCE00', short: 'GER' },
  france: { bg: '#002395', fg: '#fff', short: 'FRA' },
  brazil: { bg: '#009C3B', fg: '#FFDF00', short: 'BRA' },
  argentina: { bg: '#74ACDF', fg: '#fff', short: 'ARG' },
  spain: { bg: '#AA151B', fg: '#F1BF00', short: 'ESP' },
  portugal: { bg: '#006600', fg: '#FF0000', short: 'POR' },
  italy: { bg: '#009246', fg: '#fff', short: 'ITA' },
  netherlands: { bg: '#FF6600', fg: '#fff', short: 'NED' },
  'real madrid': { bg: '#FEBE10', fg: '#002B7F', short: 'RMA' },
};

function resolveTeam(name: string) {
  const lower = name.toLowerCase().trim();
  for (const [key, val] of Object.entries(TEAM_MAP)) {
    if (lower.includes(key)) return val;
  }
  return {
    bg: '#334155',
    fg: '#fff',
    short: name.replace(/[^A-Z]/g, '').slice(0, 3) || name.slice(0, 3).toUpperCase(),
  };
}

export function TeamBadge({ name, size = 44 }: { name: string; size?: number }) {
  const team = resolveTeam(name);
  const r = size / 2;
  const fontSize = size < 36 ? 7 : 9;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={r} cy={r} r={r} fill={team.bg} />
      <text
        x={r}
        y={r + fontSize * 0.38}
        textAnchor="middle"
        fill={team.fg}
        fontSize={fontSize}
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
        letterSpacing="0.5"
      >
        {team.short}
      </text>
    </svg>
  );
}

/** Parse "Home vs Away" → [home, away] */
export function parseTeams(eventName: string): [string, string] {
  const parts = eventName.split(/\s+vs\.?\s+/i);
  if (parts.length >= 2) return [parts[0].trim(), parts.slice(1).join(' vs ').trim()];
  return [eventName, ''];
}
