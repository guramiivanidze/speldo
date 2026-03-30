"""
Score legal moves using a multi-factor composite function.
Higher score = better move.
"""
from .move_generator import COLORS, get_bonuses, can_afford
from .noble_tracker import (
    all_noble_distances, noble_progress_from_card,
    check_noble_triggered, nobles_triggered_by_purchase,
)
from .engine_evaluator import (
    card_value_score, identify_target_cards,
    buying_card_helps_engine, estimate_turns_saved,
    turns_to_buy, gem_deficit, per_color_shortfalls,
)
from .opponent_modeler import (
    cards_opponent_can_buy_in_n_turns, find_biggest_threat,
    identify_opponent_targets,
)

DEFAULT_WEIGHTS = {
    'points_gained': 10,
    'noble_acquired': 12,
    'bonus_alignment_with_target': 5,
    'turns_accelerated': 5,
    'noble_proximity_gain': 8,
    'opponent_blocking': 7,
    'endgame_urgency': 15,
    'gold_token_value': 3,
    'reservation_value': 3,
    'gem_efficiency': 4,
}


# ──────────────────────────────────────────────────────────
# Snapshot copy helper (avoids deepcopy of read-only cards data)
# ──────────────────────────────────────────────────────────

def _copy_snapshot(snapshot):
    """
    Selective copy: share read-only reference data (cards, nobles_data),
    copy only mutable game state. ~10-20x faster than deepcopy.
    """
    return {
        # Read-only: share references
        'cards': snapshot['cards'],
        'nobles_data': snapshot['nobles_data'],
        # Mutable board state
        'bank': dict(snapshot['bank']),
        'visible_cards': {k: list(v) for k, v in snapshot['visible_cards'].items()},
        'deck_sizes': dict(snapshot['deck_sizes']),
        'available_nobles': list(snapshot['available_nobles']),
        # Mutable player state
        'my_tokens': dict(snapshot['my_tokens']),
        'my_purchased': list(snapshot['my_purchased']),
        'my_reserved': list(snapshot['my_reserved']),
        'my_nobles': list(snapshot.get('my_nobles', [])),
        'my_points': snapshot['my_points'],
        'my_bonuses': dict(snapshot['my_bonuses']),
        'my_index': snapshot['my_index'],
        # All players (shallow copy of each player dict)
        'players': [
            {
                'tokens': dict(p['tokens']),
                'purchased_card_ids': list(p['purchased_card_ids']),
                'reserved_card_ids': list(p['reserved_card_ids']),
                'noble_ids': list(p.get('noble_ids', [])),
                'prestige_points': p['prestige_points'],
            }
            for p in snapshot['players']
        ],
    }


# ──────────────────────────────────────────────────────────
# Top-level scorer
# ──────────────────────────────────────────────────────────

def score_move(move, snapshot, weights=None):
    if weights is None:
        weights = DEFAULT_WEIGHTS
    t = move['type']
    if t == 'buy_card':
        return _score_buy(move, snapshot, weights)
    if t == 'take_gems':
        return _score_take_gems(move, snapshot, weights)
    if t == 'reserve_card':
        return _score_reserve(move, snapshot, weights)
    return 0.0


def score_position(snapshot, weights=None):
    """Static evaluation of the advised player's position."""
    if weights is None:
        weights = DEFAULT_WEIGHTS

    score = snapshot['my_points'] * 4.0
    score += len(snapshot.get('my_nobles', [])) * 3.0
    score += sum(snapshot['my_bonuses'].values()) * 0.6

    targets = identify_target_cards(snapshot, n=3)
    for cid, cval in targets:
        score += cval * 0.5

    noble_dists = all_noble_distances(
        snapshot['nobles_data'], snapshot['available_nobles'], snapshot['my_bonuses']
    )
    for dist in noble_dists.values():
        score += 3.0 / max(1, dist + 1)

    return score


# ──────────────────────────────────────────────────────────
# Endgame multiplier — escalates earlier for better race awareness
# ──────────────────────────────────────────────────────────

def _endgame_mult(snapshot, weights):
    my_pts = snapshot['my_points']
    max_opp = max(
        (p['prestige_points'] for i, p in enumerate(snapshot['players'])
         if i != snapshot['my_index']),
        default=0,
    )
    critical = max(my_pts, max_opp)
    if critical >= 12:
        return 2.2
    if critical >= 10:
        return 1.7
    if critical >= 8:
        return 1.35
    if critical >= 6:
        return 1.15
    return 1.0


