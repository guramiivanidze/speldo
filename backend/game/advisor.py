"""
Game Advisor — analyses the current game state and recommends the best move.

Uses multi-turn lookahead (2 turns ahead) to evaluate moves not just by
immediate value but by future winning trajectories.  The advisor simulates
each legal move, produces the resulting state, then recursively scores the
best follow-up to find paths that lead to 15+ prestige fastest.

Scoring dimensions (per-turn evaluation):
  - Immediate prestige gain
  - Noble completion / progress
  - Engine-building value (bonus color utility)
  - Opponent threat / race awareness
  - Resource efficiency
  - Future trajectory value (discounted lookahead)
"""

from copy import deepcopy
from .game_logic import (
    COLORS, get_card, get_noble,
    get_player_bonuses, effective_cost,
)

# ── Scoring weights ──────────────────────────────────────────────────

W_POINTS           = 40.0   # Direct prestige points
W_NOBLE_PROGRESS   = 12.0   # Fractional progress toward a noble
W_NOBLE_COMPLETE   = 30.0   # Completing a noble this turn
W_ENGINE           = 6.0    # Bonus color that feeds future buys
W_CHEAP            = 3.0    # How cheap the card is to buy now
W_RESERVE_NEED     = 5.0    # Reserving a high-value card before opponent
W_GOLD_VALUE       = 2.0    # Getting a gold token on reserve
W_TOKEN_PROGRESS   = 4.0    # Tokens that bring the best card in reach
W_ENDGAME          = 20.0   # Bonus for moves that reach 15 points
W_OPPONENT_THREAT  = 8.0    # Block opponent from winning

# Lookahead discount factors — future moves are worth less than the present

# Increase lookahead depth for deeper planning
LOOKAHEAD_DEPTH    = 5
DISCOUNT           = [1.0, 0.7, 0.5, 0.3, 0.15, 0.1]   # depth 0, 1, 2, 3, 4, 5

# Memoization cache for state evaluation
_EVAL_CACHE = {}


# ══════════════════════════════════════════════════════════════════════
#  Public entry point
# ══════════════════════════════════════════════════════════════════════

def get_hint(game_data, player_data, opponents):
    """Return the recommended move for *player_data* with lookahead.

    Parameters
    ----------
    game_data : dict
        tokens_in_bank, visible_cards, decks, available_nobles.
    player_data : dict
        tokens, purchased_card_ids, reserved_card_ids, noble_ids, prestige_points.
    opponents : list[dict]
        Other players (same shape as player_data).

    Returns
    -------
    dict with action, card_id, token_colors, level, score, reason, alternatives.
    """
    candidates = _evaluate_all_moves(game_data, player_data, opponents, depth=0)

    if not candidates:
        return {
            'action': 'take_tokens', 'card_id': None, 'token_colors': [],
            'level': None, 'score': 0, 'reason': 'No legal moves available.',
            'alternatives': [],
        }

    candidates.sort(key=lambda c: c['score'], reverse=True)
    best = candidates[0]

    return {
        **best,
        'score': round(best['score'], 1),
        'alternatives': [
            {k: (round(v, 1) if k == 'score' else v) for k, v in a.items()}
            for a in candidates[1:4]
        ],
    }


# ══════════════════════════════════════════════════════════════════════
#  Core evaluation with optional recursion
# ══════════════════════════════════════════════════════════════════════

