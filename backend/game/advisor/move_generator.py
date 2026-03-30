"""
Enumerate all legal moves for a player in a given game state snapshot.
"""
from itertools import combinations

COLORS = ['white', 'blue', 'green', 'red', 'black']


def generate_all_moves(snapshot):
    """Return a list of all legal move dicts for the advised player."""
    moves = []
    moves.extend(_gem_moves(snapshot))
    moves.extend(_buy_moves(snapshot))
    moves.extend(_reserve_moves(snapshot))
    return moves


# ──────────────────────────────────────────────────────────
# Gem-taking moves
# ──────────────────────────────────────────────────────────

def _gem_moves(snapshot):
    bank = snapshot['bank']
    my_tokens = snapshot['my_tokens']
    total_tokens = sum(my_tokens.values())

    moves = []
    available_colors = [c for c in COLORS if bank.get(c, 0) > 0]
    num_available = len(available_colors)

    # 2 of the same color (bank must have >= 4)
    for c in COLORS:
        if bank.get(c, 0) >= 4:
            moves.append({'type': 'take_gems', 'colors': [c, c]})

    # 3 different colors
    if num_available >= 3:
        for combo in combinations(available_colors, 3):
            moves.append({'type': 'take_gems', 'colors': list(combo)})
    elif num_available == 2:
        # Can only take 2 when exactly 2 colors in bank
        moves.append({'type': 'take_gems', 'colors': list(available_colors)})
    elif num_available == 1:
        moves.append({'type': 'take_gems', 'colors': [available_colors[0]]})

    return moves


# ──────────────────────────────────────────────────────────
# Buy-card moves
# ──────────────────────────────────────────────────────────

def _buy_moves(snapshot):
    moves = []
    cards = snapshot['cards']
    my_tokens = snapshot['my_tokens']
    my_purchased = snapshot['my_purchased']
    my_reserved = snapshot['my_reserved']
    visible_cards = snapshot['visible_cards']

    all_visible_ids = []
    for level in ['1', '2', '3']:
        all_visible_ids.extend(visible_cards.get(level, []))

    for card_id in all_visible_ids:
        if can_afford(card_id, my_tokens, my_purchased, cards):
            moves.append({'type': 'buy_card', 'card_id': card_id, 'from_reserved': False})

    for card_id in my_reserved:
        if can_afford(card_id, my_tokens, my_purchased, cards):
            moves.append({'type': 'buy_card', 'card_id': card_id, 'from_reserved': True})

    return moves


def can_afford(card_id, my_tokens, my_purchased, cards):
    """Return True if player can pay for card (using gems + gold)."""
    card = cards.get(card_id)
    if not card:
        return False
    bonuses = get_bonuses(my_purchased, cards)
    gold = my_tokens.get('gold', 0)
    gold_needed = 0
    for color in COLORS:
        need = card['cost'].get(color, 0)
        discount = bonuses.get(color, 0)
        have = my_tokens.get(color, 0)
        shortfall = max(0, need - discount - have)
        gold_needed += shortfall
    return gold_needed <= gold


def get_bonuses(purchased_ids, cards):
    """Compute permanent gem bonuses from purchased cards."""
    bonuses = {c: 0 for c in COLORS}
    for cid in purchased_ids:
        card = cards.get(cid)
        if card:
            bonuses[card['bonus']] = bonuses.get(card['bonus'], 0) + 1
    return bonuses


# ──────────────────────────────────────────────────────────
# Reserve moves
# ──────────────────────────────────────────────────────────

def _reserve_moves(snapshot):
    if len(snapshot['my_reserved']) >= 3:
        return []

    moves = []
    visible_cards = snapshot['visible_cards']
    deck_sizes = snapshot['deck_sizes']

    for level in ['1', '2', '3']:
        for card_id in visible_cards.get(level, []):
            moves.append({
                'type': 'reserve_card',
                'card_id': card_id,
                'is_deck': False,
                'level': int(level),
            })

    for level in ['1', '2', '3']:
        if deck_sizes.get(level, 0) > 0:
            moves.append({
                'type': 'reserve_card',
                'card_id': None,
                'is_deck': True,
                'level': int(level),
            })

    return moves