# ──────────────────────────────────────────────────────────
# Buy card
# ──────────────────────────────────────────────────────────

def _score_buy(move, snapshot, weights):
    card_id = move['card_id']
    cards = snapshot['cards']
    nobles_data = snapshot['nobles_data']
    available_nobles = snapshot['available_nobles']
    my_bonuses = snapshot['my_bonuses']
    my_tokens = snapshot['my_tokens']

    card = cards.get(card_id)
    if not card:
        return 0.0

    em = _endgame_mult(snapshot, weights)
    score = 0.0

    # 1. Direct VP
    score += card['points'] * weights['points_gained'] * em

    # 2. Win-race emergency: if an opponent can win next turn, scoring ANY VP is critical
    best_opp, threat = find_biggest_threat(snapshot)
    if threat and threat['can_win_next_turn'] and card['points'] > 0:
        score += card['points'] * 8.0

    # 3. Nobles triggered immediately
    triggered = nobles_triggered_by_purchase(card, nobles_data, available_nobles, my_bonuses)
    for nid in triggered:
        score += nobles_data[nid]['points'] * weights['noble_acquired'] * em

    # 4. Noble proximity — reward buying toward achievable nobles
    noble_dists = all_noble_distances(nobles_data, available_nobles, my_bonuses)
    for nid, dist in noble_dists.items():
        noble = nobles_data.get(nid)
        if not noble or nid in triggered:
            continue
        progress = noble_progress_from_card(noble, card, my_bonuses)
        if progress:
            new_dist = dist - 1
            proximity_score = 3.0 / max(0.5, new_dist + 1) * weights['noble_proximity_gain'] / 8.0
            score += proximity_score

    # 5. Engine alignment
    target_cards = identify_target_cards(snapshot)
    target_ids = [cid for cid, _ in target_cards if cid != card_id]
    engine_val = buying_card_helps_engine(card, target_ids, cards, my_bonuses)
    score += engine_val * weights['bonus_alignment_with_target']

    # 6. Concrete turns saved on visible tier-2/3 cards
    saved = estimate_turns_saved(card, snapshot)
    score += saved * weights['turns_accelerated']

    # 7. Tier premium
    score += {1: 0.0, 2: 0.8, 3: 2.0}.get(card.get('level', 1), 0.0)

    # 8. Free reserved slot
    if move.get('from_reserved'):
        score += 2.0

    return score


# ──────────────────────────────────────────────────────────
# Take gems
# ──────────────────────────────────────────────────────────

def _score_take_gems(move, snapshot, weights):
    colors = move['colors']
    cards = snapshot['cards']
    my_bonuses = snapshot['my_bonuses']
    my_tokens = snapshot['my_tokens']
    bank = snapshot['bank']
    em = _endgame_mult(snapshot, weights)

    new_tokens = dict(my_tokens)
    for c in colors:
        new_tokens[c] = new_tokens.get(c, 0) + 1

    total_after = sum(new_tokens.values())
    overflow = max(0, total_after - 10)
    score = 0.0

    # Discard penalty — returning gems is a significant tempo loss
    if overflow > 0:
        score -= overflow * 8.0

    # ── Core metric: turns saved on top target cards ──
    target_cards = identify_target_cards(snapshot, n=5)
    turns_saved_total = 0.0

    for card_id, card_val in target_cards[:4]:
        card = cards.get(card_id)
        if not card:
            continue
        old_ttb = turns_to_buy(card, my_bonuses, my_tokens)
        new_ttb = turns_to_buy(card, my_bonuses, new_tokens)
        delta = old_ttb - new_ttb
        if delta > 0:
            turns_saved_total += delta * max(1.0, card['points'] + 1)

    score += turns_saved_total * weights['gem_efficiency'] * em

    # ── "Unlocks next-turn buy" mega-bonus ──
    # If taking these gems makes a target card immediately affordable (new_ttb=0),
    # we can buy it next turn. This is the most important gem-taking pattern in Splendor.
    for card_id, card_val in target_cards[:5]:
        card = cards.get(card_id)
        if not card:
            continue
        was_not_affordable = turns_to_buy(card, my_bonuses, my_tokens) > 0
        now_affordable = turns_to_buy(card, my_bonuses, new_tokens) == 0
        if was_not_affordable and now_affordable:
            score += card['points'] * 5.0 + card_val * 2.5 + 4.0

    # ── 2-same bonus / 3-different flexibility ──
    unique = set(colors)
    if len(colors) == 2 and len(unique) == 1:
        score += 1.5
    elif len(unique) == 3:
        score += 1.0

    # ── Penalise taking gems not needed by any top target ──
    needed_colors = set()
    for card_id, _ in target_cards[:5]:
        card = cards.get(card_id)
        if not card:
            continue
        for c, qty in card['cost'].items():
            if qty > 0 and my_bonuses.get(c, 0) < qty:
                needed_colors.add(c)

    useless = sum(1 for c in unique if c not in needed_colors)
    score -= useless * 2.0

    # ── Scarcity denial: stronger reward for nearly-depleted colors ──
    for c in unique:
        remaining = bank.get(c, 0) - colors.count(c)
        if remaining <= 0:
            score += 2.5
        elif remaining <= 1:
            score += 1.8
        elif remaining <= 2:
            score += 0.8

    # ── Opponent gem denial ──
    # Reward taking gems that the most dangerous opponent needs for their targets
    best_opp, threat = find_biggest_threat(snapshot)
    if threat and threat['points'] >= 8 and best_opp:
        opp_bonuses = get_bonuses(best_opp['purchased_card_ids'], cards)
        opp_reachable = cards_opponent_can_buy_in_n_turns(best_opp, snapshot, 2)
        denial_bonus = 0.0
        for cid, _ in opp_reachable[:3]:
            opp_card = cards.get(cid)
            if not opp_card:
                continue
            for c in unique:
                shortfall = max(
                    0,
                    opp_card['cost'].get(c, 0)
                    - opp_bonuses.get(c, 0)
                    - best_opp['tokens'].get(c, 0),
                )
                if shortfall > 0:
                    denial_bonus += 0.7 * min(1.0, threat['points'] / 12.0)
        score += min(2.5, denial_bonus)

    return score


