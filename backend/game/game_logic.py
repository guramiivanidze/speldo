"""
Core Splendor game logic.
All game state is manipulated here; the consumer calls these functions.
"""
import random
import string

COLORS = ['white', 'blue', 'green', 'red', 'black']

# Placement points awarded per game.
# Key = player count, value = points by placement (index 0 = 1st place).
# Change these values once and they propagate to all leaderboards.
PLACEMENT_POINTS = {
    2: [3, -1],
    3: [4, 1, -1],
    4: [5, 2, 0, -1],
}

# Cached card/noble data from database
_card_cache = None
_noble_cache = None


def _load_cards():
    """Load all cards from database into cache."""
    global _card_cache
    if _card_cache is None:
        from .models import DevelopmentCard
        _card_cache = {}
        for card in DevelopmentCard.objects.all():
            _card_cache[card.id] = {
                'id': card.id,
                'level': card.level,
                'bonus': card.bonus,
                'points': card.points,
                'cost': card.cost,
                'background_image': card.background_image.url if card.background_image else '',
            }
    return _card_cache


def _load_nobles():
    """Load all nobles from database into cache."""
    global _noble_cache
    if _noble_cache is None:
        from .models import Noble
        _noble_cache = {}
        for noble in Noble.objects.all():
            _noble_cache[noble.id] = {
                'id': noble.id,
                'points': noble.points,
                'requirements': noble.requirements,
                'background_image': noble.background_image.url if noble.background_image else '',
                'name': noble.name or '',
            }
    return _noble_cache


def get_card(card_id):
    """Get card data by ID."""
    return _load_cards().get(card_id)


def get_noble(noble_id):
    """Get noble data by ID."""
    return _load_nobles().get(noble_id)


def get_all_cards():
    """Get all cards."""
    return list(_load_cards().values())


def get_all_nobles():
    """Get all nobles."""
    return list(_load_nobles().values())


def clear_card_cache():
    """Clear cached data (call when cards are updated in admin)."""
    global _card_cache, _noble_cache
    _card_cache = None
    _noble_cache = None


def generate_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


def initial_bank(player_count):
    gem_count = {2: 4, 3: 5, 4: 7}[player_count]
    return {c: gem_count for c in COLORS} | {'gold': 5}


def initial_decks_and_nobles(player_count, balancing_override=None):
    """Set up shuffled decks, visible cards, and nobles.

    Args:
        player_count: number of players (2-4)
        balancing_override: optional dict to override global balancing config,
            e.g. {'enabled': True, 'level': 'soft'}.  Pass None to use the
            global GAME_BALANCING_* settings.
    """
    all_cards = get_all_cards()
    level1 = [c['id'] for c in all_cards if c['level'] == 1]
    level2 = [c['id'] for c in all_cards if c['level'] == 2]
    level3 = [c['id'] for c in all_cards if c['level'] == 3]
    random.shuffle(level1)
    random.shuffle(level2)
    random.shuffle(level3)

    # Pre-arrange decks so same-colour cards are spread out throughout the draw order.
    # This keeps replacement draws diverse across the whole game, not just at the start.
    try:
        from .balancing import arrange_balanced_deck, get_config
        _bal_cfg = get_config(balancing_override)
        if _bal_cfg.is_active:
            level1 = arrange_balanced_deck(level1, get_card, _bal_cfg)
            level2 = arrange_balanced_deck(level2, get_card, _bal_cfg)
            level3 = arrange_balanced_deck(level3, get_card, _bal_cfg)
    except Exception:
        import logging
        logging.getLogger('game.balancing').exception(
            '[BALANCING] Error during deck pre-arrangement; continuing unbalanced'
        )

    noble_count = player_count + 1
    all_nobles = list(_load_nobles().keys())
    random.shuffle(all_nobles)
    nobles = all_nobles[:noble_count]

    visible = {'1': [], '2': [], '3': []}
    for level, deck in [('1', level1), ('2', level2), ('3', level3)]:
        for _ in range(4):
            if deck:
                visible[level].append(deck.pop(0))

    decks = {'1': level1, '2': level2, '3': level3}

    # ── Balancing Layer (optional) ──────────────────────────────────────
    try:
        from .balancing import get_balanced_table_cards, get_balanced_nobles, get_config
        config = get_config(balancing_override)
        if config.is_active:
            visible, decks = get_balanced_table_cards(
                visible, decks, get_card, config
            )
            nobles = get_balanced_nobles(
                nobles, all_nobles, get_noble, config,
                visible=visible, decks=decks, get_card_fn=get_card,
            )
    except Exception:
        # Balancing must never break game start — fail open
        import logging
        logging.getLogger('game.balancing').exception(
            '[BALANCING] Error during initial deal balancing; continuing unbalanced'
        )

    return decks, visible, nobles


