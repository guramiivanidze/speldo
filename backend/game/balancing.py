"""
Game Balancing Layer for Splendor Online.

This module provides optional balancing for card distribution and noble selection.
It wraps existing game logic without modifying core behavior.

All balancing is feature-flag controlled and can be toggled globally via Django
settings or per-game via the Game model's balancing fields.

Usage:
    # Controlled via settings:
    GAME_BALANCING_ENABLED = True
    GAME_BALANCING_LEVEL = "soft"  # "off" | "soft" | "strict"

    # Or per-game override via Game model fields.
"""

import logging
import random
from collections import Counter
from dataclasses import dataclass, field
from typing import Optional, Callable

from django.conf import settings

logger = logging.getLogger('game.balancing')

BALANCING_LEVELS = ('off', 'soft', 'strict')


# ─── Configuration ───────────────────────────────────────────────────────────


@dataclass
class BalancingConfig:
    """Configuration for game balancing parameters."""

    enabled: bool = True
    level: str = 'soft'  # 'off', 'soft', 'strict'

    # Card distribution limits (per-row)
    max_same_color: int = 2         # Max cards of same bonus color per level row
    min_different_colors: int = 3   # Min unique bonus colors per level row

    # Cross-level global distribution (all 12 visible cards together)
    global_max_same_color: int = 5  # Max cards of same bonus color across ALL rows combined

    # Noble balancing
    max_shared_dominant_color: int = 1  # Max nobles sharing same dominant requirement color
    noble_color_coverage: int = 4       # Min distinct colors required across all nobles

    # Weighted replacement
    replacement_lookahead: int = 6      # How many cards to look ahead when replacing
    dominant_color_penalty: float = 0.4  # Probability multiplier for overrepresented colors

    # Board refresh
    refresh_threshold: int = 3  # Trigger refresh if any color has >= this many in a row

    @classmethod
    def from_settings(cls):
        """Build config from Django settings, falling back to defaults."""
        enabled = getattr(settings, 'GAME_BALANCING_ENABLED', False)
        level = getattr(settings, 'GAME_BALANCING_LEVEL', 'soft')
        if level not in BALANCING_LEVELS:
            level = 'soft'

        kwargs = {'enabled': enabled, 'level': level}

        overridable = (
            'max_same_color', 'min_different_colors', 'global_max_same_color',
            'max_shared_dominant_color', 'noble_color_coverage',
            'replacement_lookahead', 'dominant_color_penalty', 'refresh_threshold',
        )
        for attr in overridable:
            val = getattr(settings, f'GAME_BALANCING_{attr.upper()}', None)
            if val is not None:
                kwargs[attr] = val

        return cls(**kwargs)

    @property
    def is_active(self):
        return self.enabled and self.level != 'off'


def get_config(override: Optional[dict] = None) -> BalancingConfig:
    """Get balancing config, optionally with per-game overrides."""
    config = BalancingConfig.from_settings()
    if override:
        for key, value in override.items():
            if hasattr(config, key):
                setattr(config, key, value)
    return config


# ─── Metrics Tracking ────────────────────────────────────────────────────────


class BalancingMetrics:
    """Simple in-process metrics tracker for balancing operations."""

    def __init__(self):
        self.reset()

    def reset(self):
        self.cards_rebalanced = 0
        self.nobles_rebalanced = 0
        self.replacements_influenced = 0
        self.board_refreshes = 0
        self.total_checks = 0

    def log_summary(self, context: str = ''):
        prefix = f'[{context}] ' if context else ''
        logger.info(
            f'{prefix}Balancing metrics: '
            f'checks={self.total_checks}, '
            f'cards_rebalanced={self.cards_rebalanced}, '
            f'nobles_rebalanced={self.nobles_rebalanced}, '
            f'replacements_influenced={self.replacements_influenced}, '
            f'board_refreshes={self.board_refreshes}'
        )

    def snapshot(self):
        """Return current metrics as a dict."""
        return {
            'total_checks': self.total_checks,
            'cards_rebalanced': self.cards_rebalanced,
            'nobles_rebalanced': self.nobles_rebalanced,
            'replacements_influenced': self.replacements_influenced,
            'board_refreshes': self.board_refreshes,
        }


_metrics = BalancingMetrics()


def get_metrics() -> BalancingMetrics:
    return _metrics


# ─── Internal Helpers ────────────────────────────────────────────────────────


def _get_card_colors(card_ids, get_card_fn):
    """Get bonus colors for a list of card IDs."""
    colors = []
    for cid in card_ids:
        card = get_card_fn(cid)
        if card:
            colors.append(card['bonus'])
    return colors