# ──────────────────────────────────────────────────────────
# Reserve card
# ──────────────────────────────────────────────────────────

def _score_reserve(move, snapshot, weights):
    cards = snapshot['cards']
    my_bonuses = snapshot['my_bonuses']
    my_tokens = snapshot['my_tokens']
    nobles_data = snapshot['nobles_data']
    available_nobles = snapshot['available_nobles']
    players = snapshot['players']
    my_index = snapshot['my_index']
    bank = snapshot['bank']
    em = _endgame_mult(snapshot, weights)

    score = 0.0

    # Gold token value
    if bank.get('gold', 0) > 0:
        score += weights['gold_token_value']
        total_after = sum(my_tokens.values()) + 1
        if total_after > 10:
            score -= 4.0

    card_id = move.get('card_id')
    is_deck = move.get('is_deck', False)
    level = move.get('level', 1)

    if is_deck or card_id is None:
        spec = {1: 0.3, 2: 1.0, 3: 2.5}.get(level, 0.3)
        score += spec * weights['reservation_value'] / 5.0
        score -= 2.0
        if len(snapshot['my_reserved']) == 2:
            score -= 3.0
        return score

    card = cards.get(card_id)
    if not card:
        return score

    ttb = turns_to_buy(card, my_bonuses, my_tokens)
    card_val = card_value_score(card, my_bonuses, my_tokens, nobles_data, available_nobles)

    # Own strategic value
    if ttb <= 4:
        own_val = card_val * weights['reservation_value'] / 4.0
        if card['points'] >= 3:
            own_val *= 1.4
        score += own_val

    # Blocking value — extend window to 3 turns for high-VP cards
    block_turns = 3 if card.get('points', 0) >= 3 else 2
    for i, opp in enumerate(players):
        if i == my_index:
            continue
        reachable = cards_opponent_can_buy_in_n_turns(opp, snapshot, block_turns)
        reachable_ids = [cid for cid, _ in reachable]
        if card_id in reachable_ids:
            threat_scale = 1.0 + opp['prestige_points'] / 10.0
            score += card['points'] * threat_scale * weights['opponent_blocking'] / 7.0 * em

    # Noble alignment
    noble_dists = all_noble_distances(nobles_data, available_nobles, my_bonuses)
    for nid, dist in noble_dists.items():
        noble = nobles_data.get(nid, {})
        if noble.get('requirements', {}).get(card['bonus'], 0) > my_bonuses.get(card['bonus'], 0):
            score += max(0, 4 - dist) * 0.5

    # 3rd reserve slot penalty
    if len(snapshot['my_reserved']) == 2:
        score -= 3.0

    return score


# ──────────────────────────────────────────────────────────
# Move simulation (for lookahead)
# ──────────────────────────────────────────────────────────