def _draw_replacement(deck, visible_row=None):
    """Draw a replacement card from *deck*, preferring one that balances
    the colour distribution of *visible_row*.

    The selected card is **removed** from *deck* in-place.
    Falls back silently to deck.pop(0) if balancing is unavailable.
    """
    if not deck:
        return None
    try:
        from .balancing import get_balanced_replacement_card, get_config
        return get_balanced_replacement_card(deck, visible_row or [], get_card, get_config())
    except Exception:
        return deck.pop(0)


def get_player_bonuses(purchased_card_ids):
    bonuses = {c: 0 for c in COLORS}
    for cid in purchased_card_ids:
        card = get_card(cid)
        if card:
            bonuses[card['bonus']] += 1
    return bonuses


def effective_cost(card_id, player_tokens, purchased_card_ids):
    """Return tokens that must be spent (after applying bonuses). Returns None if can't afford."""
    card = get_card(card_id)
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
        noble = get_noble(nid)
        qualifies = all(bonuses.get(c, 0) >= v for c,
                        v in noble['requirements'].items())
        if qualifies:
            eligible.append(nid)
    return eligible


def apply_take_tokens(game_data, player_data, colors_to_take):
    """
    colors_to_take: list of color strings.
    Valid options:
    - 3 different colors (standard action)
    - 2 different colors (if only 2 colors available in bank)
    - 2 of same color (only if bank has >=4 of that color)
    - 1 color (if only 1 color available in bank)
    Returns (updated_game_data, updated_player_data, error_str, needs_discard)
    needs_discard is True if player now has >10 tokens and must discard.
    """
    bank = dict(game_data['tokens_in_bank'])
    ptokens = dict(player_data['tokens'])

    # Count colors available in bank (non-gold tokens with count > 0)
    available_colors = [c for c in COLORS if bank.get(c, 0) > 0]
    num_available = len(available_colors)

    # Case 1: Taking 2 of the same color
    if len(colors_to_take) == 2 and colors_to_take[0] == colors_to_take[1]:
        color = colors_to_take[0]
        if color not in COLORS:
            return None, None, "Invalid color.", False
        if bank.get(color, 0) < 4:
            return None, None, "Need at least 4 tokens of that color to take 2.", False
        bank[color] -= 2
        ptokens[color] = ptokens.get(color, 0) + 2

    # Case 2: Taking 3 different colors
    elif len(colors_to_take) == 3 and len(set(colors_to_take)) == 3:
        for c in colors_to_take:
            if c not in COLORS:
                return None, None, f"Invalid color: {c}.", False
            if bank.get(c, 0) < 1:
                return None, None, f"No {c} tokens in bank.", False
        for c in colors_to_take:
            bank[c] -= 1
            ptokens[c] = ptokens.get(c, 0) + 1

    # Case 3: Taking 2 different colors (allowed if only 2 colors available in bank)
    elif len(colors_to_take) == 2 and len(set(colors_to_take)) == 2:
        # This is only allowed if there are exactly 2 colors available in the bank
        if num_available > 2:
            return None, None, "You must take 3 different colors when available.", False
        for c in colors_to_take:
            if c not in COLORS:
                return None, None, f"Invalid color: {c}.", False
            if bank.get(c, 0) < 1:
                return None, None, f"No {c} tokens in bank.", False
        for c in colors_to_take:
            bank[c] -= 1
            ptokens[c] = ptokens.get(c, 0) + 1

    # Case 4: Taking 1 color (allowed if only 1 color available in bank)
    elif len(colors_to_take) == 1:
        color = colors_to_take[0]
        if color not in COLORS:
            return None, None, "Invalid color.", False
        if num_available > 1:
            return None, None, "You must take more colors when available.", False
        if bank.get(color, 0) < 1:
            return None, None, f"No {color} tokens in bank.", False
        bank[color] -= 1
        ptokens[color] = ptokens.get(color, 0) + 1

    else:
        return None, None, "Invalid token selection.", False

    total = sum(ptokens.values())
    needs_discard = total > 10

    game_data = dict(game_data)
    game_data['tokens_in_bank'] = bank
    player_data = dict(player_data)
    player_data['tokens'] = ptokens
    return game_data, player_data, None, needs_discard