def _is_row_balanced(card_ids, get_card_fn, config: BalancingConfig):
    """Check if a row of visible cards meets balancing criteria."""
    if not card_ids:
        return True
    colors = _get_card_colors(card_ids, get_card_fn)
    if not colors:
        return True
    counts = Counter(colors)

    if counts.most_common(1)[0][1] > config.max_same_color:
        return False

    if len(counts) < min(config.min_different_colors, len(card_ids)):
        return False

    return True


def _get_dominant_color(noble):
    """Get the dominant (highest-valued) requirement color for a noble."""
    reqs = noble.get('requirements', {})
    if not reqs:
        return None
    max_val = max(reqs.values())
    if max_val == 0:
        return None
    dominant = [c for c, v in reqs.items() if v == max_val]
    return sorted(dominant)[0]  # deterministic tiebreak


# ─── Cross-level and Noble-alignment helpers ─────────────────────────────────


def _global_color_counts(visible, get_card_fn):
    """Count bonus colors across ALL visible rows combined."""
    all_ids = []
    for row in visible.values():
        all_ids.extend(row)
    return Counter(_get_card_colors(all_ids, get_card_fn))


def _card_pool_color_counts(visible, decks, get_card_fn):
    """Count bonus colors across the full card pool (visible + decks)."""
    all_ids = []
    for row in visible.values():
        all_ids.extend(row)
    for deck in decks.values():
        all_ids.extend(deck)
    return Counter(_get_card_colors(all_ids, get_card_fn))


def _nobles_color_coverage(noble_ids, get_noble_fn):
    """Return the set of distinct colors required (> 0) across all nobles."""
    colors = set()
    for nid in noble_ids:
        noble = get_noble_fn(nid)
        if noble:
            for color, req in noble.get('requirements', {}).items():
                if req > 0:
                    colors.add(color)
    return colors


def _noble_achievable(noble, pool_counts, min_cards_per_required_color=3):
    """Return True if the card pool has enough cards of each required color."""
    for color, req in noble.get('requirements', {}).items():
        if req > 0 and pool_counts.get(color, 0) < min_cards_per_required_color:
            return False
    return True


# ─── Card Distribution Balancing ─────────────────────────────────────────────


def get_balanced_table_cards(visible, decks, get_card_fn, config=None):
    """
    Balance the visible cards on the table.

    If a row already satisfies balance criteria, it is returned unchanged.
    If not, problematic cards are swapped with cards from the deck.

    Args:
        visible: dict of level -> list of visible card IDs
        decks:   dict of level -> list of remaining card IDs (deck)
        get_card_fn: callable(card_id) -> card dict
        config:  optional BalancingConfig override

    Returns:
        (balanced_visible, updated_decks)
    """
    if config is None:
        config = get_config()

    if not config.is_active:
        return visible, decks

    _metrics.total_checks += 1

    balanced_visible = {k: list(v) for k, v in visible.items()}
    updated_decks = {k: list(v) for k, v in decks.items()}

    for level in ('1', '2', '3'):
        row = balanced_visible.get(level, [])
        deck = updated_decks.get(level, [])

        if not row or _is_row_balanced(row, get_card_fn, config):
            continue

        before_colors = _get_card_colors(row, get_card_fn)
        logger.info(f'[BALANCING] Level {level} row unbalanced: {before_colors}')

        max_attempts = 10
        attempts = 0

        while not _is_row_balanced(row, get_card_fn, config) and deck and attempts < max_attempts:
            attempts += 1
            colors = _get_card_colors(row, get_card_fn)
            counts = Counter(colors)

            most_common_color, most_common_count = counts.most_common(1)[0]

            if (most_common_count <= config.max_same_color
                    and len(counts) >= min(config.min_different_colors, len(row))):
                break

            # Find a card of the overrepresented color to swap out
            swap_idx = None
            for i, cid in enumerate(row):
                card = get_card_fn(cid)
                if card and card['bonus'] == most_common_color:
                    swap_idx = i

            if swap_idx is None:
                break

            # How deep to search the deck for a replacement
            search_depth = (
                min(len(deck), 10) if config.level == 'strict'
                else min(len(deck), config.replacement_lookahead)
            )

            best_replacement_idx = None
            for di in range(search_depth):
                candidate = get_card_fn(deck[di])
                if candidate and candidate['bonus'] != most_common_color:
                    best_replacement_idx = di
                    break

            if best_replacement_idx is not None:
                old_card = row[swap_idx]
                new_card = deck[best_replacement_idx]
                row[swap_idx] = new_card
                deck[best_replacement_idx] = old_card
                _metrics.cards_rebalanced += 1
            else:
                break  # No suitable replacement found

        balanced_visible[level] = row
        updated_decks[level] = deck

        after_colors = _get_card_colors(row, get_card_fn)
        if before_colors != after_colors:
            logger.info(
                f'[BALANCING] Level {level} rebalanced: {before_colors} -> {after_colors}'
            )

    # ── Cross-level global check ──────────────────────────────────────
    # After per-row balancing, ensure no color dominates the full 12-card board.
    global_counts = _global_color_counts(balanced_visible, get_card_fn)
    overrepresented = [
        color for color, count in global_counts.items()
        if count > config.global_max_same_color
    ]
    if overrepresented:
        logger.info(
            f'[BALANCING] Global color imbalance: {dict(global_counts)}, '
            f'over-limit: {overrepresented}'
        )
        for color in overrepresented:
            # Swap one excess card from each level that has it, preferring level 1
            for level in ('1', '2', '3'):
                row = balanced_visible.get(level, [])
                deck = updated_decks.get(level, [])
                if not deck:
                    continue
                # Find a card of the overrepresented color in this row
                swap_idx = next(
                    (i for i, cid in enumerate(row)
                     if (get_card_fn(cid) or {}).get('bonus') == color),
                    None,
                )
                if swap_idx is None:
                    continue
                # Look for a replacement from a different color in the deck
                search_depth = min(len(deck), config.replacement_lookahead * 2)
                repl_idx = next(
                    (di for di in range(search_depth)
                     if (get_card_fn(deck[di]) or {}).get('bonus') != color
                     and (get_card_fn(deck[di]) or {}).get('bonus') not in overrepresented),
                    None,
                )
                if repl_idx is not None:
                    row[swap_idx], deck[repl_idx] = deck[repl_idx], row[swap_idx]
                    balanced_visible[level] = row
                    updated_decks[level] = deck
                    _metrics.cards_rebalanced += 1
                    # Re-check — stop as soon as this color is within limit
                    global_counts = _global_color_counts(balanced_visible, get_card_fn)
                    if global_counts.get(color, 0) <= config.global_max_same_color:
                        break

    return balanced_visible, updated_decks