def simulate_move(move, snapshot):
    """
    Apply a move to a snapshot and return the resulting state.
    Uses selective copying to avoid expensive deepcopy of read-only card data.
    Also simulates noble collection triggered by card purchases.
    """
    s = _copy_snapshot(snapshot)
    t = move['type']

    if t == 'take_gems':
        for c in move['colors']:
            s['bank'][c] = max(0, s['bank'].get(c, 0) - 1)
            s['my_tokens'][c] = s['my_tokens'].get(c, 0) + 1

    elif t == 'buy_card':
        card_id = move['card_id']
        card = s['cards'].get(card_id)
        if card:
            old_bonuses = dict(s['my_bonuses'])  # Before purchase, for noble check

            # Pay cost using current bonuses
            bonuses = get_bonuses(s['my_purchased'], s['cards'])
            gold_used = 0
            for color in COLORS:
                need = card['cost'].get(color, 0)
                discount = bonuses.get(color, 0)
                have = s['my_tokens'].get(color, 0)
                pay = max(0, need - discount)
                if have >= pay:
                    s['my_tokens'][color] -= pay
                    s['bank'][color] = s['bank'].get(color, 0) + pay
                else:
                    s['my_tokens'][color] = 0
                    s['bank'][color] = s['bank'].get(color, 0) + have
                    gold_used += pay - have
            s['my_tokens']['gold'] = max(0, s['my_tokens'].get('gold', 0) - gold_used)
            s['bank']['gold'] = s['bank'].get('gold', 0) + gold_used

            s['my_purchased'].append(card_id)
            s['my_points'] += card['points']

            # Remove from board
            if card_id in s['my_reserved']:
                s['my_reserved'].remove(card_id)
            for lvl in ['1', '2', '3']:
                vc = s['visible_cards'].get(lvl, [])
                if card_id in vc:
                    vc.remove(card_id)

            # Noble collection — check using bonuses BEFORE this card was purchased
            # (nobles_triggered_by_purchase internally adds the card's bonus color)
            triggered = nobles_triggered_by_purchase(
                card, s['nobles_data'], s['available_nobles'], old_bonuses
            )
            for nid in triggered:
                noble = s['nobles_data'].get(nid, {})
                s['my_points'] += noble.get('points', 0)
                s['available_nobles'] = [n for n in s['available_nobles'] if n != nid]
                s['my_nobles'].append(nid)

    elif t == 'reserve_card':
        card_id = move.get('card_id')
        if card_id and not move.get('is_deck'):
            s['my_reserved'].append(card_id)
            for lvl in ['1', '2', '3']:
                vc = s['visible_cards'].get(lvl, [])
                if card_id in vc:
                    vc.remove(card_id)
        if s['bank'].get('gold', 0) > 0:
            s['bank']['gold'] -= 1
            s['my_tokens']['gold'] = s['my_tokens'].get('gold', 0) + 1

    s['my_bonuses'] = get_bonuses(s['my_purchased'], s['cards'])
    return s


# ──────────────────────────────────────────────────────────
# Discard recommendation helper
# ──────────────────────────────────────────────────────────

def recommend_discard(colors_taken, my_tokens, my_bonuses, snapshot):
    """
    When taking *colors_taken* would push the player over 10 tokens,
    return a dict of {color: count} gems to return so total == 10.

    Strategy: return gems that are LEAST needed for top target cards.
    """
    new_tokens = dict(my_tokens)
    for c in colors_taken:
        new_tokens[c] = new_tokens.get(c, 0) + 1

    total = sum(new_tokens.values())
    n_to_return = total - 10
    if n_to_return <= 0:
        return {}

    target_cards = identify_target_cards(snapshot, n=4)
    color_need = {c: 0.0 for c in COLORS + ['gold']}

    for card_id, card_val in target_cards[:4]:
        card = snapshot['cards'].get(card_id)
        if not card:
            continue
        shortfalls = per_color_shortfalls(card, my_bonuses, new_tokens)
        for color, shortage in shortfalls.items():
            color_need[color] += shortage * max(1, card['points'] + 1)

    # Gold is very valuable — never recommend returning gold unless forced
    color_need['gold'] = color_need.get('gold', 0) + 999

    returnable = []
    for color, count in new_tokens.items():
        if count <= 0:
            continue
        need_score = color_need.get(color, 0)
        for _ in range(count):
            returnable.append((need_score, color))

    returnable.sort(key=lambda x: x[0])

    discard = {}
    for _, color in returnable[:n_to_return]:
        discard[color] = discard.get(color, 0) + 1
        new_tokens[color] -= 1

    return discard
