"""
Evaluate card-buying engine quality and identify target cards.
"""
COLORS = ['white', 'blue', 'green', 'red', 'black']


def get_bonuses(purchased_ids, cards):
    bonuses = {c: 0 for c in COLORS}
    for cid in purchased_ids:
        card = cards.get(cid)
        if card:
            bonuses[card['bonus']] = bonuses.get(card['bonus'], 0) + 1
    return bonuses


def per_color_shortfalls(card, player_bonuses, my_tokens):
    """
    Return {color: shortfall} for colors where the player still needs gems
    (after bonuses; gold NOT applied here — gold is handled in turns_to_buy).
    """
    out = {}
    for color in COLORS:
        need = card['cost'].get(color, 0)
        discount = player_bonuses.get(color, 0)
        have = my_tokens.get(color, 0)
        s = max(0, need - discount - have)
        if s > 0:
            out[color] = s
    return out


def gem_deficit(card, player_bonuses, my_tokens):
    """Total gem shortfall after bonuses and gold."""
    shortfalls = per_color_shortfalls(card, player_bonuses, my_tokens)
    total = sum(shortfalls.values())
    gold = my_tokens.get('gold', 0)
    return max(0, total - gold)


def turns_to_buy(card, player_bonuses, my_tokens):
    """
    Accurate turns estimate accounting for:
    - Per-color bottlenecks (taking 3-different: 1 per color per turn)
    - 2-of-same takes (2 per turn for bottleneck color if bank allows)
    - Gold applied optimally to worst bottlenecks
    """
    shortfalls = per_color_shortfalls(card, player_bonuses, my_tokens)
    if not shortfalls:
        return 0

    # Apply gold to the largest shortfalls first
    gold = my_tokens.get('gold', 0)
    reduced = dict(shortfalls)
    for color in sorted(reduced, key=reduced.get, reverse=True):
        use = min(gold, reduced[color])
        reduced[color] -= use
        gold -= use
        if gold == 0:
            break

    reduced = {c: v for c, v in reduced.items() if v > 0}
    if not reduced:
        return 0

    total = sum(reduced.values())
    max_single = max(reduced.values())
    n_colors = len(reduced)

    if n_colors == 1:
        # Can take 2-same per turn — ceiling division by 2
        return (max_single + 1) // 2

    # Multiple colors:
    # Each turn: up to 3 different colors (1 each), or 2 of same.
    # ceil(total/3) gives turns if we perfectly distribute 3-different.
    # But the max single-color deficit limits us too —
    #   best we can do for that color is 2/turn (2-same) or 1/turn (3-diff).
    # Optimal mix: take 2-same for bottleneck when it's much larger.
    # Safe lower bound: max(ceil(total/3), ceil(max_single/2))
    return max((total + 2) // 3, (max_single + 1) // 2)


def card_value_score(card, player_bonuses, my_tokens,
                     nobles_data=None, available_nobles=None):
    """
    Composite card score: VP rate + noble potential + engine discount.
    """
    ttb = turns_to_buy(card, player_bonuses, my_tokens)
    level = card.get('level', 1)
    pts = card.get('points', 0)

    # ── VP rate: points per turn invested ──
    # Use ttb+1 to avoid zero division and to value immediacy.
    # If affordable now, double-weight points.
    vp_rate = pts * (2.0 if ttb == 0 else 1.0) / (ttb + 1)

    # ── Noble potential: does this color help toward an achievable noble? ──
    noble_bonus = 0.0
    if nobles_data and available_nobles:
        from .noble_tracker import noble_progress_from_card, all_noble_distances
        dists = all_noble_distances(nobles_data, available_nobles, player_bonuses)
        for nid, dist in dists.items():
            noble = nobles_data.get(nid, {})
            if noble_progress_from_card(noble, card, player_bonuses):
                # Noble is worth 3 VP; weight heavily when close
                noble_bonus += 3.0 / max(1, dist + 1)

    # ── Engine discount value ──
    # Every permanent bonus saves ~1/3 turn on each future purchase that needs it.
    # Higher tier cards bought sooner → bigger leverage.
    discount_value = {1: 0.6, 2: 0.9, 3: 0.4}.get(level, 0.6)
    if pts == 0 and level == 2:
        discount_value = 1.2  # Pure engine card is especially valuable

    # ── Affordability premium ──
    afford_bonus = max(0.0, 1.2 - ttb * 0.4)  # 1.2 when free, fades to 0 at ttb=3

    return vp_rate + noble_bonus + discount_value + afford_bonus


def identify_target_cards(snapshot, n=6):
    """Top-N (card_id, score) for most valuable reachable cards."""
    cards = snapshot['cards']
    player_bonuses = snapshot['my_bonuses']
    my_tokens = snapshot['my_tokens']
    nobles_data = snapshot.get('nobles_data', {})
    available_nobles = snapshot.get('available_nobles', [])

    candidate_ids = list(snapshot['my_reserved'])
    for level in ['1', '2', '3']:
        candidate_ids.extend(snapshot['visible_cards'].get(level, []))

    # Deduplicate (reserved may appear in visible during simulation)
    seen = set()
    scored = []
    for card_id in candidate_ids:
        if card_id in seen:
            continue
        seen.add(card_id)
        card = cards.get(card_id)
        if not card:
            continue
        s = card_value_score(card, player_bonuses, my_tokens, nobles_data, available_nobles)
        scored.append((card_id, s))

    scored.sort(key=lambda x: -x[1])
    return scored[:n]


def buying_card_helps_engine(card, target_card_ids, cards, player_bonuses):
    """Score 0-1: how much does buying *card* reduce costs toward targets?"""
    if not target_card_ids:
        return 0.0
    bonus_color = card['bonus']
    benefit = 0
    for tid in target_card_ids:
        target = cards.get(tid)
        if not target:
            continue
        need = target['cost'].get(bonus_color, 0)
        have = player_bonuses.get(bonus_color, 0)
        if have < need:
            benefit += (need - have)
    return min(1.0, benefit / 3.0)


def estimate_turns_saved(card, snapshot):
    """
    How many turns does buying *card*'s bonus save across visible tier-2/3 cards?
    Compares actual turns_to_buy before/after gaining the bonus.
    """
    cards = snapshot['cards']
    my_bonuses = snapshot['my_bonuses']
    my_tokens = snapshot['my_tokens']
    bonus_color = card['bonus']

    # Augmented bonuses after buying this card
    new_bonuses = dict(my_bonuses)
    new_bonuses[bonus_color] = new_bonuses.get(bonus_color, 0) + 1

    saved = 0.0
    for level in ['2', '3']:
        for cid in snapshot['visible_cards'].get(level, []):
            target = cards.get(cid)
            if not target:
                continue
            old_ttb = turns_to_buy(target, my_bonuses, my_tokens)
            new_ttb = turns_to_buy(target, new_bonuses, my_tokens)
            delta = old_ttb - new_ttb
            if delta > 0:
                # Weight by target card value
                saved += delta * (target['points'] + 1) / 5.0

    return min(4.0, saved)