# ─── Noble Balancing ─────────────────────────────────────────────────────────


def get_balanced_nobles(noble_ids, all_noble_ids, get_noble_fn, config=None,
                        visible=None, decks=None, get_card_fn=None):
    """
    Balance noble selection:
      1. No more than max_shared_dominant_color nobles share the same dominant color.
      2. The set of nobles collectively requires at least noble_color_coverage
         distinct colors, giving players diverse strategic paths.
      3. Each noble is achievable — its required colors have enough cards in the
         full card pool (visible + decks).

    Args:
        noble_ids:     originally selected noble IDs
        all_noble_ids: all available noble IDs to choose replacements from
        get_noble_fn:  callable(noble_id) -> noble dict
        config:        optional BalancingConfig override
        visible:       optional visible card dict (for achievability check)
        decks:         optional deck dict (for achievability check)
        get_card_fn:   optional card lookup (for achievability check)

    Returns:
        list of balanced noble IDs
    """
    if config is None:
        config = get_config()

    if not config.is_active:
        return noble_ids

    _metrics.total_checks += 1
    nobles = list(noble_ids)
    replacement_pool = [nid for nid in all_noble_ids if nid not in nobles]
    random.shuffle(replacement_pool)

    # Pre-compute pool color counts for achievability check
    pool_counts = None
    if visible is not None and decks is not None and get_card_fn is not None:
        pool_counts = _card_pool_color_counts(visible, decks, get_card_fn)

    def _try_replace(idx, reject_fn, label):
        """Swap nobles[idx] with the first replacement that passes reject_fn."""
        for ri, rid in enumerate(replacement_pool):
            rn = get_noble_fn(rid)
            if not rn:
                continue
            if reject_fn(rn):
                continue
            logger.info(f'[BALANCING] Noble swap ({label}): {nobles[idx]} → {rid}')
            nobles[idx] = rid
            replacement_pool.pop(ri)
            _metrics.nobles_rebalanced += 1
            return True
        logger.warning(f'[BALANCING] No suitable replacement for noble {nobles[idx]} ({label})')
        return False

    # ── Pass 1: fix dominant-color conflicts ─────────────────────────
    for _ in range(2):  # two passes in case early swaps create new conflicts
        dominant_colors = [
            _get_dominant_color(get_noble_fn(nid))
            for nid in nobles if get_noble_fn(nid)
        ]
        color_counts = Counter(c for c in dominant_colors if c is not None)
        conflicts = {c: n for c, n in color_counts.items()
                     if n > config.max_shared_dominant_color}
        if not conflicts:
            break
        logger.info(
            f'[BALANCING] Noble dominant-color conflict: {dominant_colors}, '
            f'conflicts={conflicts}'
        )
        for conflict_color, conflict_count in conflicts.items():
            to_replace = conflict_count - config.max_shared_dominant_color
            for i in range(len(nobles)):
                if to_replace <= 0:
                    break
                noble = get_noble_fn(nobles[i])
                if not noble or _get_dominant_color(noble) != conflict_color:
                    continue
                if _try_replace(i, lambda rn, c=conflict_color: _get_dominant_color(rn) == c,
                                f'dominant={conflict_color}'):
                    to_replace -= 1

    # ── Pass 2: enforce color coverage across all nobles ─────────────
    coverage = _nobles_color_coverage(nobles, get_noble_fn)
    if len(coverage) < config.noble_color_coverage:
        logger.info(
            f'[BALANCING] Noble color coverage too low: {coverage} '
            f'(need {config.noble_color_coverage} distinct colors)'
        )
        # Find nobles whose colors are already well-covered and try to swap one
        # for a noble that contributes a missing color.
        all_colors = {'white', 'blue', 'green', 'red', 'black'}
        missing_colors = all_colors - coverage
        for i in range(len(nobles)):
            if not missing_colors:
                break
            noble = get_noble_fn(nobles[i])
            if not noble:
                continue
            noble_colors = {c for c, v in noble.get('requirements', {}).items() if v > 0}
            # Only swap nobles that don't introduce any missing color themselves
            if noble_colors & missing_colors:
                continue
            if _try_replace(
                i,
                lambda rn, mc=missing_colors: not ({c for c, v in rn.get('requirements', {}).items() if v > 0} & mc),
                f'coverage missing {missing_colors}',
            ):
                coverage = _nobles_color_coverage(nobles, get_noble_fn)
                missing_colors = all_colors - coverage

    # ── Pass 3: remove unachievable nobles ───────────────────────────
    if pool_counts is not None:
        for i in range(len(nobles)):
            noble = get_noble_fn(nobles[i])
            if not noble:
                continue
            if not _noble_achievable(noble, pool_counts):
                logger.info(
                    f'[BALANCING] Noble {nobles[i]} unachievable given card pool '
                    f'(requirements={noble.get("requirements")}, pool={dict(pool_counts)})'
                )
                _try_replace(
                    i,
                    lambda rn, pc=pool_counts: not _noble_achievable(rn, pc),
                    'unachievable',
                )

    return nobles


