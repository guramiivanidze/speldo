"""
Core Splendor game logic.
All game state is manipulated here; the consumer calls these functions.
"""
import random
import string

from .card_data import ALL_CARDS, NOBLES

CARD_BY_ID = {c['id']: c for c in ALL_CARDS}
NOBLE_BY_ID = {n['id']: n for n in NOBLES}
COLORS = ['white', 'blue', 'green', 'red', 'black']


def generate_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


def initial_bank(player_count):
    gem_count = {2: 4, 3: 5, 4: 7}[player_count]
    return {c: gem_count for c in COLORS} | {'gold': 5}


def initial_decks_and_nobles(player_count):
    level1 = [c['id'] for c in ALL_CARDS if c['level'] == 1]
    level2 = [c['id'] for c in ALL_CARDS if c['level'] == 2]
    level3 = [c['id'] for c in ALL_CARDS if c['level'] == 3]
    random.shuffle(level1)
    random.shuffle(level2)
    random.shuffle(level3)

    noble_count = player_count + 1
    all_nobles = list(NOBLE_BY_ID.keys())
    random.shuffle(all_nobles)
    nobles = all_nobles[:noble_count]

    visible = {'1': [], '2': [], '3': []}
    for level, deck in [('1', level1), ('2', level2), ('3', level3)]:
        for _ in range(4):
            if deck:
                visible[level].append(deck.pop(0))

    decks = {'1': level1, '2': level2, '3': level3}
    return decks, visible, nobles


def get_player_bonuses(purchased_card_ids):
    bonuses = {c: 0 for c in COLORS}
    for cid in purchased_card_ids:
        card = CARD_BY_ID.get(cid)
        if card:
            bonuses[card['bonus']] += 1
    return bonuses


def effective_cost(card_id, player_tokens, purchased_card_ids):
    """Return tokens that must be spent (after applying bonuses). Returns None if can't afford."""
    card = CARD_BY_ID[card_id]
    bonuses = get_player_bonuses(purchased_card_ids)
    remaining = {}
    for color in COLORS:
        need = card['cost'].get(color, 0)
        discount = bonuses.get(color, 0)
        remaining[color] = max(0, need - discount)

    total_needed = sum(remaining.values())
    gold_available = player_tokens.get('gold', 0)
    spend = {}
    gold_used = 0

    for color in COLORS:
        need = remaining[color]
        have = player_tokens.get(color, 0)
        if have >= need:
            spend[color] = need
        else:
            spend[color] = have
            gold_used += need - have

    if gold_used > gold_available:
        return None  # can't afford

    spend['gold'] = gold_used
    return spend


def check_nobles(game_data, player_data):
    """Return list of noble ids the player qualifies for."""
    bonuses = get_player_bonuses(player_data['purchased_card_ids'])
    eligible = []
    for nid in game_data['available_nobles']:
        noble = NOBLE_BY_ID[nid]
        qualifies = all(bonuses.get(c, 0) >= v for c, v in noble['requirements'].items())
        if qualifies:
            eligible.append(nid)
    return eligible


def apply_take_tokens(game_data, player_data, colors_to_take):
    """
    colors_to_take: list of color strings.
    Either 3 different colors OR 2 of same (if bank has >=4).
    Returns (updated_game_data, updated_player_data, error_str)
    """
    bank = dict(game_data['tokens_in_bank'])
    ptokens = dict(player_data['tokens'])

    if len(colors_to_take) == 2 and colors_to_take[0] == colors_to_take[1]:
        color = colors_to_take[0]
        if bank.get(color, 0) < 4:
            return None, None, "Need at least 4 tokens of that color to take 2."
        bank[color] -= 2
        ptokens[color] = ptokens.get(color, 0) + 2
    elif len(colors_to_take) == 3 and len(set(colors_to_take)) == 3:
        for c in colors_to_take:
            if bank.get(c, 0) < 1:
                return None, None, f"No {c} tokens in bank."
            bank[c] -= 1
            ptokens[c] = ptokens.get(c, 0) + 1
    else:
        return None, None, "Invalid token selection."

    total = sum(ptokens.values())
    if total > 10:
        return None, None, f"Would exceed 10 tokens (have {total})."

    game_data = dict(game_data)
    game_data['tokens_in_bank'] = bank
    player_data = dict(player_data)
    player_data['tokens'] = ptokens
    return game_data, player_data, None


def apply_discard_tokens(game_data, player_data, tokens_to_discard):
    """Discard tokens to bring player total to <=10."""
    bank = dict(game_data['tokens_in_bank'])
    ptokens = dict(player_data['tokens'])

    for color, amount in tokens_to_discard.items():
        if ptokens.get(color, 0) < amount:
            return None, None, f"Don't have {amount} {color} tokens."
        ptokens[color] -= amount
        bank[color] = bank.get(color, 0) + amount

    if sum(ptokens.values()) > 10:
        return None, None, "Still over 10 tokens."

    game_data = dict(game_data)
    game_data['tokens_in_bank'] = bank
    player_data = dict(player_data)
    player_data['tokens'] = ptokens
    return game_data, player_data, None


