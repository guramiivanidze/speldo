"""
Noble proximity calculations — how close is a player to each noble?
"""
COLORS = ['white', 'blue', 'green', 'red', 'black']


def noble_deficit(noble, player_bonuses):
    """Number of additional bonuses needed to qualify for this noble."""
    total = 0
    for color in COLORS:
        need = noble.get('requirements', {}).get(color, 0)
        have = player_bonuses.get(color, 0)
        total += max(0, need - have)
    return total


def all_noble_distances(nobles_data, available_noble_ids, player_bonuses):
    """Return {noble_id: deficit} for all available nobles."""
    return {
        nid: noble_deficit(nobles_data[nid], player_bonuses)
        for nid in available_noble_ids
        if nid in nobles_data
    }


def closest_noble(nobles_data, available_noble_ids, player_bonuses):
    """Return (noble_id, deficit) for the easiest-to-reach noble. (None, 999) if none."""
    distances = all_noble_distances(nobles_data, available_noble_ids, player_bonuses)
    if not distances:
        return None, 999
    best_id = min(distances, key=distances.get)
    return best_id, distances[best_id]


def noble_progress_from_card(noble, card, player_bonuses):
    """
    Return 1 if buying *card* moves the player one step closer to *noble*,
    0 if the bonus is already met or not required.
    """
    color = card['bonus']
    need = noble.get('requirements', {}).get(color, 0)
    have = player_bonuses.get(color, 0)
    return 1 if have < need else 0


def check_noble_triggered(noble_id, nobles_data, player_bonuses, new_bonus_color):
    """
    Would buying a card with *new_bonus_color* complete the requirements for noble_id?
    Assumes the card hasn't been added to bonuses yet.
    """
    noble = nobles_data.get(noble_id)
    if not noble:
        return False
    augmented = dict(player_bonuses)
    augmented[new_bonus_color] = augmented.get(new_bonus_color, 0) + 1
    return all(
        augmented.get(c, 0) >= v
        for c, v in noble.get('requirements', {}).items()
        if v > 0
    )


def nobles_triggered_by_purchase(card, nobles_data, available_noble_ids, player_bonuses):
    """Return list of noble IDs that would be triggered by buying *card*."""
    return [
        nid for nid in available_noble_ids
        if check_noble_triggered(nid, nobles_data, player_bonuses, card['bonus'])
    ]