# ─── Weighted Random Replacement ─────────────────────────────────────────────


def get_balanced_replacement_card(deck, visible_row, get_card_fn, config=None):
    """
    Select a replacement card from the deck using weighted random selection.

    Instead of always taking the top card, looks at the first N cards and
    prefers one that balances the visible row better.

    Args:
        deck:        list of card IDs (mutated — selected card is removed)
        visible_row: current visible card IDs in the same level row
        get_card_fn: callable(card_id) -> card dict
        config:      optional BalancingConfig override

    Returns:
        card_id of the selected replacement, or None if deck is empty
    """
    if not deck:
        return None

    if config is None:
        config = get_config()

    if not config.is_active:
        return deck.pop(0)

    lookahead = min(len(deck), config.replacement_lookahead)
    if lookahead <= 1:
        return deck.pop(0)

    current_colors = Counter(_get_card_colors(visible_row, get_card_fn))

    candidates = deck[:lookahead]
    weights = []

    for cid in candidates:
        card = get_card_fn(cid)
        if not card:
            weights.append(1.0)
            continue

        color = card['bonus']
        current_count = current_colors.get(color, 0)

        if current_count >= config.max_same_color:
            weight = (
                config.dominant_color_penalty ** 2
                if config.level == 'strict'
                else config.dominant_color_penalty
            )
        elif current_count > 0:
            weight = 1.0 - (0.1 * current_count)
        else:
            weight = 1.2

        weights.append(max(0.1, weight))

    chosen_idx = random.choices(range(len(candidates)), weights=weights, k=1)[0]

    if chosen_idx != 0:
        _metrics.replacements_influenced += 1
        card = get_card_fn(candidates[chosen_idx])
        top_card = get_card_fn(candidates[0])
        logger.debug(
            f'[BALANCING] Replacement influenced: chose index {chosen_idx} '
            f'({card["bonus"] if card else "?"}) over top card '
            f'({top_card["bonus"] if top_card else "?"}), '
            f'weights={[f"{w:.2f}" for w in weights]}'
        )

    selected = deck.pop(chosen_idx)
    return selected


