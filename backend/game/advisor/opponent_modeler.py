"""
Model opponent capabilities and assess threats.
"""
COLORS = ['white', 'blue', 'green', 'red', 'black']


def get_bonuses(purchased_ids, cards):
    bonuses = {c: 0 for c in COLORS}
    for cid in purchased_ids:
        card = cards.get(cid)
        if card:
            bonuses[card['bonus']] = bonuses.get(card['bonus'], 0) + 1
    return bonuses


def _can_afford(card, opp_tokens, opp_bonuses):
    gold = opp_tokens.get('gold', 0)
    gold_needed = 0
    for color in COLORS:
        shortfall = max(
            0,
            card['cost'].get(color, 0)
            - opp_bonuses.get(color, 0)
            - opp_tokens.get(color, 0),
        )
        gold_needed += shortfall
    return gold_needed <= gold


def cards_opponent_can_buy_now(opp_player, snapshot):
    """Card IDs the opponent can purchase right now."""
    cards = snapshot['cards']
    opp_bonuses = get_bonuses(opp_player['purchased_card_ids'], cards)
    opp_tokens = opp_player['tokens']

    candidate_ids = list(opp_player['reserved_card_ids'])
    for level in ['1', '2', '3']:
        candidate_ids.extend(snapshot['visible_cards'].get(level, []))

    return [
        cid for cid in candidate_ids
        if cards.get(cid) and _can_afford(cards[cid], opp_tokens, opp_bonuses)
    ]


def cards_opponent_can_buy_in_n_turns(opp_player, snapshot, n=2):
    """
    (card_id, turns_needed) tuples for cards the opponent can reach in <= n turns.
    Uses the accurate bottleneck-aware turns_to_buy calculation.
    Sorted by turns_needed ascending.
    """
    from .engine_evaluator import turns_to_buy
    cards = snapshot['cards']
    opp_bonuses = get_bonuses(opp_player['purchased_card_ids'], cards)
    opp_tokens = opp_player['tokens']

    candidate_ids = list(opp_player['reserved_card_ids'])
    for level in ['1', '2', '3']:
        candidate_ids.extend(snapshot['visible_cards'].get(level, []))

    seen = set()
    reachable = []
    for cid in candidate_ids:
        if cid in seen:
            continue
        seen.add(cid)
        card = cards.get(cid)
        if not card:
            continue
        ttb = turns_to_buy(card, opp_bonuses, opp_tokens)
        if ttb <= n:
            reachable.append((cid, ttb))

    return sorted(reachable, key=lambda x: x[1])


def identify_opponent_targets(opp_player, snapshot, n=4):
    """Top-N (card_id, score) cards the opponent is most likely pursuing."""
    from .engine_evaluator import card_value_score
    cards = snapshot['cards']
    opp_bonuses = get_bonuses(opp_player['purchased_card_ids'], cards)
    opp_tokens = opp_player['tokens']
    nobles_data = snapshot.get('nobles_data', {})
    available_nobles = snapshot.get('available_nobles', [])

    candidate_ids = list(opp_player['reserved_card_ids'])
    for level in ['1', '2', '3']:
        candidate_ids.extend(snapshot['visible_cards'].get(level, []))

    seen = set()
    scored = []
    for card_id in candidate_ids:
        if card_id in seen:
            continue
        seen.add(card_id)
        card = cards.get(card_id)
        if not card:
            continue
        s = card_value_score(card, opp_bonuses, opp_tokens, nobles_data, available_nobles)
        scored.append((card_id, s))

    scored.sort(key=lambda x: -x[1])
    return scored[:n]


def assess_threat_level(opp_player, snapshot):
    """Return a dict with threat metrics for one opponent."""
    from .engine_evaluator import turns_to_buy
    cards = snapshot['cards']
    nobles_data = snapshot['nobles_data']
    available_nobles = snapshot['available_nobles']

    opp_points = opp_player['prestige_points']
    opp_bonuses = get_bonuses(opp_player['purchased_card_ids'], cards)

    # Max points opponent can score next turn (including potential nobles)
    buyable_now = cards_opponent_can_buy_now(opp_player, snapshot)
    max_pts_next_turn = 0
    for cid in buyable_now:
        card = cards.get(cid)
        if not card:
            continue
        pts = card['points']
        from .noble_tracker import check_noble_triggered
        for nid in available_nobles:
            if check_noble_triggered(nid, nobles_data, opp_bonuses, card['bonus']):
                pts += nobles_data.get(nid, {}).get('points', 0)
        max_pts_next_turn = max(max_pts_next_turn, pts)

    # Best VP card reachable within 2 turns
    reachable_1 = cards_opponent_can_buy_in_n_turns(opp_player, snapshot, 1)
    reachable_2 = cards_opponent_can_buy_in_n_turns(opp_player, snapshot, 2)
    best_reachable_pts = max(
        (cards[cid]['points'] for cid, _ in reachable_2 if cid in cards),
        default=0,
    )

    from .noble_tracker import all_noble_distances
    noble_distances = all_noble_distances(nobles_data, available_nobles, opp_bonuses)
    closest_noble_dist = min(noble_distances.values()) if noble_distances else 999

    pts_needed = max(0, 15 - opp_points)
    turns_to_win_est = 99
    if pts_needed == 0:
        turns_to_win_est = 0
    elif (opp_points + max_pts_next_turn) >= 15:
        turns_to_win_est = 1
    elif best_reachable_pts > 0:
        turns_to_win_est = max(2, (pts_needed + best_reachable_pts - 1) // max(1, best_reachable_pts))

    return {
        'points': opp_points,
        'points_to_win': pts_needed,
        'max_pts_next_turn': max_pts_next_turn,
        'can_win_next_turn': (opp_points + max_pts_next_turn) >= 15,
        'closest_noble_deficit': closest_noble_dist,
        'is_dangerous': opp_points >= 9,
        'best_reachable_pts': best_reachable_pts,
        'turns_to_win_estimate': turns_to_win_est,
        'cards_buyable_now': len(buyable_now),
        'cards_reachable_1turn': len(reachable_1),
    }


def find_biggest_threat(snapshot):
    """
    Return (opp_player_dict, threat_info) for the most dangerous opponent.
    Returns (None, None) if no opponents.
    """
    my_index = snapshot['my_index']
    players = snapshot['players']

    best_score = -1
    best_player = None
    best_threat = None

    for i, p in enumerate(players):
        if i == my_index:
            continue
        threat = assess_threat_level(p, snapshot)
        score = (
            threat['points'] * 3
            + threat['max_pts_next_turn'] * 2
            + threat['best_reachable_pts']
            + max(0, 5 - threat['closest_noble_deficit']) * 0.5
        )
        if threat['can_win_next_turn']:
            score += 200
        if score > best_score:
            best_score = score
            best_player = p
            best_threat = threat

    return best_player, best_threat
