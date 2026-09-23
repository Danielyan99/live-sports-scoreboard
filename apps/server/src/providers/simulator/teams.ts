import type { LeagueCode, Team } from '@scoreboard/shared';

/**
 * Uses football-data.org ids so demo teams share ids and crests with the real feed.
 * The demo still creates its own matches and made-up players.
 */
const team = (fdId: number, shortName: string, name: string, tla: string, crest: string): Team => ({
  id: `fd-${fdId}`,
  name,
  shortName,
  tla,
  crest,
});

/** 2026/27 clubs, from football-data.org /v4/competitions/{PL,PD}/teams. Used only by the demo feed. */
export const TEAMS: Record<LeagueCode, Team[]> = {
  PL: [
    team(1044, 'Bournemouth', 'AFC Bournemouth', 'BOU', 'https://crests.football-data.org/bournemouth.png'),
    team(57, 'Arsenal', 'Arsenal FC', 'ARS', 'https://crests.football-data.org/57.png'),
    team(58, 'Aston Villa', 'Aston Villa FC', 'AVL', 'https://crests.football-data.org/58.png'),
    team(402, 'Brentford', 'Brentford FC', 'BRE', 'https://crests.football-data.org/402.png'),
    team(397, 'Brighton', 'Brighton & Hove Albion FC', 'BHA', 'https://crests.football-data.org/397.png'),
    team(61, 'Chelsea', 'Chelsea FC', 'CHE', 'https://crests.football-data.org/61.png'),
    team(1076, 'Coventry City', 'Coventry City FC', 'COV', 'https://crests.football-data.org/1076.png'),
    team(354, 'Crystal Palace', 'Crystal Palace FC', 'CRY', 'https://crests.football-data.org/354.png'),
    team(62, 'Everton', 'Everton FC', 'EVE', 'https://crests.football-data.org/62.png'),
    team(63, 'Fulham', 'Fulham FC', 'FUL', 'https://crests.football-data.org/63.png'),
    team(322, 'Hull City', 'Hull City AFC', 'HUL', 'https://crests.football-data.org/322.png'),
    team(349, 'Ipswich Town', 'Ipswich Town FC', 'IPS', 'https://crests.football-data.org/349.png'),
    team(341, 'Leeds United', 'Leeds United FC', 'LEE', 'https://crests.football-data.org/341.png'),
    team(64, 'Liverpool', 'Liverpool FC', 'LIV', 'https://crests.football-data.org/64.png'),
    team(65, 'Man City', 'Manchester City FC', 'MCI', 'https://crests.football-data.org/65.png'),
    team(66, 'Man United', 'Manchester United FC', 'MUN', 'https://crests.football-data.org/66.png'),
    team(67, 'Newcastle', 'Newcastle United FC', 'NEW', 'https://crests.football-data.org/67.png'),
    team(351, "Nott'm Forest", 'Nottingham Forest FC', 'NOT', 'https://crests.football-data.org/351.png'),
    team(71, 'Sunderland', 'Sunderland AFC', 'SUN', 'https://crests.football-data.org/71.png'),
    team(73, 'Tottenham', 'Tottenham Hotspur FC', 'TOT', 'https://crests.football-data.org/73.png'),
  ],
  PD: [
    team(77, 'Athletic', 'Athletic Club', 'ATH', 'https://crests.football-data.org/77.png'),
    team(79, 'Osasuna', 'CA Osasuna', 'OSA', 'https://crests.football-data.org/79.png'),
    team(78, 'Atleti', 'Club Atlético de Madrid', 'ATL', 'https://crests.football-data.org/78.png'),
    team(263, 'Alavés', 'Deportivo Alavés', 'ALA', 'https://crests.football-data.org/263.png'),
    team(285, 'Elche', 'Elche CF', 'ELC', 'https://crests.football-data.org/285.png'),
    team(81, 'Barça', 'FC Barcelona', 'FCB', 'https://crests.football-data.org/81.png'),
    team(82, 'Getafe', 'Getafe CF', 'GET', 'https://crests.football-data.org/82.png'),
    team(88, 'Levante', 'Levante UD', 'LEV', 'https://crests.football-data.org/88.png'),
    team(84, 'Málaga', 'Málaga CF', 'MAL', 'https://crests.football-data.org/84.png'),
    team(87, 'Rayo', 'Rayo Vallecano de Madrid', 'RAY', 'https://crests.football-data.org/87.png'),
    team(558, 'Celta', 'RC Celta de Vigo', 'CEL', 'https://crests.football-data.org/558.png'),
    team(560, 'Deportivo', 'RC Deportivo La Coruña', 'DEP', 'https://crests.football-data.org/560.png'),
    team(80, 'Espanyol', 'RCD Espanyol de Barcelona', 'ESP', 'https://crests.football-data.org/80.png'),
    team(90, 'Betis', 'Real Betis Balompié', 'BET', 'https://crests.football-data.org/90.png'),
    team(86, 'Real Madrid', 'Real Madrid CF', 'RMA', 'https://crests.football-data.org/86.png'),
    team(5335, 'Racing', 'Real Racing Club de Santander', 'SAN', 'https://crests.football-data.org/5335.png'),
    team(92, 'Real Sociedad', 'Real Sociedad de Fútbol', 'RSO', 'https://crests.football-data.org/92.png'),
    team(559, 'Sevilla', 'Sevilla FC', 'SEV', 'https://crests.football-data.org/559.png'),
    team(95, 'Valencia', 'Valencia CF', 'VAL', 'https://crests.football-data.org/95.png'),
    team(94, 'Villarreal', 'Villarreal CF', 'VIL', 'https://crests.football-data.org/94.png'),
  ],
};

/**
 * Fictional surnames for simulated scorers and bookings. The demo feed uses
 * made-up players on purpose so it can't be mistaken for real match data.
 */
export const PLAYER_NAMES: Record<LeagueCode, string[]> = {
  PL: [
    'Ashworth',
    'Bramley',
    'Calloway',
    'Dunmore',
    'Ellison',
    'Fenwick',
    'Garside',
    'Holloway',
    'Ingram',
    'Jarvis',
    'Kettering',
    'Langley',
    'Marsden',
    'Norcott',
    'Pembury',
    'Radcliffe',
    'Stanton',
    'Thornbury',
    'Whitlock',
    'Yardley',
  ],
  PD: [
    'Aranda',
    'Belmonte',
    'Cabrera',
    'Domínguez',
    'Escudero',
    'Figueroa',
    'Galindo',
    'Herrera',
    'Iturbe',
    'Jiménez',
    'Llorente',
    'Montoya',
    'Navarro',
    'Olmedo',
    'Peralta',
    'Quintana',
    'Robledo',
    'Salcedo',
    'Tejada',
    'Urrutia',
  ],
};
