"""
Main Splendor AI Advisor entry point.

Usage:
    from game.advisor.splendor_advisor import get_advised_move
    advice = get_advised_move(game_data, players_data, advised_player_index)
"""
from .move_generator import generate_all_moves, get_bonuses
from .move_scorer import score_move, simulate_move, score_position, DEFAULT_WEIGHTS, recommend_discard
from .opponent_modeler import find_biggest_threat
from .noble_tracker import closest_noble, all_noble_distances
from .engine_evaluator import identify_target_cards, turns_to_buy

LOOKAHEAD_DISCOUNT = 0.7   # how much we weight the next-turn position
TOP_K_LOOKAHEAD = 8        # top candidates to run lookahead on


# ──────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────

def get_advised_move(game_data, players_data, advised_player_index, weights=None):
    """
    Compute the best move for `advised_player_index`.

    Parameters
    ----------
    game_data : dict
        Keys: tokens_in_bank, visible_cards, decks, available_nobles
    players_data : list[dict]
        One dict per player, in turn order (index matches player.order).
        Each dict: tokens, purchased_card_ids, reserved_card_ids,
                   noble_ids, prestige_points
    advised_player_index : int
        Index into players_data.
    weights : dict | None
        Scoring weights; defaults to DEFAULT_WEIGHTS.

    Returns
    -------
    dict  (AdvisedMove schema)
    """
    if weights is None:
        weights = DEFAULT_WEIGHTS

    snapshot = _build_snapshot(game_data, players_data, advised_player_index)
    moves = generate_all_moves(snapshot)

    if not moves:
        return _fallback_response()

    # ── Phase 1: score all moves ──
    base_scored = [
        (move, score_move(move, snapshot, weights))
        for move in moves
    ]
    base_scored.sort(key=lambda x: -x[1])

    # ── Phase 2: lookahead on top-K candidates ──
    final_scored = []
    for move, base_score in base_scored[:TOP_K_LOOKAHEAD]:
        next_snap = simulate_move(move, snapshot)
        next_moves = generate_all_moves(next_snap)
        if next_moves:
            next_scores = [score_move(m, next_snap, weights) for m in next_moves]
            best_next = max(next_scores)
        else:
            best_next = 0.0
        final_score = base_score + LOOKAHEAD_DISCOUNT * best_next
        final_scored.append((move, final_score))

    # Append non-lookahead moves unchanged
    for move, base_score in base_scored[TOP_K_LOOKAHEAD:]:
        final_scored.append((move, base_score))

    final_scored.sort(key=lambda x: -x[1])

    best_move, best_score = final_scored[0]
    second_move = final_scored[1][0] if len(final_scored) > 1 else None
    second_score = final_scored[1][1] if len(final_scored) > 1 else 0.0

    # ── Phase 3: build output ──
    strategy = _build_strategy(snapshot, best_move, weights)
    reasoning = _build_reasoning(best_move, snapshot, strategy)

    # Confidence: how much better is best vs second-best?
    score_gap = best_score - second_score
    if best_score > 0:
        confidence = min(0.98, 0.5 + score_gap / (best_score + 1))
    else:
        confidence = 0.5

    result = {
        'action': best_move['type'],
        'reasoning': reasoning,
        'confidence': round(max(0.4, confidence), 2),
        'strategy': strategy,
    }

    if best_move['type'] == 'take_gems':
        gems_dict = _colors_to_dict(best_move['colors'])
        result['gems'] = gems_dict
        # Discard recommendation when taking gems causes overflow
        my_tokens = snapshot['my_tokens']
        total_after = sum(my_tokens.values()) + len(best_move['colors'])
        if total_after > 10:
            discard = recommend_discard(
                best_move['colors'], my_tokens, snapshot['my_bonuses'], snapshot
            )
            if discard:
                result['discard_gems'] = discard
    elif best_move['type'] == 'buy_card':
        result['card_id'] = best_move['card_id']
    elif best_move['type'] == 'reserve_card':
        if best_move.get('is_deck'):
            result['reserve_card_id'] = f"deck_tier{best_move['level']}"
        else:
            result['reserve_card_id'] = best_move['card_id']
        # Discard recommendation if reserving causes overflow (gold gained)
        my_tokens = snapshot['my_tokens']
        if snapshot['bank'].get('gold', 0) > 0:
            total_after = sum(my_tokens.values()) + 1
            if total_after > 10:
                discard = recommend_discard(
                    ['gold'], my_tokens, snapshot['my_bonuses'], snapshot
                )
                if discard:
                    result['discard_gems'] = discard

    if second_move:
        result['alternative_move'] = _format_move(second_move)

    return result


