/**
 * Prueba offline del flujo: torneo 2 categorías + equipos externos + avance de fase.
 * Ejecutar: node scripts/verify-competition-flow.cjs
 */

function normalizeCategoryKey(v) {
  return String(v || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getCompetitionTeamById(competition, teamId) {
  return (competition.teams || []).find((t) => String(t.id) === String(teamId)) || null;
}

function matchBelongsToCategory(competition, match, categoryKey) {
  if (!categoryKey || categoryKey === 'all') return true;
  const target = normalizeCategoryKey(categoryKey);
  const hint = normalizeCategoryKey(match?.categoryHint || '');
  if (hint && hint === target) return true;
  const home = getCompetitionTeamById(competition, match?.homeTeamId);
  const away = getCompetitionTeamById(competition, match?.awayTeamId);
  return (
    normalizeCategoryKey(home?.category) === target ||
    normalizeCategoryKey(away?.category) === target
  );
}

function getMatchPrimaryCategory(competition, match) {
  const hint = String(match?.categoryHint || '').trim();
  if (hint) return hint;
  const home = getCompetitionTeamById(competition, match?.homeTeamId);
  const away = getCompetitionTeamById(competition, match?.awayTeamId);
  return String(home?.category || away?.category || '').trim();
}

function buildKnockoutRound(teamList, competitionId, roundNumber, stageName) {
  const matches = [];
  for (let i = 0; i < teamList.length; i += 2) {
    const home = teamList[i];
    const away = teamList[i + 1] || null;
    matches.push({
      id: `KO_${competitionId}_${roundNumber}_${i / 2 + 1}`,
      competitionId,
      round: roundNumber,
      stageName,
      homeTeamId: home?.id || null,
      homeTeamName: home?.name || 'Por definir',
      awayTeamId: away?.id || null,
      awayTeamName: away?.name || 'Bye',
      homeScore: null,
      awayScore: null,
      status: away ? 'scheduled' : 'completed',
      winnerTeamId: away ? null : home?.id || null,
      winnerTeamName: away ? null : home?.name || null
    });
  }
  return matches;
}

function knockoutStageName(n) {
  if (n <= 2) return 'Final';
  if (n <= 4) return 'Semifinal';
  if (n <= 8) return 'Cuartos';
  return `Ronda (${n} equipos)`;
}

function tryAdvanceKnockoutRound(competition, options) {
  const opts = options || {};
  if (!competition || competition.type !== 'torneo') {
    return { ok: false, message: 'Solo torneo' };
  }
  const filterCategory = opts.categoryFilter ? String(opts.categoryFilter).trim() : '';
  const roundNum = Number(opts.round);
  const currentRoundMatches = (competition.matches || []).filter((m) => {
    if (Number(m.round) !== roundNum) return false;
    return matchBelongsToCategory(competition, m, filterCategory || 'all');
  });
  if (!currentRoundMatches.length) return { ok: false, message: 'Sin partidos' };
  if (!currentRoundMatches.every((m) => m.status === 'completed')) {
    return { ok: false, message: 'Faltan resultados' };
  }
  const nextRoundExists = (competition.matches || []).some((m) => {
    if (Number(m.round) !== roundNum + 1) return false;
    return matchBelongsToCategory(competition, m, filterCategory || 'all');
  });
  if (nextRoundExists) return { ok: false, message: 'Ya existe siguiente fase' };
  const winners = currentRoundMatches
    .map((m) => ({ id: m.winnerTeamId, name: m.winnerTeamName }))
    .filter((w) => w.id);
  if (winners.length === 1) {
    if (filterCategory) {
      competition.categoryChampions = competition.categoryChampions || {};
      competition.categoryChampions[filterCategory] = winners[0];
    } else {
      competition.champion = winners[0];
    }
    return { ok: true, champion: true, category: filterCategory };
  }
  const next = buildKnockoutRound(
    winners,
    competition.id,
    roundNum + 1,
    knockoutStageName(winners.length)
  );
  if (filterCategory) next.forEach((m) => { m.categoryHint = filterCategory; });
  competition.matches.push(...next);
  return { ok: true, added: next.length, category: filterCategory };
}

function makeTeam(id, name, category, isGuest) {
  return {
    id,
    name,
    category,
    isGuestTeam: !!isGuest,
    roster: isGuest
      ? [{ source: 'external', name: 'Ext ' + name, dorsal: '9' }]
      : [{ source: 'club', id: 'P1', name: 'Socio ' + name }]
  };
}

function makeSemifinalMatch(compId, round, cat, home, away, id) {
  return {
    id,
    competitionId: compId,
    round,
    categoryHint: cat,
    homeTeamId: home.id,
    homeTeamName: home.name,
    awayTeamId: away.id,
    awayTeamName: away.name,
    homeScore: 2,
    awayScore: 1,
    status: 'completed',
    winnerTeamId: home.id,
    winnerTeamName: home.name
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function run() {
  const comp = {
    id: 'COMP_TEST',
    name: 'Torneo prueba 2 cat',
    type: 'torneo',
    appScope: 'cdsanabriacf',
    excludeFromOfficialPlayerStats: true,
    categories: ['Alevín', 'Infantil'],
    teams: [
      makeTeam('GUEST_1', 'Visitante A', 'Alevín', true),
      makeTeam('GUEST_2', 'Visitante B', 'Alevín', true),
      makeTeam('TEAM_1', 'Local A', 'Alevín', false),
      makeTeam('TEAM_2', 'Local B', 'Alevín', false),
      makeTeam('GUEST_3', 'Visitante C', 'Infantil', true),
      makeTeam('GUEST_4', 'Visitante D', 'Infantil', true),
      makeTeam('TEAM_3', 'Local C', 'Infantil', false),
      makeTeam('TEAM_4', 'Local D', 'Infantil', false)
    ],
    matches: [],
    categoryChampions: {}
  };

  const alevinTeams = comp.teams.filter((t) => t.category === 'Alevín');
  const infantilTeams = comp.teams.filter((t) => t.category === 'Infantil');
  comp.matches.push(
    makeSemifinalMatch(comp.id, 1, 'Alevín', alevinTeams[0], alevinTeams[1], 'M_A1'),
    makeSemifinalMatch(comp.id, 1, 'Alevín', alevinTeams[2], alevinTeams[3], 'M_A2'),
    makeSemifinalMatch(comp.id, 1, 'Infantil', infantilTeams[0], infantilTeams[1], 'M_I1'),
    makeSemifinalMatch(comp.id, 1, 'Infantil', infantilTeams[2], infantilTeams[3], 'M_I2')
  );

  assert(comp.teams.filter((t) => t.isGuestTeam).length === 4, 'Debe haber 4 equipos externos');
  assert(comp.excludeFromOfficialPlayerStats === true, 'Stats solo competición');

  const rAle = tryAdvanceKnockoutRound(comp, { round: 1, categoryFilter: 'Alevín' });
  assert(rAle.ok && rAle.added === 1, 'Alevín: debe generar 1 final');
  const rInfBefore = tryAdvanceKnockoutRound(comp, { round: 1, categoryFilter: 'Infantil' });
  assert(rInfBefore.ok && rInfBefore.added === 1, 'Infantil: debe generar 1 final sin mezclar con Alevín');

  const finals = comp.matches.filter((m) => m.round === 2);
  assert(finals.length === 2, 'Deben existir 2 finales (una por categoría)');
  assert(
    finals.every((m) => m.categoryHint === 'Alevín' || m.categoryHint === 'Infantil'),
    'Cada final con categoryHint'
  );

  finals.forEach((m) => {
    m.status = 'completed';
    m.homeScore = 1;
    m.awayScore = 0;
    m.winnerTeamId = m.homeTeamId;
    m.winnerTeamName = m.homeTeamName;
    const cat = getMatchPrimaryCategory(comp, m);
    tryAdvanceKnockoutRound(comp, { round: 2, categoryFilter: cat });
  });

  assert(comp.categoryChampions['Alevín'], 'Campeón Alevín');
  assert(comp.categoryChampions['Infantil'], 'Campeón Infantil');
  assert(
    comp.teams.some((t) => t.id.startsWith('GUEST_')),
    'IDs invitados GUEST_ presentes'
  );

  console.log('✅ verify-competition-flow: OK');
  console.log('   - 2 categorías, 4 equipos externos, fases separadas');
  console.log('   - Campeones:', comp.categoryChampions);
  return 0;
}

try {
  process.exit(run());
} catch (e) {
  console.error('❌ verify-competition-flow:', e.message);
  process.exit(1);
}