def _evaluate_all_moves(game_data, player_data, opponents, depth):
    """Score every legal move.  When *depth* < LOOKAHEAD_DEPTH, each move is
    also scored by simulating forward and evaluating the resulting position."""
    # Memoization key: hashable snapshot of state
    state_key = (
        depth,
        tuple(sorted(player_data['tokens'].items())),
        tuple(sorted(player_data['purchased_card_ids'])),
        tuple(sorted(player_data['reserved_card_ids'])),
        player_data.get('prestige_points', 0),
        tuple(sorted(game_data['available_nobles'])),
        tuple((lvl, tuple(game_data['visible_cards'].get(lvl, []))) for lvl in ('1','2','3')),
        tuple((o['prestige_points'], tuple(sorted(o['purchased_card_ids']))) for o in opponents),
    )
    if state_key in _EVAL_CACHE:
        return _EVAL_CACHE[state_key]

    bonuses = get_player_bonuses(player_data['purchased_card_ids'])
    noble_progress = _noble_proximity(bonuses, game_data['available_nobles'])
    opp_max_prestige = max((o['prestige_points'] for o in opponents), default=0)

    candidates = []

    # ── 1. Buy visible cards ─────────────────────────────────────────
    for lvl in ('1', '2', '3'):
        for cid in game_data['visible_cards'].get(lvl, []):
            imm_score, reason = _score_buy(
                cid, game_data, player_data, bonuses, noble_progress, opp_max_prestige,
            )
            if imm_score is None:
                continue
            # Simulate if this card is a threat for any opponent (could win or trigger noble)
            block_bonus = 0.0
            block_reason = ''
            card = get_card(cid)
            if card:
                for opp in opponents:
                    opp_bonuses = get_player_bonuses(opp['purchased_card_ids'])
                    opp_pts = card.get('points', 0)
                    opp_new_prestige = opp['prestige_points'] + opp_pts
                    opp_new_bonuses = dict(opp_bonuses)
                    opp_new_bonuses[card['bonus']] = opp_new_bonuses.get(card['bonus'], 0) + 1
                    opp_noble_pts = _check_noble_gain(opp_new_bonuses, game_data['available_nobles'])
                    opp_new_prestige += opp_noble_pts
                    # If opponent could win by buying this card
                    if opp_new_prestige >= 15:
                        block_bonus += 25
                        block_reason += f' (blocks opponent win!)'
                    # If opponent could trigger a noble
                    elif opp_noble_pts > 0:
                        block_bonus += 8
                        block_reason += f' (blocks opponent noble)'
                    # If opponent can afford this card next turn
                    opp_spend = effective_cost(cid, opp['tokens'], opp['purchased_card_ids'])
                    if opp_spend is not None and sum(opp_spend.values()) <= 2:
                        block_bonus += 4
                        block_reason += ' (blocks easy buy)'
            future = 0.0
            future_note = ''
            if depth < LOOKAHEAD_DEPTH:
                future, future_note = _lookahead_buy(
                    cid, game_data, player_data, opponents, depth,
                )
            total = (imm_score + block_bonus) * DISCOUNT[depth] + future
            full_reason = reason + block_reason + (f' → next: {future_note}' if future_note else '')
            candidates.append(_cand('buy_card', cid, [], None, total, full_reason))

    # ── 2. Buy reserved cards ────────────────────────────────────────
    for cid in player_data['reserved_card_ids']:
        imm_score, reason = _score_buy(
            cid, game_data, player_data, bonuses, noble_progress, opp_max_prestige,
        )
        if imm_score is None:
            continue
        # Prioritize buying reserved cards if they win or trigger a noble
        card = get_card(cid)
        reserved_bonus = 0.0
        reserved_reason = ''
        if card:
            pts = card.get('points', 0)
            new_prestige = player_data['prestige_points'] + pts
            new_bonuses = dict(bonuses)
            new_bonuses[card['bonus']] = new_bonuses.get(card['bonus'], 0) + 1
            noble_pts = _check_noble_gain(new_bonuses, game_data['available_nobles'])
            new_prestige += noble_pts
            if new_prestige >= 15:
                reserved_bonus += 30  # Strongly prefer winning
                reserved_reason += ' (reserved card wins!)'
            elif noble_pts > 0:
                reserved_bonus += 12  # Prefer if triggers noble
                reserved_reason += f' (reserved triggers noble +{noble_pts})'
            # Slight bonus for reserved cards that are now affordable
            spend = effective_cost(cid, player_data['tokens'], player_data['purchased_card_ids'])
            if spend is not None and sum(spend.values()) <= 2:
                reserved_bonus += 3
                reserved_reason += ' (reserved now cheap)'
        future = 0.0
        future_note = ''
        if depth < LOOKAHEAD_DEPTH:
            future, future_note = _lookahead_buy(
                cid, game_data, player_data, opponents, depth,
            )
        total = (imm_score + reserved_bonus) * DISCOUNT[depth] + future
        full_reason = reason + ' (from reserved)' + reserved_reason + (f' → next: {future_note}' if future_note else '')
        candidates.append(_cand('buy_card', cid, [], None, total, full_reason))

    # ── 3. Reserve visible cards ─────────────────────────────────────
    if len(player_data['reserved_card_ids']) < 3:
        for lvl in ('1', '2', '3'):
            for cid in game_data['visible_cards'].get(lvl, []):
                imm_score, reason = _score_reserve(
                    cid, game_data, player_data, bonuses, noble_progress, opp_max_prestige,
                )
                future = 0.0
                future_note = ''
                if depth < LOOKAHEAD_DEPTH:
                    future, future_note = _lookahead_reserve(
                        cid, game_data, player_data, opponents, depth,
                    )
                total = imm_score * DISCOUNT[depth] + future
                full_reason = reason + (f' → next: {future_note}' if future_note else '')
                candidates.append(_cand('reserve_card', cid, [], None, total, full_reason))

    # ── 4. Take tokens ──────────────────────────────────────────────
    # Generate all legal token-taking moves (reuse existing logic if present)
    token_moves = _generate_token_moves(game_data, player_data)
    for colors in token_moves:
        imm_score, reason = _score_take_tokens(
            colors, game_data, player_data, bonuses, noble_progress, opp_max_prestige,
        )
        future = 0.0
        future_note = ''
        if depth < LOOKAHEAD_DEPTH:
            future, future_note = _lookahead_take(
                colors, game_data, player_data, opponents, depth,
            )
        total = imm_score * DISCOUNT[depth] + future
        full_reason = reason + (f' → next: {future_note}' if future_note else '')
        candidates.append(_cand('take_tokens', None, colors, None, total, full_reason))

    # Early pruning: keep only top 8 candidates at each node to limit branching
    if len(candidates) > 8:
        candidates.sort(key=lambda c: c['score'], reverse=True)
        candidates = candidates[:8]

    _EVAL_CACHE[state_key] = candidates
    return candidates