def apply_discard_tokens(game_data, player_data, tokens_to_discard):
    """
    Discard tokens to bring player total to <=10.
    Returns (updated_game_data, updated_player_data, error_str, still_needs_discard)
    """
    bank = dict(game_data['tokens_in_bank'])
    ptokens = dict(player_data['tokens'])

    for color, amount in tokens_to_discard.items():
        if ptokens.get(color, 0) < amount:
            return None, None, f"Don't have {amount} {color} tokens.", True
        ptokens[color] -= amount
        bank[color] = bank.get(color, 0) + amount

    total = sum(ptokens.values())
    still_needs_discard = total > 10

    game_data = dict(game_data)
    game_data['tokens_in_bank'] = bank
    player_data = dict(player_data)
    player_data['tokens'] = ptokens
    return game_data, player_data, None, still_needs_discard


def apply_cancel_pending_discard(game_data, player_data, pending_action_data):
    """
    Cancel the pending action that caused the discard requirement.
    Returns (updated_game_data, updated_player_data, error_str)
    """
    if not pending_action_data:
        return None, None, "No pending action to cancel."

    action_type = pending_action_data.get('type')

    if action_type == 'reserve' or action_type == 'reserve_card':
        # Undo a reserve action:
        # 1. Remove card from reserved_card_ids
        # 2. Return gold to bank if received
        # visible_cards/decks were never modified (deferred), so no reversal needed.
        card_id = pending_action_data.get('card_id')
        gold_received = pending_action_data.get('gold_received', False)

        reserved = list(player_data['reserved_card_ids'])
        if card_id not in reserved:
            return None, None, "Card not in reserved cards."
        reserved.remove(card_id)

        bank = dict(game_data['tokens_in_bank'])
        ptokens = dict(player_data['tokens'])

        # Return gold if received
        if gold_received:
            ptokens['gold'] = max(0, ptokens.get('gold', 0) - 1)
            bank['gold'] = bank.get('gold', 0) + 1

        game_data = dict(game_data)
        game_data['tokens_in_bank'] = bank
        player_data = dict(player_data)
        player_data['tokens'] = ptokens
        player_data['reserved_card_ids'] = reserved
        player_data['pending_action_data'] = None
        return game_data, player_data, None

    elif action_type == 'take_tokens':
        # Undo take_tokens action:
        # Return the tokens back to bank
        colors_taken = pending_action_data.get('colors', [])

        bank = dict(game_data['tokens_in_bank'])
        ptokens = dict(player_data['tokens'])

        for color in colors_taken:
            ptokens[color] = max(0, ptokens.get(color, 0) - 1)
            bank[color] = bank.get(color, 0) + 1

        game_data = dict(game_data)
        game_data['tokens_in_bank'] = bank
        player_data = dict(player_data)
        player_data['tokens'] = ptokens
        player_data['pending_action_data'] = None
        return game_data, player_data, None

    return None, None, f"Unknown pending action type: {action_type}"