# ──────────────────────────────────────────────────────────
# Snapshot builder
# ──────────────────────────────────────────────────────────

def _build_snapshot(game_data, players_data, advised_player_index):
    """Normalise raw Django model dicts into a unified snapshot."""
    from game.game_logic import get_all_cards, get_all_nobles

    all_cards = {c['id']: c for c in get_all_cards()}
    all_nobles = {n['id']: n for n in get_all_nobles()}

    player = players_data[advised_player_index]
    my_purchased = list(player.get('purchased_card_ids', []))
    my_bonuses = get_bonuses(my_purchased, all_cards)

    decks = game_data.get('decks', {})
    deck_sizes = {str(lvl): len(decks.get(str(lvl), [])) for lvl in [1, 2, 3]}

    return {
        # Bank / board
        'bank': dict(game_data.get('tokens_in_bank', {})),
        'visible_cards': {k: list(v) for k, v in game_data.get('visible_cards', {}).items()},
        'deck_sizes': deck_sizes,
        'available_nobles': list(game_data.get('available_nobles', [])),

        # Advised player
        'my_tokens': dict(player.get('tokens', {})),
        'my_purchased': my_purchased,
        'my_reserved': list(player.get('reserved_card_ids', [])),
        'my_nobles': list(player.get('noble_ids', [])),
        'my_points': player.get('prestige_points', 0),
        'my_bonuses': my_bonuses,
        'my_index': advised_player_index,

        # All players (lightweight dicts)
        'players': [
            {
                'tokens': dict(p.get('tokens', {})),
                'purchased_card_ids': list(p.get('purchased_card_ids', [])),
                'reserved_card_ids': list(p.get('reserved_card_ids', [])),
                'noble_ids': list(p.get('noble_ids', [])),
                'prestige_points': p.get('prestige_points', 0),
            }
            for p in players_data
        ],

        # Reference data
        'cards': all_cards,
        'nobles_data': all_nobles,
    }


# ──────────────────────────────────────────────────────────
# Strategy narrative
# ──────────────────────────────────────────────────────────

def _build_strategy(snapshot, best_move, weights):
    my_points = snapshot['my_points']

    # --- Current goal ---
    target_cards = identify_target_cards(snapshot)
    if target_cards:
        top_id, _ = target_cards[0]
        top_card = snapshot['cards'].get(top_id)
        goal = (
            f"Building toward tier {top_card['level']} "
            f"{top_card['bonus']} card ({top_card['points']} pts)"
            if top_card else "Building gem engine"
        )
    else:
        goal = "Collecting gems efficiently"

    noble_id, noble_dist = closest_noble(
        snapshot['nobles_data'], snapshot['available_nobles'], snapshot['my_bonuses']
    )
    if noble_id and noble_dist <= 4:
        noble = snapshot['nobles_data'].get(noble_id, {})
        name_part = f" ({noble['name']})" if noble.get('name') else ""
        goal = f"Noble{name_part} in {noble_dist} more bonus card{'s' if noble_dist != 1 else ''}"

    if my_points >= 12:
        goal = "Endgame sprint — maximise VP per turn"

    # --- Turns to win (rough) ---
    pts_needed = max(0, 15 - my_points)
    if pts_needed == 0:
        turns_to_win = 0
    elif pts_needed <= 3:
        turns_to_win = 1
    elif pts_needed <= 7:
        turns_to_win = 4
    elif pts_needed <= 11:
        turns_to_win = 7
    else:
        turns_to_win = 12

    # --- Biggest threat ---
    _, threat = find_biggest_threat(snapshot)
    if threat is None:
        threat_str = "No significant threats yet"
    elif threat['can_win_next_turn']:
        threat_str = "URGENT — opponent can win next turn!"
    elif threat['points'] >= 13:
        threat_str = f"Opponent at {threat['points']} pts — imminent win"
    elif threat['points'] >= 10:
        threat_str = f"Opponent at {threat['points']} pts — watch closely"
    else:
        threat_str = f"Leading opponent has {threat['points']} pts"

    # --- Next-turn plan ---
    if best_move['type'] == 'buy_card':
        next_plan = "Look to buy another card or collect gems for next purchase"
    elif best_move['type'] == 'take_gems':
        next_plan = "Should be close to affording a card next turn"
    else:
        next_plan = "Work toward buying the reserved card once gems are ready"

    return {
        'currentGoal': goal,
        'turnsToWin': turns_to_win,
        'biggestThreat': threat_str,
        'nextTurnPlan': next_plan,
    }