# Generate all legal token-taking moves (3 different, or 2 of one color if enough in bank)
def _generate_token_moves(game_data, player_data):
    bank = game_data['tokens_in_bank']
    held = player_data['tokens']
    colors = [c for c in COLORS if bank.get(c, 0) > 0]
    moves = set()
    # Take 3 different colors
    for i in range(len(colors)):
        for j in range(i+1, len(colors)):
            for k in range(j+1, len(colors)):
                moves.add(tuple(sorted([colors[i], colors[j], colors[k]])))
    # Take 2 of one color if at least 4 in bank
    for c in colors:
        if bank.get(c, 0) >= 4:
            moves.add((c, c))
    # Remove moves that would exceed 10 tokens
    legal_moves = []
    for move in moves:
        if sum(held.values()) + len(move) <= 10:
            legal_moves.append(list(move))
    return legal_moves


def _cand(action, card_id, token_colors, level, score, reason):
    return {
        'action': action, 'card_id': card_id, 'token_colors': token_colors,
        'level': level, 'score': score, 'reason': reason,
    }


# ══════════════════════════════════════════════════════════════════════
#  Lookahead simulation — produce next state and recurse
# ══════════════════════════════════════════════════════════════════════

def _lookahead_buy(card_id, game_data, player_data, opponents, depth):
    """Simulate buying *card_id* and return (future_score, note)."""
    card = get_card(card_id)
    if not card:
        return 0.0, ''
    spend = effective_cost(card_id, player_data['tokens'], player_data['purchased_card_ids'])
    if spend is None:
        return 0.0, ''

    new_player = deepcopy(player_data)
    new_game = deepcopy(game_data)

    # Pay tokens
    for c, amt in spend.items():
        new_player['tokens'][c] = new_player['tokens'].get(c, 0) - amt
        new_game['tokens_in_bank'][c] = new_game['tokens_in_bank'].get(c, 0) + amt

    # Gain card
    new_player['purchased_card_ids'] = list(new_player['purchased_card_ids']) + [card_id]
    new_player['prestige_points'] += card.get('points', 0)
    if card_id in new_player['reserved_card_ids']:
        new_player['reserved_card_ids'] = [c for c in new_player['reserved_card_ids'] if c != card_id]

    # Remove from visible
    lvl = str(card['level'])
    vc = new_game['visible_cards'].get(lvl, [])
    if card_id in vc:
        new_game['visible_cards'][lvl] = [c for c in vc if c != card_id]

    # Check nobles
    _sim_noble_check(new_player, new_game)

    # Early win — huge bonus
    if new_player['prestige_points'] >= 15:
        return W_ENDGAME * DISCOUNT[depth + 1], 'wins the game'

    return _best_future_score(new_game, new_player, opponents, depth + 1)


