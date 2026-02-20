const TEAM_MAP: Record<string, { bg: string; fg: string; short: string; flag: string }> = {
  // Premier League clubs (no flags)
  liverpool:          { bg: '#C8102E', fg: '#fff', short: 'LFC', flag: '🏴󠁧󠁢󠁥󠁮󠁧󁿢' },
  arsenal:            { bg: '#EF0107', fg: '#fff', short: 'ARS', flag: '🏴󠁧󠁢󠁥󠁮󠁧󁿢' },
  'manchester city':  { bg: '#6CABDD', fg: '#1C2C5B', short: 'MCI', flag: '🏴󠁧󠁢󠁥󠁮󠁧󁿢' },
  'man city':         { bg: '#6CABDD', fg: '#1C2C5B', short: 'MCI', flag: '🏴󠁧󠁢󠁥󠁮󠁧󁿢' },
  chelsea:            { bg: '#034694', fg: '#fff', short: 'CHE', flag: '🏴󠁧󠁢󠁥󠁮󠁧󁿢' },
  'manchester united':{ bg: '#DA291C', fg: '#FBE122', short: 'MUN', flag: '🏴󠁧󠁢󠁥󠁮󠁧󁿢' },
  'man united':       { bg: '#DA291C', fg: '#FBE122', short: 'MUN', flag: '🏴󠁧󠁢󠁥󠁮󠁧󁿢' },
  tottenham:          { bg: '#132257', fg: '#fff', short: 'TOT', flag: '🏴󠁧󠁢󠁥󠁮󠁧󁿢' },
  spurs:              { bg: '#132257', fg: '#fff', short: 'TOT', flag: '🏴󠁧󠁢󠁥󠁮󠁧󁿢' },
  wolves:             { bg: '#FDB913', fg: '#231F20', short: 'WOL', flag: '🏴󠁧󠁢󠁥󠁮󠁧󁿢' },
  newcastle:          { bg: '#241F20', fg: '#fff', short: 'NEW', flag: '🏴󠁧󠁢󠁥󠁮󠁧󁿢' },
  everton:            { bg: '#003399', fg: '#fff', short: 'EVE', flag: '🏴󠁧󠁢󠁥󠁮󠁧󁿢' },
  'aston villa':      { bg: '#7B003C', fg: '#95BFE5', short: 'AVL', flag: '🏴󠁧󠁢󠁥󠁮󠁧󁿢' },
  'west ham':         { bg: '#7A263A', fg: '#1BB1E7', short: 'WHU', flag: '🏴󠁧󠁢󠁥󠁮󠁧󁿢' },
  brighton:           { bg: '#0057B8', fg: '#FFCD00', short: 'BHA', flag: '🏴󠁧󠁢󠁥󠁮󠁧󁿢' },
  brentford:          { bg: '#E30613', fg: '#fff', short: 'BRE', flag: '🏴󠁧󠁢󠁥󠁮󠁧󁿢' },
  fulham:             { bg: '#CC0000', fg: '#fff', short: 'FUL', flag: '🏴󠁧󠁢󠁥󠁮󠁧󁿢' },
  'nottingham forest':{ bg: '#DD0000', fg: '#fff', short: 'NFO', flag: '🏴󠁧󠁢󠁥󠁮󠁧󁿢' },
  'nottm forest':     { bg: '#DD0000', fg: '#fff', short: 'NFO', flag: '🏴󠁧󠁢󠁥󠁮󠁧󁿢' },
  'crystal palace':   { bg: '#1B458F', fg: '#A7A5A6', short: 'CRY', flag: '🏴󠁧󠁢󠁥󠁮󠁧󁿢' },
  leicester:          { bg: '#003090', fg: '#FDBE11', short: 'LEI', flag: '🏴󠁧󠁢󠁥󠁮󠁧󁿢' },
  southampton:        { bg: '#D71920', fg: '#fff', short: 'SOU', flag: '🏴󠁧󠁢󠁥󠁮󠁧󁿢' },
  ipswich:            { bg: '#0044A9', fg: '#fff', short: 'IPS', flag: '🏴󠁧󠁢󠁥󠁮󠁧󁿢' },
  sunderland:         { bg: '#EB172B', fg: '#fff', short: 'SUN', flag: '🏴󠁧󠁢󠁥󠁮󠁧󁿢' },
  // World Cup nations
  england:        { bg: '#003090', fg: '#fff', short: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󁿢' },
  germany:        { bg: '#000000', fg: '#FFCE00', short: 'GER', flag: '🇩🇪' },
  france:         { bg: '#002395', fg: '#fff', short: 'FRA', flag: '🇫🇷' },
  brazil:         { bg: '#009C3B', fg: '#FFDF00', short: 'BRA', flag: '🇧🇷' },
  argentina:      { bg: '#74ACDF', fg: '#fff', short: 'ARG', flag: '🇦🇷' },
  spain:          { bg: '#AA151B', fg: '#F1BF00', short: 'ESP', flag: '🇪🇸' },
  portugal:       { bg: '#006600', fg: '#FF0000', short: 'POR', flag: '🇵🇹' },
  italy:          { bg: '#009246', fg: '#fff', short: 'ITA', flag: '🇮🇹' },
  netherlands:    { bg: '#FF6600', fg: '#fff', short: 'NED', flag: '🇳🇱' },
  morocco:        { bg: '#C1272D', fg: '#006233', short: 'MAR', flag: '🇲🇦' },
  poland:         { bg: '#DC143C', fg: '#fff', short: 'POL', flag: '🇵🇱' },
  'saudi arabia': { bg: '#006C35', fg: '#fff', short: 'KSA', flag: '🇸🇦' },
  croatia:        { bg: '#FF0000', fg: '#fff', short: 'CRO', flag: '🇭🇷' },
  japan:          { bg: '#BC002D', fg: '#fff', short: 'JPN', flag: '🇯🇵' },
  senegal:        { bg: '#00853F', fg: '#FDEF42', short: 'SEN', flag: '🇸🇳' },
  mexico:         { bg: '#006847', fg: '#fff', short: 'MEX', flag: '🇲🇽' },
  cameroon:       { bg: '#007A5E', fg: '#CE1126', short: 'CMR', flag: '🇨🇲' },
  australia:      { bg: '#00843D', fg: '#FFD700', short: 'AUS', flag: '🇦🇺' },
  peru:           { bg: '#D91023', fg: '#fff', short: 'PER', flag: '🇵🇪' },
  usa:            { bg: '#002868', fg: '#BF0A30', short: 'USA', flag: '🇺🇸' },
  colombia:       { bg: '#FCD116', fg: '#003087', short: 'COL', flag: '🇨🇴' },
  'czech republic':{ bg: '#D7141A', fg: '#fff', short: 'CZE', flag: '🇨🇿' },
  ecuador:        { bg: '#FFD100', fg: '#034EA2', short: 'ECU', flag: '🇪🇨' },
  uruguay:        { bg: '#5EB6E4', fg: '#fff', short: 'URU', flag: '🇺🇾' },
  canada:         { bg: '#FF0000', fg: '#fff', short: 'CAN', flag: '🇨🇦' },
  belgium:        { bg: '#000000', fg: '#FDDA24', short: 'BEL', flag: '🇧🇪' },
  'ivory coast':  { bg: '#F77F00', fg: '#009A44', short: 'CIV', flag: '🇨🇮' },
  'south korea':  { bg: '#CD2E3A', fg: '#003478', short: 'KOR', flag: '🇰🇷' },
  ghana:          { bg: '#006B3F', fg: '#FCD116', short: 'GHA', flag: '🇬🇭' },
  switzerland:    { bg: '#FF0000', fg: '#fff', short: 'SUI', flag: '🇨🇭' },
  nigeria:        { bg: '#008751', fg: '#fff', short: 'NGA', flag: '🇳🇬' },
  serbia:         { bg: '#C6363C', fg: '#0C4076', short: 'SRB', flag: '🇷🇸' },
  denmark:        { bg: '#C60C30', fg: '#fff', short: 'DEN', flag: '🇩🇰' },
  iran:           { bg: '#239F40', fg: '#fff', short: 'IRN', flag: '🇮🇷' },
  austria:        { bg: '#ED2939', fg: '#fff', short: 'AUT', flag: '🇦🇹' },
  egypt:          { bg: '#CE1126', fg: '#fff', short: 'EGY', flag: '🇪🇬' },
  turkey:         { bg: '#E30A17', fg: '#fff', short: 'TUR', flag: '🇹🇷' },
  'new zealand':  { bg: '#00247D', fg: '#CC142B', short: 'NZL', flag: '🇳🇿' },
  bolivia:        { bg: '#D52B1E', fg: '#F4E400', short: 'BOL', flag: '🇧🇴' },
  qatar:          { bg: '#8D1B3D', fg: '#fff', short: 'QAT', flag: '🇶🇦' },
  wales:          { bg: '#C8102E', fg: '#fff', short: 'WAL', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' },
  algeria:        { bg: '#006233', fg: '#fff', short: 'ALG', flag: '🇩🇿' },
  // Club Europe
  'real madrid':  { bg: '#FEBE10', fg: '#002B7F', short: 'RMA', flag: '🇪🇸' },
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
    flag: '🏳️',
  };
}

export function resolveTeamColors(name: string) {
  return resolveTeam(name);
}

export function getTeamFlag(name: string): string {
  return resolveTeam(name).flag;
}

export function TeamBadge({ name, size = 44 }: { name: string; size?: number }) {
  const team = resolveTeam(name);
  const r = size / 2;
  // For larger badges show flag emoji instead of short code
  if (size >= 40) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: team.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: size * 0.48,
          lineHeight: 1,
          border: `2px solid ${team.fg}33`,
        }}
        title={name}
      >
        {team.flag}
      </div>
    );
  }
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