# ──────────────────────────────────────────────────────────
# Reasoning text
# ──────────────────────────────────────────────────────────

def _build_reasoning(move, snapshot, strategy):
    cards = snapshot['cards']
    nobles_data = snapshot['nobles_data']
    my_bonuses = snapshot['my_bonuses']
    my_points = snapshot['my_points']

    urgent = 'URGENT' in strategy.get('biggestThreat', '')

    if move['type'] == 'buy_card':
        card_id = move['card_id']
        card = cards.get(card_id, {})
        pts = card.get('points', 0)
        bonus = card.get('bonus', '')
        level = card.get('level', 1)

        if pts >= 3:
            reason = f"Buy the {pts}-VP tier-{level} {bonus} card"
        elif pts > 0:
            reason = f"Buy tier-{level} {bonus} card ({pts} VP + discount)"
        else:
            reason = f"Buy tier-{level} {bonus} card for the permanent {bonus} discount"

        # Add context
        goal = strategy.get('currentGoal', '')
        if 'Noble' in goal:
            reason += " — advances your noble goal"
        if urgent:
            reason += ". Race to finish before opponent wins!"

    elif move['type'] == 'take_gems':
        colors = move['colors']
        unique = list(set(colors))
        if len(colors) == 2 and colors[0] == colors[1]:
            reason = f"Take 2 {colors[0]} — faster progress toward target card"
        else:
            color_str = ', '.join(unique)
            reason = f"Take {color_str} gems — best progress toward top target cards"
        if urgent:
            reason += " (prepare to buy VP fast)"

    elif move['type'] == 'reserve_card':
        card_id = move.get('card_id')
        is_deck = move.get('is_deck', False)
        level = move.get('level', 1)

        if is_deck:
            reason = f"Reserve blind from tier-{level} deck — gain gold + element of surprise"
        else:
            card = cards.get(card_id, {}) if card_id else {}
            pts = card.get('points', 0)
            bonus = card.get('bonus', '')
            card_level = card.get('level', level)
            if pts >= 4:
                reason = f"Reserve the {pts}-VP {bonus} card before an opponent grabs it"
            elif pts >= 2:
                reason = f"Reserve tier-{card_level} {bonus} card + gain gold token"
            else:
                reason = f"Reserve tier-{card_level} {bonus} card for future purchase"
    else:
        reason = "Best available move given current position"

    return reason


# ──────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────

def _format_move(move):
    result = {'action': move['type']}
    if move['type'] == 'take_gems':
        result['gems'] = _colors_to_dict(move['colors'])
    elif move['type'] == 'buy_card':
        result['card_id'] = move['card_id']
    elif move['type'] == 'reserve_card':
        if move.get('is_deck'):
            result['reserve_card_id'] = f"deck_tier{move['level']}"
        else:
            result['reserve_card_id'] = move['card_id']
    return result


def _colors_to_dict(colors):
    result = {}
    for c in colors:
        result[c] = result.get(c, 0) + 1
    return result


def _fallback_response():
    return {
        'action': 'take_gems',
        'gems': {},
        'reasoning': 'No legal moves found — check game state',
        'confidence': 0.1,
        'strategy': {
            'currentGoal': 'Waiting',
            'turnsToWin': 99,
            'biggestThreat': 'Unknown',
            'nextTurnPlan': 'Reassess next turn',
        },
    }