def _lookahead_reserve(card_id, game_data, player_data, opponents, depth):
    """Simulate reserving *card_id* and return (future_score, note)."""
    card = get_card(card_id)
    if not card:
        return 0.0, ''

    new_player = deepcopy(player_data)
    new_game = deepcopy(game_data)

    # Gain gold
    if new_game['tokens_in_bank'].get('gold', 0) > 0:
        new_game['tokens_in_bank']['gold'] -= 1
        new_player['tokens']['gold'] = new_player['tokens'].get('gold', 0) + 1

    # Move card to reserved
    new_player['reserved_card_ids'] = list(new_player['reserved_card_ids']) + [card_id]
    lvl = str(card['level'])
    vc = new_game['visible_cards'].get(lvl, [])
    if card_id in vc:
        new_game['visible_cards'][lvl] = [c for c in vc if c != card_id]

    return _best_future_score(new_game, new_player, opponents, depth + 1)


def _lookahead_take(colors, game_data, player_data, opponents, depth):
    """Simulate taking *colors* tokens and return (future_score, note)."""
    new_player = deepcopy(player_data)
    new_game = deepcopy(game_data)

    for c in colors:
        new_game['tokens_in_bank'][c] = new_game['tokens_in_bank'].get(c, 0) - 1
        new_player['tokens'][c] = new_player['tokens'].get(c, 0) + 1

    # Approximate forced discard: drop cheapest surplus colors
    total = sum(new_player['tokens'].values())
    if total > 10:
        _sim_auto_discard(new_player, new_game, total - 10)

    return _best_future_score(new_game, new_player, opponents, depth + 1)


def _best_future_score(game_data, player_data, opponents, depth):
    """Recursively evaluate and return (best_score, short_note)."""
    future_cands = _evaluate_all_moves(game_data, player_data, opponents, depth)
    if not future_cands:
        return 0.0, ''
    future_cands.sort(key=lambda c: c['score'], reverse=True)
    best = future_cands[0]
    action_label = {
        'buy_card': 'buy',
        'reserve_card': 'reserve',
        'take_tokens': 'take tokens',
    }.get(best['action'], best['action'])
    return best['score'], action_label


def _sim_noble_check(player_data, game_data):
    """Award nobles to *player_data* in-place if bonuses qualify."""
    bonuses = get_player_bonuses(player_data['purchased_card_ids'])
    gained = []
    for nid in list(game_data['available_nobles']):
        noble = get_noble(nid)
        if not noble:
            continue
        if all(bonuses.get(c, 0) >= v for c, v in noble['requirements'].items()):
            player_data['prestige_points'] += noble['points']
            player_data['noble_ids'] = list(player_data.get('noble_ids', [])) + [nid]
            gained.append(nid)
    for nid in gained:
        game_data['available_nobles'] = [n for n in game_data['available_nobles'] if n != nid]


def _sim_auto_discard(player_data, game_data, count):
    """Discard *count* tokens from the player, returning them to the bank.
    Heuristic: drop least-useful colors first."""
    bonuses = get_player_bonuses(player_data['purchased_card_ids'])
    # Score each held color: lower is less useful
    color_value = {}
    for c in COLORS + ['gold']:
        held = player_data['tokens'].get(c, 0)
        if held <= 0:
            continue
        if c == 'gold':
            color_value[c] = 10  # gold is always valuable
        else:
            color_value[c] = bonuses.get(c, 0) * 0.5 + held * 0.1
    # Discard lowest-value first
    to_discard = sorted(color_value, key=lambda c: color_value[c])
    discarded = 0
    for c in to_discard:
        while discarded < count and player_data['tokens'].get(c, 0) > 0:
            player_data['tokens'][c] -= 1
            game_data['tokens_in_bank'][c] = game_data['tokens_in_bank'].get(c, 0) + 1
            discarded += 1
        if discarded >= count:
            break


