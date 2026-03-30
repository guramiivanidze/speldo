"""
Score legal moves using a multi-factor composite function.
Higher score = better move.
"""
import copy
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

    # Proximity to best reachable VP
    targets = identify_target_cards(snapshot, n=3)
    for cid, cval in targets:
        score += cval * 0.5

    # Noble proximity
    noble_dists = all_noble_distances(
        snapshot['nobles_data'], snapshot['available_nobles'], snapshot['my_bonuses']
    )
    for dist in noble_dists.values():
        score += 3.0 / max(1, dist + 1)

    return score


# ──────────────────────────────────────────────────────────
# Endgame multiplier
# ──────────────────────────────────────────────────────────

def _endgame_mult(snapshot, weights):
    my_pts = snapshot['my_points']
    max_opp = max(
        (p['prestige_points'] for i, p in enumerate(snapshot['players'])
         if i != snapshot['my_index']),
        default=0,
    )
    critical = max(my_pts, max_opp)
    if critical >= 13:
        return weights['endgame_urgency'] / 10.0   # ≈1.5×
    if critical >= 11:
        return 1.35
    if critical >= 9:
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

    # 2. Nobles triggered immediately
    triggered = nobles_triggered_by_purchase(card, nobles_data, available_nobles, my_bonuses)
    for nid in triggered:
        score += nobles_data[nid]['points'] * weights['noble_acquired'] * em

    # 3. Noble proximity — heavily reward buying toward achievable nobles.
    #    Weight inversely to distance: at dist=1 (one card away after this) it's very valuable.
    noble_dists = all_noble_distances(nobles_data, available_nobles, my_bonuses)
    for nid, dist in noble_dists.items():
        noble = nobles_data.get(nid)
        if not noble or nid in triggered:
            continue
        progress = noble_progress_from_card(noble, card, my_bonuses)
        if progress:
            # dist is CURRENT distance; after buying this card dist becomes dist-1
            new_dist = dist - 1
            # Each step closer to a 3-VP noble is worth more as we approach it
            proximity_score = 3.0 / max(0.5, new_dist + 1) * weights['noble_proximity_gain'] / 8.0
            score += proximity_score

    # 4. Engine alignment — how much does this bonus help future purchases?
    target_cards = identify_target_cards(snapshot)
    target_ids = [cid for cid, _ in target_cards if cid != card_id]
    engine_val = buying_card_helps_engine(card, target_ids, cards, my_bonuses)
    score += engine_val * weights['bonus_alignment_with_target']

    # 5. Concrete turns saved on visible tier-2/3 cards
    saved = estimate_turns_saved(card, snapshot)
    score += saved * weights['turns_accelerated']

    # 6. Tier premium
    score += {1: 0.0, 2: 0.8, 3: 2.0}.get(card.get('level', 1), 0.0)

    # 7. Free reserved slot
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

    # Hard discard penalty — must return a gem, net gain is only 2 gems
    if overflow > 0:
        score -= overflow * 8.0

    # ── Core metric: turns saved on best target cards ──
    # This is better than raw deficit reduction because it accounts for
    # per-color bottlenecks and 2-same takes.
    target_cards = identify_target_cards(snapshot, n=4)
    turns_saved_total = 0.0

    for card_id, card_val in target_cards[:3]:
        card = cards.get(card_id)
        if not card:
            continue
        old_ttb = turns_to_buy(card, my_bonuses, my_tokens)
        new_ttb = turns_to_buy(card, my_bonuses, new_tokens)
        delta = old_ttb - new_ttb
        if delta > 0:
            # Weight by card importance (points + card_val)
            turns_saved_total += delta * max(1.0, card['points'] + 1)

    score += turns_saved_total * weights['gem_efficiency'] * em

    # ── 2-same bonus: faster when one color is the sole bottleneck ──
    unique = set(colors)
    if len(colors) == 2 and len(unique) == 1:
        score += 1.5
    elif len(unique) == 3:
        score += 1.0   # Flexibility bonus for 3-different

    # ── Penalise taking gems not needed by any top target ──
    needed_colors = set()
    for card_id, _ in target_cards[:4]:
        card = cards.get(card_id)
        if not card:
            continue
        for c, qty in card['cost'].items():
            if qty > 0 and my_bonuses.get(c, 0) < qty:
                needed_colors.add(c)

    useless = sum(1 for c in unique if c not in needed_colors)
    score -= useless * 2.0

    # ── Scarcity denial: taking a gem others need ──
    for c in unique:
        remaining = bank.get(c, 0) - colors.count(c)
        if remaining <= 2:
            score += 1.0

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

    # Gold token
    if bank.get('gold', 0) > 0:
        score += weights['gold_token_value']
        # Extra if we'll have 10 tokens after (gold is wasteable) — small penalty
        total_after = sum(my_tokens.values()) + 1
        if total_after > 10:
            score -= 4.0  # forced discard on reserve is bad

    card_id = move.get('card_id')
    is_deck = move.get('is_deck', False)
    level = move.get('level', 1)

    if is_deck or card_id is None:
        spec = {1: 0.3, 2: 1.0, 3: 2.5}.get(level, 0.3)
        score += spec * weights['reservation_value'] / 5.0
        score -= 2.0   # uncertainty penalty
        # 3rd reserve slot is very costly
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

    # Blocking value
    for i, opp in enumerate(players):
        if i == my_index:
            continue
        reachable = cards_opponent_can_buy_in_n_turns(opp, snapshot, 2)
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
    s = copy.deepcopy(snapshot)
    t = move['type']

    if t == 'take_gems':
        for c in move['colors']:
            s['bank'][c] = max(0, s['bank'].get(c, 0) - 1)
            s['my_tokens'][c] = s['my_tokens'].get(c, 0) + 1

    elif t == 'buy_card':
        card_id = move['card_id']
        card = s['cards'].get(card_id)
        if card:
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

            if card_id in s['my_reserved']:
                s['my_reserved'].remove(card_id)
            for lvl in ['1', '2', '3']:
                vc = s['visible_cards'].get(lvl, [])
                if card_id in vc:
                    vc.remove(card_id)

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

    # Score each color by how much it's needed across top target cards
    target_cards = identify_target_cards(snapshot, n=4)
    color_need = {c: 0.0 for c in COLORS + ['gold']}

    for card_id, card_val in target_cards[:4]:
        card = snapshot['cards'].get(card_id)
        if not card:
            continue
        shortfalls = per_color_shortfalls(card, my_bonuses, new_tokens)
        for color, shortage in shortfalls.items():
            color_need[color] += shortage * max(1, card['points'] + 1)

    # Build a list of returnable tokens, sorted least-needed first
    # Gold is very valuable — never recommend returning gold unless forced
    color_need['gold'] = color_need.get('gold', 0) + 999

    returnable = []
    for color, count in new_tokens.items():
        if count <= 0:
            continue
        # Can only return gems we took or already had — never go below 0
        max_returnable = count
        need_score = color_need.get(color, 0)
        for _ in range(max_returnable):
            returnable.append((need_score, color))

    # Sort by need ascending (return least-needed first)
    returnable.sort(key=lambda x: x[0])

    discard = {}
    for _, color in returnable[:n_to_return]:
        discard[color] = discard.get(color, 0) + 1
        new_tokens[color] -= 1

    return discard