# ─── Board Refresh Hook ─────────────────────────────────────────────────────


def maybe_refresh_board(game_data, get_card_fn, config=None):
    """
    Check if the board is in an extreme state and rebalance if so.

    Only triggers for extreme cases (3+ same color in a single row by default).

    Args:
        game_data:   dict containing 'visible_cards' and 'decks'
        get_card_fn: callable(card_id) -> card dict
        config:      optional BalancingConfig override

    Returns:
        game_data — updated if refresh was needed, original otherwise
    """
    if config is None:
        config = get_config()

    if not config.is_active:
        return game_data

    visible = game_data.get('visible_cards', {})
    decks = game_data.get('decks', {})

    needs_refresh = False
    for level in ('1', '2', '3'):
        row = visible.get(level, [])
        if not row:
            continue
        colors = _get_card_colors(row, get_card_fn)
        counts = Counter(colors)
        if counts and counts.most_common(1)[0][1] >= config.refresh_threshold:
            needs_refresh = True
            logger.warning(
                f'[BALANCING] Board refresh triggered for level {level}: {colors}'
            )
            break

    if not needs_refresh:
        return game_data

    _metrics.board_refreshes += 1

    balanced_visible, updated_decks = get_balanced_table_cards(
        visible, decks, get_card_fn, config
    )

    game_data = dict(game_data)
    game_data['visible_cards'] = balanced_visible
    game_data['decks'] = updated_decks
    return game_data


# ─── Simulation ──────────────────────────────────────────────────────────────


def simulate_games(n, get_card_fn, get_noble_fn,
                   all_card_ids_by_level, all_noble_ids, player_count=2):
    """
    Simulate N game setups with and without balancing. Returns comparison stats.

    Args:
        n: number of simulations to run
        get_card_fn:           card lookup function
        get_noble_fn:          noble lookup function
        all_card_ids_by_level: dict {'1': [ids], '2': [ids], '3': [ids]}
        all_noble_ids:         list of all noble IDs
        player_count:          number of players (affects noble count)

    Returns:
        dict with 'with_balancing' and 'without_balancing' stat dicts
    """
    from collections import defaultdict

    stats = {
        'with_balancing': defaultdict(int),
        'without_balancing': defaultdict(int),
    }

    config_on = BalancingConfig(enabled=True, level='soft')
    config_off = BalancingConfig(enabled=False)
    noble_count = player_count + 1

    # Temporarily swap metrics so simulation doesn't pollute global counters
    global _metrics
    saved_metrics = _metrics
    _metrics = BalancingMetrics()

    try:
        for _ in range(n):
            for label, config in [('without_balancing', config_off),
                                  ('with_balancing', config_on)]:
                # Simulate initial deal
                decks = {}
                visible = {}
                for level_str, card_ids in all_card_ids_by_level.items():
                    shuffled = list(card_ids)
                    random.shuffle(shuffled)
                    visible[level_str] = shuffled[:4]
                    decks[level_str] = shuffled[4:]

                noble_pool = list(all_noble_ids)
                random.shuffle(noble_pool)
                nobles = noble_pool[:noble_count]

                if config.is_active:
                    visible, decks = get_balanced_table_cards(
                        visible, decks, get_card_fn, config
                    )
                    nobles = get_balanced_nobles(
                        nobles, all_noble_ids, get_noble_fn, config
                    )

                # Measure color distribution per row
                for level_str in ('1', '2', '3'):
                    row = visible.get(level_str, [])
                    colors = _get_card_colors(row, get_card_fn)
                    counts = Counter(colors)

                    if counts:
                        max_count = counts.most_common(1)[0][1]
                        unique_count = len(counts)

                        if max_count >= 3:
                            stats[label]['extreme_same_color'] += 1
                        if max_count > 2:
                            stats[label]['over_2_same_color'] += 1
                        if unique_count < 3:
                            stats[label]['under_3_unique'] += 1

                        stats[label]['total_rows'] += 1

                # Measure noble conflicts
                dominant = []
                for nid in nobles:
                    noble = get_noble_fn(nid)
                    if noble:
                        dominant.append(_get_dominant_color(noble))

                dom_counts = Counter(c for c in dominant if c)
                if dom_counts and dom_counts.most_common(1)[0][1] > 1:
                    stats[label]['noble_conflicts'] += 1
                stats[label]['total_games'] += 1
    finally:
        _metrics = saved_metrics

    return dict(stats)