# ── Scoring helpers ──────────────────────────────────────────────────

def _score_buy(card_id, game_data, player_data, bonuses, noble_progress,
               opp_max_prestige):
    """Score buying a specific card. Returns (score, reason) or (None, '') if can't afford."""
    spend = effective_cost(card_id, player_data['tokens'], player_data['purchased_card_ids'])
    if spend is None:
        return None, ''

    card = get_card(card_id)
    if not card:
        return None, ''

    score = 0.0
    reasons = []


    # Direct points
    pts = card.get('points', 0)
    new_prestige = player_data['prestige_points'] + pts
    # Check noble completion after buying
    new_bonuses = dict(bonuses)
    new_bonuses[card['bonus']] = new_bonuses.get(card['bonus'], 0) + 1
    noble_pts = _check_noble_gain(new_bonuses, game_data['available_nobles'])
    new_prestige += noble_pts

    # If this move wins the game, make it overwhelmingly best
    if new_prestige >= 15:
        score = 10000.0
        reasons.append(f'+{pts} prestige')
        if noble_pts > 0:
            reasons.append(f'triggers noble (+{noble_pts}pts)')
        reasons.append('WINS THE GAME!')
        return score, f"Buy L{card['level']} {card['bonus']} card: " + ', '.join(reasons)

    if pts > 0:
        score += pts * W_POINTS
        reasons.append(f'+{pts} prestige')
    if noble_pts > 0:
        score += W_NOBLE_COMPLETE * (noble_pts / 3)
        reasons.append(f'triggers noble (+{noble_pts}pts)')

    # Noble progress: how much does this bonus help toward nobles?
    bonus_color = card['bonus']
    noble_score = _bonus_noble_utility(bonus_color, bonuses, game_data['available_nobles'])
    if noble_score > 0:
        score += noble_score * W_NOBLE_PROGRESS
        reasons.append(f'{bonus_color} bonus aids nobles')

    # Engine value: how useful is this bonus for buying future visible cards?
    engine_val = _bonus_engine_value(bonus_color, game_data, bonuses)
    if engine_val > 0:
        score += engine_val * W_ENGINE

    # Cheapness bonus: less tokens spent = better
    total_spent = sum(spend.values())
    cheapness = max(0, 8 - total_spent)
    score += cheapness * W_CHEAP
    if total_spent == 0:
        reasons.append('free buy')
    elif total_spent <= 2:
        reasons.append('very cheap')

    # Opponent threat: block if opponent is close to winning
    if opp_max_prestige >= 12:
        score += W_OPPONENT_THREAT
        reasons.append('opponent close to winning')

    reason = f"Buy L{card['level']} {bonus_color} card: " + ', '.join(reasons)
    return score, reason