def apply_reserve_card(game_data, player_data, card_id=None, level=None):
    """
    Reserve a face-up card (card_id given) or top of deck (level given).
    Returns (updated_game_data, updated_player_data, reserved_card_id, error_str)
    """
    reserved = list(player_data['reserved_card_ids'])
    if len(reserved) >= 3:
        return None, None, None, "Already have 3 reserved cards."

    visible = {k: list(v) for k, v in game_data['visible_cards'].items()}
    decks = {k: list(v) for k, v in game_data['decks'].items()}
    bank = dict(game_data['tokens_in_bank'])
    ptokens = dict(player_data['tokens'])

    if card_id is not None:
        found_level = None
        for lvl, cards in visible.items():
            if card_id in cards:
                cards.remove(card_id)
                found_level = lvl
                # refill
                if decks[lvl]:
                    cards.append(decks[lvl].pop(0))
                visible[lvl] = cards
                break
        if found_level is None:
            return None, None, None, "Card not visible on table."
    else:
        # top of deck
        lvl = str(level)
        if not decks.get(lvl):
            return None, None, None, f"Level {level} deck is empty."
        card_id = decks[lvl].pop(0)
        decks[lvl] = decks[lvl]

    reserved.append(card_id)

    # Give gold if available
    if bank.get('gold', 0) > 0:
        bank['gold'] -= 1
        ptokens['gold'] = ptokens.get('gold', 0) + 1

    if sum(ptokens.values()) > 10:
        return None, None, None, "Would exceed 10 tokens."

    game_data = dict(game_data)
    game_data['visible_cards'] = visible
    game_data['decks'] = decks
    game_data['tokens_in_bank'] = bank
    player_data = dict(player_data)
    player_data['tokens'] = ptokens
    player_data['reserved_card_ids'] = reserved
    return game_data, player_data, card_id, None


def apply_buy_card(game_data, player_data, card_id):
    """
    Buy a face-up card or reserved card.
    Returns (updated_game_data, updated_player_data, error_str)
    """
    visible = {k: list(v) for k, v in game_data['visible_cards'].items()}
    decks = {k: list(v) for k, v in game_data['decks'].items()}
    bank = dict(game_data['tokens_in_bank'])
    ptokens = dict(player_data['tokens'])
    reserved = list(player_data['reserved_card_ids'])
    purchased = list(player_data['purchased_card_ids'])

    # Check card is available
    from_reserved = card_id in reserved
    from_visible = any(card_id in cards for cards in visible.values())

    if not from_reserved and not from_visible:
        return None, None, "Card not available for purchase."

    spend = effective_cost(card_id, ptokens, purchased)
    if spend is None:
        return None, None, "Cannot afford this card."

    # Deduct tokens
    for color, amount in spend.items():
        ptokens[color] = ptokens.get(color, 0) - amount
        bank[color] = bank.get(color, 0) + amount

    # Remove card from source
    if from_reserved:
        reserved.remove(card_id)
    else:
        for lvl, cards in visible.items():
            if card_id in cards:
                cards.remove(card_id)
                if decks[lvl]:
                    cards.append(decks[lvl].pop(0))
                visible[lvl] = cards
                break

    purchased.append(card_id)

    # Compute new prestige
    card = CARD_BY_ID[card_id]
    prestige = sum(CARD_BY_ID[cid]['points'] for cid in purchased)

    game_data = dict(game_data)
    game_data['visible_cards'] = visible
    game_data['decks'] = decks
    game_data['tokens_in_bank'] = bank
    player_data = dict(player_data)
    player_data['tokens'] = ptokens
    player_data['reserved_card_ids'] = reserved
    player_data['purchased_card_ids'] = purchased
    player_data['prestige_points'] = prestige
    return game_data, player_data, None


def apply_noble_visit(game_data, player_data, noble_id):
    """Award noble to player. Returns updated game_data and player_data."""
    nobles_list = list(game_data['available_nobles'])
    noble_ids = list(player_data['noble_ids'])

    if noble_id not in nobles_list:
        return game_data, player_data
    nobles_list.remove(noble_id)
    noble_ids.append(noble_id)

    noble = NOBLE_BY_ID[noble_id]
    prestige = player_data['prestige_points'] + noble['points']

    game_data = dict(game_data)
    game_data['available_nobles'] = nobles_list
    player_data = dict(player_data)
    player_data['noble_ids'] = noble_ids
    player_data['prestige_points'] = prestige
    return game_data, player_data


def check_end_condition(players):
    """Return player_data that triggered end, or None."""
    for p in players:
        if p['prestige_points'] >= 15:
            return p
    return None


def determine_winner(players, trigger_order):
    """
    Complete current round (all players play same number of turns).
    trigger_order: the order index of the player who hit 15.
    Players with order > trigger_order have already had their last turn.
    """
    # Everyone finishes the round; find highest prestige
    best_points = max(p['prestige_points'] for p in players)
    candidates = [p for p in players if p['prestige_points'] == best_points]
    # Tiebreak: fewest purchased cards
    best_cards = min(len(p['purchased_card_ids']) for p in candidates)
    winners = [p for p in candidates if len(p['purchased_card_ids']) == best_cards]
    return winners[0]
