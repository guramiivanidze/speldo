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


def _gem_deficit_for_card(card, opp_tokens, opp_bonuses):
    """Gems an opponent still needs to buy *card* (net of gold)."""
    gold = opp_tokens.get('gold', 0)
    total = 0
    for color in COLORS:
        need = card['cost'].get(color, 0)
        discount = opp_bonuses.get(color, 0)
        have = opp_tokens.get(color, 0)
        total += max(0, need - discount - have)
    return max(0, total - gold)


def _can_afford(card, opp_tokens, opp_bonuses):
    return _gem_deficit_for_card(card, opp_tokens, opp_bonuses) <= 0


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
    Sorted by turns_needed ascending.
    """
    cards = snapshot['cards']
    opp_bonuses = get_bonuses(opp_player['purchased_card_ids'], cards)
    opp_tokens = opp_player['tokens']

    candidate_ids = list(opp_player['reserved_card_ids'])
    for level in ['1', '2', '3']:
        candidate_ids.extend(snapshot['visible_cards'].get(level, []))

    reachable = []
    for cid in candidate_ids:
        card = cards.get(cid)
        if not card:
            continue
        deficit = _gem_deficit_for_card(card, opp_tokens, opp_bonuses)
        turns_needed = max(0, (deficit + 2) // 3)
        if turns_needed <= n:
            reachable.append((cid, turns_needed))

    return sorted(reachable, key=lambda x: x[1])


def assess_threat_level(opp_player, snapshot):
    """
    Return a dict with threat metrics for one opponent.
    """
    cards = snapshot['cards']
    nobles_data = snapshot['nobles_data']
    available_nobles = snapshot['available_nobles']

    opp_points = opp_player['prestige_points']
    opp_bonuses = get_bonuses(opp_player['purchased_card_ids'], cards)
    opp_tokens = opp_player['tokens']

    # What's the max points opponent could score next turn?
    buyable_now = cards_opponent_can_buy_now(opp_player, snapshot)
    max_pts_next_turn = 0
    for cid in buyable_now:
        card = cards.get(cid)
        if not card:
            continue
        pts = card['points']
        # Also check if a noble would trigger
        from .noble_tracker import check_noble_triggered
        for nid in available_nobles:
            if check_noble_triggered(nid, nobles_data, opp_bonuses, card['bonus']):
                pts += nobles_data[nid]['points']
        max_pts_next_turn = max(max_pts_next_turn, pts)

    from .noble_tracker import all_noble_distances
    noble_distances = all_noble_distances(nobles_data, available_nobles, opp_bonuses)
    closest_noble_dist = min(noble_distances.values()) if noble_distances else 999

    return {
        'points': opp_points,
        'points_to_win': max(0, 15 - opp_points),
        'max_pts_next_turn': max_pts_next_turn,
        'can_win_next_turn': (opp_points + max_pts_next_turn) >= 15,
        'closest_noble_deficit': closest_noble_dist,
        'is_dangerous': opp_points >= 10,
        'cards_buyable_now': len(buyable_now),
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
        # Score: heavier weight on how close to winning they are
        score = threat['points'] * 2 + threat['max_pts_next_turn']
        if threat['can_win_next_turn']:
            score += 100  # Urgent override
        if score > best_score:
            best_score = score
            best_player = p
            best_threat = threat

    return best_player, best_threat