def apply_reserve_card(game_data, player_data, card_id=None, level=None):
    """
    Reserve a face-up card (card_id given) or top of deck (level given).
    Returns (updated_game_data, updated_player_data, reserved_card_id, error_str, needs_discard)
    needs_discard is True if player now has >10 tokens and must discard.
    """
    reserved = list(player_data['reserved_card_ids'])
    if len(reserved) >= 3:
        return None, None, None, "Already have 3 reserved cards.", False

    visible = {k: list(v) for k, v in game_data['visible_cards'].items()}
    decks = {k: list(v) for k, v in game_data['decks'].items()}
    bank = dict(game_data['tokens_in_bank'])
    ptokens = dict(player_data['tokens'])

    if card_id is not None:
        found_level = None
        for lvl, cards in visible.items():
            if card_id in cards:
                idx = cards.index(card_id)
                found_level = lvl
                # Replace in-place to maintain card positions
                if decks[lvl]:
                    # Pass remaining visible row (excluding the reserved card)
                    # so balanced replacement avoids colours already dominant there
                    row_without = [c for c in cards if c != card_id]
                    replacement = _draw_replacement(decks[lvl], row_without)
                    if replacement is not None:
                        cards[idx] = replacement
                    else:
                        cards.pop(idx)
                else:
                    cards.pop(idx)
                visible[lvl] = cards
                break
        if found_level is None:
            return None, None, None, "Card not visible on table.", False
    else:
        # top of deck
        lvl = str(level)
        if not decks.get(lvl):
            return None, None, None, f"Level {level} deck is empty.", False
        card_id = decks[lvl].pop(0)
        decks[lvl] = decks[lvl]

    reserved.append(card_id)

    # Give gold if available (player must discard if this puts them over 10)
    if bank.get('gold', 0) > 0:
        bank['gold'] -= 1
        ptokens['gold'] = ptokens.get('gold', 0) + 1

    total = sum(ptokens.values())
    needs_discard = total > 10

    game_data = dict(game_data)
    game_data['tokens_in_bank'] = bank
    if needs_discard:
        # Don't modify visible_cards/decks yet - defer until discard is confirmed.
        # The player can cancel the modal, which cancels the entire move,
        # so the board should not change until confirmation.
        # Store the deferred state so it can be applied after confirmation.
        game_data['_deferred_visible_cards'] = visible
        game_data['_deferred_decks'] = decks
    else:
        game_data['visible_cards'] = visible
        game_data['decks'] = decks
    player_data = dict(player_data)
    player_data['tokens'] = ptokens
    player_data['reserved_card_ids'] = reserved
    return game_data, player_data, card_id, None, needs_discard


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
                idx = cards.index(card_id)
                # Replace in-place to maintain card positions
                if decks[lvl]:
                    row_without = [c for c in cards if c != card_id]
                    replacement = _draw_replacement(decks[lvl], row_without)
                    if replacement is not None:
                        cards[idx] = replacement
                    else:
                        cards.pop(idx)
                else:
                    cards.pop(idx)
                visible[lvl] = cards
                break

    purchased.append(card_id)

    # Compute new prestige (cards + nobles)
    card = get_card(card_id)
    card_prestige = sum(get_card(cid)['points'] for cid in purchased)
    noble_prestige = sum(get_noble(nid)['points']
                         for nid in player_data['noble_ids'])
    prestige = card_prestige + noble_prestige

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

    noble = get_noble(noble_id)
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
    winners = [p for p in candidates if len(
        p['purchased_card_ids']) == best_cards]
    return winners[0]