def _score_reserve(card_id, game_data, player_data, bonuses, noble_progress,
                   opp_max_prestige):
    """Score reserving a specific card."""
    card = get_card(card_id)
    if not card:
        return 0.0, ''

    score = 0.0
    reasons = []

    # High-point cards are worth reserving
    pts = card.get('points', 0)
    if pts >= 3:
        score += pts * W_RESERVE_NEED
        reasons.append(f'high-value card ({pts}pts)')

    # Gold token value
    if game_data['tokens_in_bank'].get('gold', 0) > 0:
        score += W_GOLD_VALUE
        reasons.append('+gold token')

    # If card helps with nobles
    bonus_color = card['bonus']
    noble_score = _bonus_noble_utility(bonus_color, bonuses, game_data['available_nobles'])
    if noble_score > 0:
        score += noble_score * (W_NOBLE_PROGRESS * 0.6)
        reasons.append(f'{bonus_color} aids noble path')

    # Block opponent from getting a key card
    card_value_for_opps = pts * 2 + noble_score * 3
    if card_value_for_opps > 8 and opp_max_prestige >= 10:
        score += W_OPPONENT_THREAT * 0.5
        reasons.append('deny opponent')

    # Penalize reserving if already have 2 reserved
    if len(player_data['reserved_card_ids']) >= 2:
        score *= 0.6
        reasons.append('already 2 reserved')

    # Can the player almost afford this card? If close, reserve is better
    spend = effective_cost(card_id, player_data['tokens'], player_data['purchased_card_ids'])
    if spend is None:
        # Can't afford yet — reserving saves it
        almost = _how_close_to_afford(card_id, player_data, bonuses)
        if almost >= 0.6:
            score += almost * W_RESERVE_NEED
            reasons.append('almost affordable')
    else:
        # Can already afford — buying is usually better, penalize reserve
        score *= 0.3

    reason = f"Reserve L{card['level']} {bonus_color} card: " + ', '.join(reasons)
    return score, reason


def _score_take_tokens(colors, game_data, player_data, bonuses, noble_progress,
                       opp_max_prestige):
    """Score a token-taking option."""
    score = 0.0
    reasons = []

    # How close does this bring us to buying the best target card?
    best_target_score = 0
    best_target_name = ''

    all_visible = []
    for lvl in ('1', '2', '3'):
        all_visible.extend(game_data['visible_cards'].get(lvl, []))
    all_visible.extend(player_data['reserved_card_ids'])

    sim_tokens = dict(player_data['tokens'])
    for c in colors:
        sim_tokens[c] = sim_tokens.get(c, 0) + 1

    for cid in all_visible:
        card = get_card(cid)
        if not card:
            continue

        # Would we be able to afford after taking these tokens?
        spend = effective_cost(cid, sim_tokens, player_data['purchased_card_ids'])
        card_val = _card_value(card, bonuses, game_data['available_nobles'], opp_max_prestige)

        if spend is not None:
            # This take enables a buy next turn
            val = card_val * 1.5
            if val > best_target_score:
                best_target_score = val
                best_target_name = f"L{card['level']} {card['bonus']}"
        else:
            # Measure how much closer we get
            closeness_before = _how_close_to_afford(cid, player_data, bonuses)
            closeness_after = _how_close_to_afford_with_tokens(cid, sim_tokens, player_data['purchased_card_ids'])
            progress = closeness_after - closeness_before
            if progress > 0:
                val = card_val * progress
                if val > best_target_score:
                    best_target_score = val
                    best_target_name = f"L{card['level']} {card['bonus']}"

    score += best_target_score * W_TOKEN_PROGRESS

    if best_target_name:
        reasons.append(f'toward {best_target_name}')

    # Prefer taking 3 different over 2 same (more flexible)
    if len(set(colors)) == 3:
        score += 1.5
        reasons.append('3 different colors')
    elif len(colors) == 2 and colors[0] == colors[1]:
        score += 1.0
        reasons.append(f'2× {colors[0]}')

    # Penalty if already at 8+ tokens (risk discard)
    current_total = sum(player_data['tokens'].values())
    if current_total + len(colors) > 10:
        score *= 0.4
        reasons.append('risk discard')
    elif current_total >= 8:
        score *= 0.7
        reasons.append('token count high')

    color_str = ', '.join(colors) if colors else 'none'
    reason = f"Take tokens [{color_str}]: " + ', '.join(reasons) if reasons else f"Take tokens [{color_str}]"
    return score, reason


# ── Utility functions ────────────────────────────────────────────────

def _noble_proximity(bonuses, available_nobles):
    """Dict mapping noble_id -> fraction of requirements met (0.0 – 1.0)."""
    result = {}
    for nid in available_nobles:
        noble = get_noble(nid)
        if not noble:
            continue
        total_req = sum(noble['requirements'].values())
        if total_req == 0:
            result[nid] = 1.0
            continue
        met = sum(
            min(bonuses.get(c, 0), v) for c, v in noble['requirements'].items()
        )
        result[nid] = met / total_req
    return result


def _bonus_noble_utility(bonus_color, bonuses, available_nobles):
    """How useful is gaining +1 of bonus_color toward any available noble? 0-1 scale."""
    best = 0.0
    current_count = bonuses.get(bonus_color, 0)
    for nid in available_nobles:
        noble = get_noble(nid)
        if not noble:
            continue
        req = noble['requirements'].get(bonus_color, 0)
        if req > 0 and current_count < req:
            # This bonus brings us closer to this noble
            total_req = sum(noble['requirements'].values())
            met = sum(min(bonuses.get(c, 0), v) for c, v in noble['requirements'].items())
            # After gaining this bonus
            new_met = met + 1
            progress = new_met / total_req if total_req else 0
            best = max(best, progress)
    return best


def _bonus_engine_value(bonus_color, game_data, bonuses):
    """How much does +1 of bonus_color reduce cost of visible cards? 0-1 scale."""
    savings_count = 0
    total_cards = 0
    for lvl in ('1', '2', '3'):
        for cid in game_data['visible_cards'].get(lvl, []):
            card = get_card(cid)
            if not card:
                continue
            total_cards += 1
            cost_of_color = card['cost'].get(bonus_color, 0)
            current_discount = bonuses.get(bonus_color, 0)
            if cost_of_color > current_discount:
                savings_count += 1
    if total_cards == 0:
        return 0.0
    return savings_count / total_cards


def _card_value(card, bonuses, available_nobles, opp_max_prestige):
    """Composite value of a card for strategic ranking."""
    pts = card.get('points', 0)
    val = pts * 3
    # Noble utility
    val += _bonus_noble_utility(card['bonus'], bonuses, available_nobles) * 5
    # Engine value is harder to compute without game_data, approximate
    val += 1  # base value for any card
    return val


def _check_noble_gain(bonuses, available_nobles):
    """Return total noble points gained if bonuses qualify for nobles."""
    pts = 0
    for nid in available_nobles:
        noble = get_noble(nid)
        if not noble:
            continue
        if all(bonuses.get(c, 0) >= v for c, v in noble['requirements'].items()):
            pts += noble['points']
    return pts


def _how_close_to_afford(card_id, player_data, bonuses):
    """Return 0.0-1.0 fraction of how close to affording this card."""
    card = get_card(card_id)
    if not card:
        return 0.0
    total_needed = 0
    total_have = 0
    for color in COLORS:
        need = max(0, card['cost'].get(color, 0) - bonuses.get(color, 0))
        have = player_data['tokens'].get(color, 0)
        total_needed += need
        total_have += min(have, need)
    gold = player_data['tokens'].get('gold', 0)
    total_have += gold
    if total_needed == 0:
        return 1.0
    return min(1.0, total_have / total_needed)


def _how_close_to_afford_with_tokens(card_id, tokens, purchased_card_ids):
    """Same as _how_close_to_afford but with hypothetical tokens dict."""
    card = get_card(card_id)
    if not card:
        return 0.0
    bonuses = get_player_bonuses(purchased_card_ids)
    total_needed = 0
    total_have = 0
    for color in COLORS:
        need = max(0, card['cost'].get(color, 0) - bonuses.get(color, 0))
        have = tokens.get(color, 0)
        total_needed += need
        total_have += min(have, need)
    gold = tokens.get('gold', 0)
    total_have += gold
    if total_needed == 0:
        return 1.0
    return min(1.0, total_have / total_needed)


def _generate_token_options(bank):
    """Generate all legal token-taking combinations."""
    options = []
    available = [c for c in COLORS if bank.get(c, 0) > 0]
    num_available = len(available)

    # 2 of same color (need 4+ in bank)
    for c in available:
        if bank.get(c, 0) >= 4:
            options.append([c, c])

    # 3 different colors
    if num_available >= 3:
        from itertools import combinations
        for combo in combinations(available, 3):
            options.append(list(combo))

    # 2 different colors (only if exactly 2 available)
    if num_available == 2:
        options.append(list(available))

    # 1 color (only if exactly 1 available)
    if num_available == 1:
        options.append([available[0]])

    return options
